<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\DemandeClientResource;
use App\Models\Demande_client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DemandeClientAdminController extends Controller
{
    /**
     * Liste paginée des demandes de recherche avec masquage conditionnel et filtrage territorial.
     * Accessible aux Super Admins (Clair), Secrétaire (Masqué), Responsable de zone (Zone + Masqué).
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Demande_client::with(['client', 'zone'])->latest();

        // 1. CLOISONNEMENT TERRITORIAL POUR LE RESPONSABLE DE ZONE
        if ($user->isResponsableZone()) {
            if (! $user->zone_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Aucune zone géographique n\'est assignée à votre profil de Responsable de zone.',
                ], 403);
            }

            $userZone = $user->zone;
            $commune = $userZone?->commune;

            $query->where(function ($q) use ($user, $commune) {
                $q->where('zone_id', $user->zone_id);
                if ($commune) {
                    $q->orWhere('target_commune', 'ILIKE', '%' . $commune . '%');
                }
            });
        }

        // 2. Filtres optionnels
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('property_type')) {
            $query->where('property_type', $request->input('property_type'));
        }
        if ($request->filled('transaction_type')) {
            $query->where('transaction_type', $request->input('transaction_type'));
        }
        if ($request->filled('zone_id')) {
            $query->where('zone_id', $request->input('zone_id'));
        }
        if ($request->filled('commune')) {
            $query->where('target_commune', 'ILIKE', '%' . $request->input('commune') . '%');
        }

        $perPage = (int) $request->input('per_page', 20);
        $demandes = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Demandes clients récupérées avec succès (application des règles de masquage).',
            'data' => DemandeClientResource::collection($demandes)->response()->getData(true),
        ]);
    }

    /**
     * Fiche détaillée d'une demande client avec protection Anti-IDOR.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $demande = Demande_client::with(['client', 'zone'])->findOrFail($id);

        // PROTECTION ANTI-IDOR : Le Responsable de zone ne peut pas consulter un dossier hors de son secteur
        if ($user->isResponsableZone()) {
            $userZone = $user->zone;
            $commune = $userZone?->commune;

            $isSameZone = ($demande->zone_id && $demande->zone_id === $user->zone_id);
            $isSameCommune = ($commune && str_contains(strtolower($demande->target_commune), strtolower($commune)));

            if (! $isSameZone && ! $isSameCommune) {
                return response()->json([
                    'success' => false,
                    'message' => 'Accès refusé (Anti-IDOR) : Ce dossier relève d\'un secteur géographique en dehors de votre zone d\'affectation.',
                ], 403);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Détail de la demande client récupéré avec succès.',
            'data' => new DemandeClientResource($demande),
        ]);
    }
}

