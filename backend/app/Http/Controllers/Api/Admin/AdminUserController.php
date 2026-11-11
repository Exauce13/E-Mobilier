<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Zone;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

class AdminUserController extends Controller
{
    /**
     * Liste l'ensemble des comptes administrateurs et agents.
     * Réservé aux Super Administrateurs.
     */
    public function index(Request $request): JsonResponse
    {
        $query = User::with(['roles:id,name', 'zone:id,nom,code,commune'])
            ->whereHas('roles', function ($q) {
                $q->whereIn('name', [
                    'Super Admin Principal',
                    'Super Admin Technique',
                    'Secrétaire',
                    'Responsable de zone',
                    'Admin',
                ]);
            });

        // Filtre optionnel par statut
        if ($request->filled('statut')) {
            $query->where('statut', $request->input('statut'));
        }

        // Filtre optionnel par zone
        if ($request->filled('zone_id')) {
            $query->where('zone_id', $request->input('zone_id'));
        }

        // Filtre optionnel par rôle
        if ($request->filled('role')) {
            $role = $request->input('role');
            $query->whereHas('roles', fn ($q) => $q->where('name', $role));
        }

        $users = $query->orderBy('id', 'desc')->paginate((int) $request->input('per_page', 20));

        return response()->json([
            'success' => true,
            'message' => 'Liste des comptes d\'administration récupérée avec succès.',
            'data' => $users,
        ]);
    }

    /**
     * Crée un compte d'administration (Secrétaire, Responsable de zone, Super Admin Tech).
     * Règle anti-escalade : interdiction absolue de créer un compte avec rôle Principal.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'prenom' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'telephone' => ['required', 'string', 'max:50'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', 'string', Rule::in([
                'Super Admin Technique',
                'Secrétaire',
                'Responsable de zone',
            ])],
            'zone_id' => ['nullable', 'exists:zones,id'],
        ]);

        // Règle de validation métier : Responsable de zone exige obligatoirement une zone
        if ($validated['role'] === 'Responsable de zone' && empty($validated['zone_id'])) {
            return response()->json([
                'success' => false,
                'message' => 'Un Responsable de zone doit obligatoirement être rattaché à une zone géographique valide.',
            ], 422);
        }

        $user = User::create([
            'name' => $validated['name'],
            'prenom' => $validated['prenom'],
            'email' => strtolower($validated['email']),
            'telephone' => $validated['telephone'],
            'password' => Hash::make($validated['password']),
            'zone_id' => $validated['zone_id'] ?? null,
            'statut' => 'actif',
            'is_verifed' => true,
        ]);

        $user->assignRole($validated['role']);
        $user->assignRole('Admin'); // Rôle commun legacy

        AuditService::log('creation_administrateur', $user, [
            'role' => $validated['role'],
            'zone_id' => $user->zone_id,
            'email' => $user->email,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Compte administrateur avec rôle '{$validated['role']}' créé avec succès.",
            'data' => $user->load(['roles:id,name', 'zone:id,nom,code']),
        ], 201);
    }

    /**
     * Modifie l'affectation de rôle ou de zone d'un compte.
     * Règle de sécurité : Rejet 403 + alerte si la cible est le Super Admin Principal (Justin).
     */
    public function updateRoleZone(Request $request, int $id): JsonResponse
    {
        $targetUser = User::findOrFail($id);
        $caller = $request->user();

        // 1. Protection Anti-Escalade : Sanctuarisation du Super Admin Principal
        if ($targetUser->isSuperAdminPrincipal()) {
            AuditService::securityAlert('TENTATIVE_MODIFICATION_PROPRIETAIRE', "L'utilisateur ID {$caller->id} ({$caller->email}) a tenté de modifier le rôle/la zone du Super Admin Principal (Justin MAGNIDE).", [
                'target_user_id' => $targetUser->id,
                'payload' => $request->all(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Action formellement interdite : le profil du Super Administrateur Principal est immuable et sanctuarisé.',
            ], 403);
        }

        $validated = $request->validate([
            'role' => ['sometimes', 'string', Rule::in([
                'Super Admin Technique',
                'Secrétaire',
                'Responsable de zone',
            ])],
            'zone_id' => ['nullable', 'exists:zones,id'],
        ]);

        if (isset($validated['role'])) {
            // Remplacer les rôles d'administration existants
            $targetUser->syncRoles([$validated['role'], 'Admin']);
        }

        if (array_key_exists('zone_id', $validated)) {
            $targetUser->update(['zone_id' => $validated['zone_id']]);
        }

        AuditService::log('modification_role_zone', $targetUser, [
            'nouveau_role' => $validated['role'] ?? null,
            'nouvelle_zone_id' => $targetUser->zone_id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Rôle et affectation géographique mis à jour avec succès.',
            'data' => $targetUser->load(['roles:id,name', 'zone:id,nom,code']),
        ]);
    }

    /**
     * Active ou suspend un compte d'administration.
     * Règle de sécurité : révocation immédiate des jetons Sanctum si suspension.
     */
    public function updateStatut(Request $request, int $id): JsonResponse
    {
        $targetUser = User::findOrFail($id);
        $caller = $request->user();

        // Sanctuarisation du Super Admin Principal
        if ($targetUser->isSuperAdminPrincipal()) {
            AuditService::securityAlert('TENTATIVE_SUSPENSION_PROPRIETAIRE', "L'utilisateur ID {$caller->id} a tenté de modifier le statut de Justin MAGNIDE.", [
                'target_id' => $targetUser->id,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Action formellement interdite : le Super Administrateur Principal ne peut pas être suspendu.',
            ], 403);
        }

        $validated = $request->validate([
            'statut' => ['required', 'string', Rule::in(['actif', 'suspendu'])],
            'motif' => ['nullable', 'string', 'max:500'],
        ]);

        $targetUser->update(['statut' => $validated['statut']]);

        // Si suspension : invalidation instantanée de tous les jetons actifs
        if ($validated['statut'] === 'suspendu') {
            $targetUser->tokens()->delete();
        }

        AuditService::log('changement_statut_utilisateur', $targetUser, [
            'nouveau_statut' => $validated['statut'],
            'motif' => $validated['motif'] ?? 'Non précisé',
            'jetons_revoques' => $validated['statut'] === 'suspendu',
        ]);

        return response()->json([
            'success' => true,
            'message' => "Le compte a été passé au statut '{$validated['statut']}' avec succès.",
            'data' => [
                'id' => $targetUser->id,
                'email' => $targetUser->email,
                'statut' => $targetUser->statut,
            ],
        ]);
    }
}

