<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Demande_client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VueDemandeClient extends Controller
{
    /**
     * Permet exclusivement à l'administrateur de consulter l'ensemble des demandes de recherche déposées par tous les clients.
     */
    public function toutesLesDemandes(Request $request): JsonResponse
    {
        $user = $request->user();

        // 1. Vérification de l'authentification
        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Utilisateur non authentifié.',
            ], 401);
        }

        // 2. Contrôle d'accès strict : réservé exclusivement à l'administrateur
        if (! $user->hasRole('Admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Accès refusé. Cette section est strictement réservée aux administrateurs.',
            ], 403);
        }

        // 3. Construction de la requête avec eager loading du client
        $query = Demande_client::with(['client:id,name,prenom,email,telephone,is_verifed'])
            ->latest();

        // Filtre optionnel par statut (active, fulfilled, closed)
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        // Filtre optionnel par type de bien (parcelle, maison, chambre)
        if ($request->filled('property_type')) {
            $query->where('property_type', $request->input('property_type'));
        }

        // Filtre optionnel par type d'opération (location, vente)
        if ($request->filled('transaction_type')) {
            $query->where('transaction_type', $request->input('transaction_type'));
        }

        // Filtre optionnel par commune
        if ($request->filled('target_commune') || $request->filled('commune')) {
            $commune = $request->input('target_commune', $request->input('commune'));
            $query->where('target_commune', 'ILIKE', '%' . $commune . '%');
        }

        // Filtre optionnel par identifiant du client
        if ($request->filled('client_id')) {
            $query->where('client_id', $request->input('client_id'));
        }

        // Filtre optionnel par statut de paiement
        if ($request->has('is_paid')) {
            $query->where('is_paid', $request->boolean('is_paid'));
        }

        // Recherche par mot-clé global (commune, quartier, détails ou informations client)
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('target_commune', 'ILIKE', "%{$search}%")
                    ->orWhere('target_arrondissement', 'ILIKE', "%{$search}%")
                    ->orWhere('target_quartier', 'ILIKE', "%{$search}%")
                    ->orWhere('criteria_details', 'ILIKE', "%{$search}%")
                    ->orWhereHas('client', function ($clientQ) use ($search) {
                        $clientQ->where('name', 'ILIKE', "%{$search}%")
                            ->orWhere('prenom', 'ILIKE', "%{$search}%")
                            ->orWhere('email', 'ILIKE', "%{$search}%")
                            ->orWhere('telephone', 'ILIKE', "%{$search}%");
                    });
            });
        }

        // Pagination
        $perPage = (int) $request->input('per_page', 20);
        $demandes = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Liste complète de toutes les demandes de recherche de tous les clients récupérée avec succès.',
            'data' => $demandes,
        ], 200);
    }

    /**
     * Alias standard REST pour la consultation de toutes les demandes par l'administrateur.
     */
    public function index(Request $request): JsonResponse
    {
        return $this->toutesLesDemandes($request);
    }

    /**
     * Permet à l'administrateur de consulter le détail complet d'une demande client spécifique.
     */
    public function show(Request $request, int|string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Utilisateur non authentifié.',
            ], 401);
        }

        if (! $user->hasRole('Admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Accès refusé. Cette section est strictement réservée aux administrateurs.',
            ], 403);
        }

        $demande = Demande_client::with(['client:id,name,prenom,email,telephone,is_verifed'])->find($id);

        if (! $demande) {
            return response()->json([
                'success' => false,
                'message' => 'Demande de recherche introuvable.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Détails de la demande client récupérés avec succès.',
            'data' => $demande,
        ], 200);
    }
}
