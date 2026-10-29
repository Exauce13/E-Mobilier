<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AuthentificationRequest;
use App\Http\Requests\InscriptionRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class InscriptionController extends Controller
{
    /**
     * Inscription d'un nouvel utilisateur (Client ou Agent immobilier).
     */
    public function inscription(InscriptionRequest $request): JsonResponse
    {
        return DB::transaction(function () use ($request) {
            $telephone = $request->input('telephone');
            $email = $request->input('email');
            $password = Hash::make($request->input('password'));

            $name = $request->input('name');
            $prenom = $request->input('prenom') ?? $name;

            // Création de l'utilisateur
            $user = User::create([
                'name' => $name,
                'prenom' => $prenom,
                'email' => $email,
                'telephone' => $telephone,
                'password' => $password,
                'is_verifed' => false,
            ]);

            // Attribution du rôle selon le choix du frontend
            $roleInput = $request->input('role', 'client_proprietaire');
            $roleName = match ($roleInput) {
                'agent_immobilier', 'Agent mobilier' => 'Agent mobilier',
                'Propritaires', 'proprietaire' => 'Propritaires',
                'Admin', 'admin' => 'Admin',
                default => 'Client',
            };

            // S'assurer que le rôle existe en base
            Role::firstOrCreate(['name' => $roleName]);
            $user->assignRole($roleName);

            // Génération du token d'accès Sanctum
            $token = $user->createToken('auth_token')->plainTextToken;

            return response()->json([
                'success' => true,
                'message' => 'Compte créé avec succès!Bienvenue dans la communauté E-Mobilier.',
                'data' => [
                    'user' => $this->formatUserResponse($user),
                    'token' => $token,
                    'token_type' => 'Bearer',
                ],
            ], 201);
        });
    }

    /**
     * Authentification d'un utilisateur par numéro de téléphone béninois et mot de passe.
     */
    public function authentification(AuthentificationRequest $request): JsonResponse
    {
        $identifier = $request->input('telephone') ?? $request->input('phone');
        $password = $request->input('password');

        // Recherche de l'utilisateur par téléphone ou email
        $user = User::where('telephone', $identifier)
            ->orWhere('email', $identifier)
            ->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Numéro de téléphone ou mot de passe incorrect.',
                'errors' => [
                    'credentials' => ['Les identifiants fournis ne correspondent pas à nos enregistrements.'],
                ],
            ], 401);
        }

        // Génération du token Sanctum
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Connexion réussie ! Bienvenue sur E-Mobilier.',
            'data' => [
                'user' => $this->formatUserResponse($user),
                'token' => $token,
                'token_type' => 'Bearer',
            ],
        ], 200);
    }

    /**
     * Déconnexion de l'utilisateur authentifié (révocation du token).
     */
    public function deconnexion(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user) {
            $user->currentAccessToken()?->delete();
        }

        return response()->json([
            'success' => true,
            'message' => 'Déconnexion réussie.',
        ], 200);
    }

    /**
     * Récupération du profil de l'utilisateur connecté.
     */
    public function profil(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Non authentifié.',
            ], 401);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'user' => $this->formatUserResponse($user),
            ],
        ], 200);
    }


    /**
     * Formate les données de l'utilisateur pour le frontend.
     */
    protected function formatUserResponse(User $user): array
    {
        $roles = $user->getRoleNames()->values()->all();
        $primaryRole = $roles[0] ?? 'Client';

        $frontendRole = match ($primaryRole) {
            'Agent mobilier' => 'agent_immobilier',
            'Propritaires' => 'client_proprietaire',
            default => 'client_proprietaire',
        };

        return [
            'id' => (string) $user->id,
            'name' => $user->fullName ?: trim("{$user->prenom} {$user->name}"),
            'nom' => $user->name,
            'prenom' => $user->prenom,
            'fullName' => $user->fullName ?: trim("{$user->prenom} {$user->name}"),
            'phone' => $user->telephone,
            'telephone' => $user->telephone,
            'email' => $user->email,
            'role' => $frontendRole,
            'roles' => $roles,
            'is_verifed' => (bool) $user->is_verifed,
            'balanceFifa' => 5000,
            'created_at' => $user->created_at,
        ];
    }
}
