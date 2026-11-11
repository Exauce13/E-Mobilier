<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\VisiteClientResource;
use App\Models\User;
use App\Models\Visite_client;
use App\Models\Zone;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class VisiteAdminController extends Controller
{
    /**
     * Liste paginée des visites avec masquage conditionnel et filtrage territorial.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Visite_client::with(['client', 'propriete.zone', 'agentAssigne', 'zone'])
            ->latest('scheduled_date');

        // 1. CLOISONNEMENT TERRITORIAL POUR LE RESPONSABLE DE ZONE
        if ($user->isResponsableZone()) {
            if (! $user->zone_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Aucune zone géographique n\'est assignée à votre profil.',
                ], 403);
            }

            $userZone = $user->zone;
            $commune = $userZone?->commune;

            $query->where(function ($q) use ($user, $commune) {
                $q->where('zone_id', $user->zone_id)
                    ->orWhere('target_agent_id', $user->id)
                    ->orWhereHas('propriete', function ($propQ) use ($user, $commune) {
                        $propQ->where('zone_id', $user->zone_id);
                        if ($commune) {
                            $propQ->orWhere('commune', 'ILIKE', '%' . $commune . '%');
                        }
                    });
            });
        }

        // 2. Filtres optionnels
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('zone_id')) {
            $query->where('zone_id', $request->input('zone_id'));
        }
        if ($request->filled('is_fee_paid')) {
            $query->where('is_fee_paid', $request->boolean('is_fee_paid'));
        }
        if ($request->filled('date')) {
            $query->whereDate('scheduled_date', $request->input('date'));
        }

        $perPage = (int) $request->input('per_page', 20);
        $visites = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Liste des visites récupérée avec succès.',
            'data' => VisiteClientResource::collection($visites)->response()->getData(true),
        ]);
    }

    /**
     * Fiche unitaire d'une visite avec protection Anti-IDOR.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $visite = Visite_client::with(['client', 'propriete.zone', 'agentAssigne', 'zone'])->findOrFail($id);

        if ($user->isResponsableZone()) {
            $userZoneId = $user->zone_id;
            $propZoneId = $visite->propriete?->zone_id;
            $visiteZoneId = $visite->zone_id;
            $isAssigned = $visite->target_agent_id === $user->id;

            if ($visiteZoneId !== $userZoneId && $propZoneId !== $userZoneId && ! $isAssigned) {
                return response()->json([
                    'success' => false,
                    'message' => 'Accès refusé (Anti-IDOR) : Cette visite relève d\'une zone en dehors de votre affectation.',
                ], 403);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Détail de la visite récupéré avec succès.',
            'data' => new VisiteClientResource($visite),
        ]);
    }

    /**
     * Met à jour le statut opérationnel d'une visite.
     * Accessible à tous les administrateurs (Resp. Zone borné à son secteur).
     */
    public function updateStatut(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $visite = Visite_client::with('propriete')->findOrFail($id);

        // Anti-IDOR pour Responsable de zone
        if ($user->isResponsableZone()) {
            $userZoneId = $user->zone_id;
            $propZoneId = $visite->propriete?->zone_id;
            $visiteZoneId = $visite->zone_id;
            $isAssigned = $visite->target_agent_id === $user->id;

            if ($visiteZoneId !== $userZoneId && $propZoneId !== $userZoneId && ! $isAssigned) {
                return response()->json([
                    'success' => false,
                    'message' => 'Action refusée (Anti-IDOR) : Vous ne pouvez pas modifier le statut d\'une visite hors de votre zone.',
                ], 403);
            }
        }

        $validated = $request->validate([
            'status' => ['required', 'string', Rule::in([
                'pending', 'confirmed', 'completed', 'cancelled',
                'Programmée', 'Effectuée', 'Reportée', 'Clôturée',
            ])],
            'motif' => ['nullable', 'string', 'max:500'],
        ]);

        // Normalisation des statuts (support multilingue / labels d'interface)
        $statusMap = [
            'Programmée' => 'confirmed',
            'Effectuée' => 'completed',
            'Reportée' => 'pending',
            'Clôturée' => 'completed',
            'pending' => 'pending',
            'confirmed' => 'confirmed',
            'completed' => 'completed',
            'cancelled' => 'cancelled',
        ];

        $normalise = $statusMap[$validated['status']] ?? $validated['status'];
        $ancienStatut = $visite->status;
        $visite->update(['status' => $normalise]);

        AuditService::log('modification_statut_visite', $visite, [
            'ancien_statut' => $ancienStatut,
            'nouveau_statut' => $normalise,
            'statut_affiche' => $validated['status'],
            'motif' => $validated['motif'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Statut de la visite mis à jour avec succès : {$validated['status']}.",
            'data' => new VisiteClientResource($visite->fresh(['client', 'propriete', 'agentAssigne', 'zone'])),
        ]);
    }

    /**
     * Assigne une visite à une zone géographique et éventuellement à un Responsable de zone.
     * Réservé aux Super Admins et à la Secrétaire.
     */
    public function assignerZone(Request $request, int $id): JsonResponse
    {
        $visite = Visite_client::findOrFail($id);

        $validated = $request->validate([
            'zone_id' => ['required', 'exists:zones,id'],
            'target_agent_id' => ['nullable', 'exists:users,id'],
        ]);

        $zone = Zone::findOrFail($validated['zone_id']);

        // Vérification optionnelle de l'agent assigné
        if (! empty($validated['target_agent_id'])) {
            $agent = User::findOrFail($validated['target_agent_id']);
            if (! $agent->isResponsableZone() && ! $agent->hasRole('Agent mobilier')) {
                return response()->json([
                    'success' => false,
                    'message' => 'L\'agent assigné doit avoir le rôle de Responsable de zone ou d\'Agent mobilier.',
                ], 422);
            }
        }

        $visite->update([
            'zone_id' => $zone->id,
            'target_agent_id' => $validated['target_agent_id'] ?? $visite->target_agent_id,
        ]);

        AuditService::log('assignation_zone_visite', $visite, [
            'zone_id' => $zone->id,
            'zone_nom' => $zone->nom,
            'target_agent_id' => $visite->target_agent_id,
        ]);

        return response()->json([
            'success' => true,
            'message' => "La visite a été assignée avec succès à la zone '{$zone->nom}'.",
            'data' => new VisiteClientResource($visite->fresh(['client', 'propriete', 'agentAssigne', 'zone'])),
        ]);
    }
}

