<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Http\Requests\PostRechercheRequest;
use App\Http\Requests\UpdatePostRechercheRequest;
use App\Models\Demande_client;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PosteRechercheController extends Controller
{
    /**
     * Permet à un client de publier une demande de recherche de bien immobilier.
     */
    public function posteDemandeRecherche(PostRechercheRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Utilisateur non authentifié.',
            ], 401);
        }

        // Seuls les clients (ou administrateurs) peuvent poster des demandes de recherche
        if ($user->hasRole('Agent mobilier') && ! $user->hasRole('Client') && ! $user->isAnyAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Seuls les clients sont autorisés à publier des demandes de recherche de biens.',
            ], 403);
        }

        try {
            $demande = Demande_client::create([
                'client_id' => $user->id,
                'property_type' => $request->input('property_type'),
                'transaction_type' => $request->input('transaction_type'),
                'target_commune' => $request->input('target_commune'),
                'target_arrondissement' => $request->input('target_arrondissement'),
                'target_quartier' => $request->input('target_quartier'),
                'budget_max' => $request->input('budget_max'),
                'criteria_details' => $request->input('criteria_details'),
                'is_paid' => false,
                'status' => 'active',
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Demande de recherche de bien immobilier enregistrée avec succès.',
                'data' => $demande,
            ], 201);
        } catch (Exception $e) {
            Log::error('Erreur lors de la publication de la demande de recherche : ' . $e->getMessage(), [
                'user_id' => $user->id,
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Une erreur est survenue lors de l\'enregistrement de votre demande.',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Alias standard REST pour la création d'une demande.
     */
    public function store(PostRechercheRequest $request): JsonResponse
    {
        return $this->posteDemandeRecherche($request);
    }

    /**
     * Permet à un client de modifier l'une de ses demandes de recherche.
     */
    public function modifierDemande(UpdatePostRechercheRequest $request, int|string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Utilisateur non authentifié.',
            ], 401);
        }

        $demande = Demande_client::find($id);

        if (! $demande) {
            return response()->json([
                'success' => false,
                'message' => 'Demande de recherche introuvable.',
            ], 404);
        }

        // Vérification des droits de propriété : seul l'auteur ou l'administrateur peut modifier
        if ($demande->client_id !== $user->id && ! $user->isAnyAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Vous n\'êtes pas autorisé à modifier cette demande de recherche.',
            ], 403);
        }

        try {
            $dataToUpdate = [];
            foreach (['property_type', 'transaction_type', 'target_commune', 'budget_max', 'status'] as $requiredField) {
                if ($request->has($requiredField) && $request->input($requiredField) !== null) {
                    $dataToUpdate[$requiredField] = $request->input($requiredField);
                }
            }
            foreach (['target_arrondissement', 'target_quartier', 'criteria_details'] as $nullableField) {
                if ($request->exists($nullableField)) {
                    $dataToUpdate[$nullableField] = $request->input($nullableField);
                }
            }

            // Seul un administrateur peut modifier le flag is_paid directement
            if ($request->has('is_paid') && $user->isAnyAdmin()) {
                $dataToUpdate['is_paid'] = $request->boolean('is_paid');
            }

            $demande->update($dataToUpdate);

            return response()->json([
                'success' => true,
                'message' => 'Demande de recherche mise à jour avec succès.',
                'data' => $demande->fresh(['matchedPropriete:id,type,transaction_type,commune,arrondissement,quartier,prix,status']),
            ], 200);
        } catch (Exception $e) {
            Log::error('Erreur lors de la mise à jour de la demande de recherche : ' . $e->getMessage(), [
                'demande_id' => $id,
                'user_id' => $user->id,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Une erreur est survenue lors de la mise à jour de votre demande.',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Alias standard REST pour la mise à jour d'une demande.
     */
    public function update(UpdatePostRechercheRequest $request, int|string $id): JsonResponse
    {
        return $this->modifierDemande($request, $id);
    }

    /**
     * Permet à un client de consulter la liste de ses propres demandes de recherche.
     */
    public function mesDemandes(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Utilisateur non authentifié.',
            ], 401);
        }

        $query = Demande_client::with(['matchedPropriete:id,type,transaction_type,commune,arrondissement,quartier,prix,status'])
            ->where('client_id', $user->id)
            ->latest();

        // Filtre optionnel par statut (active, fulfilled, closed)
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        // Filtre optionnel par type de bien (parcelle, maison, chambre)
        if ($request->filled('property_type')) {
            $query->where('property_type', $request->input('property_type'));
        }

        // Filtre optionnel par type de transaction (location, vente)
        if ($request->filled('transaction_type')) {
            $query->where('transaction_type', $request->input('transaction_type'));
        }

        // Filtre optionnel par commune
        if ($request->filled('target_commune') || $request->filled('commune')) {
            $commune = $request->input('target_commune', $request->input('commune'));
            $like = \Illuminate\Support\Facades\DB::connection()->getDriverName() === 'pgsql' ? 'ILIKE' : 'LIKE';
            $query->where('target_commune', $like, '%' . $commune . '%');
        }

        // Recherche libre dans les demandes du client
        if ($request->filled('search')) {
            $term = '%' . trim((string) $request->input('search')) . '%';
            $like = \Illuminate\Support\Facades\DB::connection()->getDriverName() === 'pgsql' ? 'ILIKE' : 'LIKE';
            $query->where(function ($q) use ($term, $like) {
                $q->where('target_commune', $like, $term)
                    ->orWhere('target_arrondissement', $like, $term)
                    ->orWhere('target_quartier', $like, $term)
                    ->orWhere('criteria_details', $like, $term);
            });
        }

        $perPage = (int) $request->input('per_page', 15);
        $demandes = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Liste de vos demandes de recherche récupérée avec succès.',
            'data' => $demandes,
        ], 200);
    }

    /**
     * Alias standard REST pour la liste des demandes de l'utilisateur.
     */
    public function index(Request $request): JsonResponse
    {
        return $this->mesDemandes($request);
    }

    /**
     * Permet à un client de consulter les détails d'une de ses demandes de recherche.
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

        $demande = Demande_client::with(['matchedPropriete:id,type,transaction_type,commune,arrondissement,quartier,prix,status'])->find($id);

        if (! $demande) {
            return response()->json([
                'success' => false,
                'message' => 'Demande de recherche introuvable.',
            ], 404);
        }

        if ($demande->client_id !== $user->id && ! $user->isAnyAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Vous n\'êtes pas autorisé à consulter cette demande de recherche.',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'message' => 'Détails de la demande de recherche récupérés avec succès.',
            'data' => $demande,
        ], 200);
    }

    /**
     * Permet à un client de supprimer l'une de ses demandes de recherche.
     */
    public function supprimerDemande(Request $request, int|string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Utilisateur non authentifié.',
            ], 401);
        }

        $demande = Demande_client::find($id);

        if (! $demande) {
            return response()->json([
                'success' => false,
                'message' => 'Demande de recherche introuvable.',
            ], 404);
        }

        // Vérification des droits : seul l'auteur ou l'administrateur peut supprimer
        if ($demande->client_id !== $user->id && ! $user->isAnyAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Vous n\'êtes pas autorisé à supprimer cette demande de recherche.',
            ], 403);
        }

        try {
            $demande->delete();

            return response()->json([
                'success' => true,
                'message' => 'Demande de recherche supprimée avec succès.',
            ], 200);
        } catch (Exception $e) {
            Log::error('Erreur lors de la suppression de la demande de recherche : ' . $e->getMessage(), [
                'demande_id' => $id,
                'user_id' => $user->id,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Une erreur est survenue lors de la suppression de la demande.',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Alias standard REST pour la suppression d'une demande.
     */
    public function destroy(Request $request, int|string $id): JsonResponse
    {
        return $this->supprimerDemande($request, $id);
    }
}
