<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Demande_client;
use App\Models\Proprietes;
use App\Services\AuditService;
use App\Services\Notifications\MultiChannelNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchRequestMatchingController extends Controller
{
    /**
     * Assigne formellement la demande de recherche à l'administrateur connecté.
     */
    public function prendreEnCharge(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $demande = Demande_client::findOrFail($id);

        if ($user->isResponsableZone() && ! $user->isSuperAdminPrincipal() && ! $user->isSuperAdminTechnique()) {
            if ($demande->zone_id !== $user->zone_id) {
                return response()->json(['success' => false, 'message' => 'Accès interdit : demande hors de votre zone.'], 403);
            }
        }

        $demande->update([
            'gestionnaire_id' => $user->id,
        ]);

        AuditService::log('demande_recherche_prise_en_charge', $demande, [
            'gestionnaire_id' => $user->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Dossier de recherche pris en charge avec succès.',
            'demande' => $demande,
        ]);
    }

    /**
     * Algorithme multicritères de rapprochement (Matching Engine) entre la demande et le catalogue.
     */
    public function matchingBiens(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $demande = Demande_client::findOrFail($id);

        if ($user->isResponsableZone() && ! $user->isSuperAdminPrincipal() && ! $user->isSuperAdminTechnique()) {
            if ($demande->zone_id !== $user->zone_id) {
                return response()->json(['success' => false, 'message' => 'Accès interdit : demande hors de votre zone.'], 403);
            }
        }

        // Biens publiés actifs
        $biens = Proprietes::with('zone')
            ->where('status', 'published')
            ->get();

        $resultats = [];

        foreach ($biens as $bien) {
            $score = 0;

            // 1. Type de bien (30%)
            if (strtolower($bien->type) === strtolower($demande->property_type)) {
                $score += 30;
            }

            // 2. Type de transaction (20%)
            if (strtolower($bien->transaction_type) === strtolower($demande->transaction_type)) {
                $score += 20;
            }

            // 3. Commune / Localisation (25%)
            if (str_contains(strtolower($bien->commune), strtolower($demande->target_commune))
                || str_contains(strtolower($demande->target_commune), strtolower($bien->commune))) {
                $score += 25;
            }

            // 4. Respect du budget plafond (25%)
            if ((float) $bien->prix <= (float) $demande->budget_max) {
                $score += 25;
            }

            // Retenir si score >= 40%
            if ($score >= 40) {
                $resultats[] = [
                    'propriete_id' => $bien->id,
                    'type' => $bien->type,
                    'transaction_type' => $bien->transaction_type,
                    'commune' => $bien->commune,
                    'arrondissement' => $bien->arrondissement,
                    'quartier' => $bien->quartier,
                    'prix' => (float) $bien->prix,
                    'surface' => (float) $bien->surface,
                    'zone' => $bien->zone?->nom,
                    'score_matching_pourcentage' => $score,
                ];
            }
        }

        // Tri par score décroissant
        usort($resultats, fn ($a, $b) => $b['score_matching_pourcentage'] <=> $a['score_matching_pourcentage']);

        return response()->json([
            'success' => true,
            'demande_id' => $demande->id,
            'criteres_recherche' => [
                'type' => $demande->property_type,
                'transaction' => $demande->transaction_type,
                'commune' => $demande->target_commune,
                'budget_max' => (float) $demande->budget_max,
            ],
            'total_biens_compatibles' => count($resultats),
            'biens_suggeres' => $resultats,
        ]);
    }

    /**
     * Associe formellement un bien au dossier client et expédie une notification.
     */
    public function associerBien(Request $request, int $id, MultiChannelNotificationService $notificationService): JsonResponse
    {
        $user = $request->user();
        $demande = Demande_client::with('client')->findOrFail($id);

        if ($user->isResponsableZone() && ! $user->isSuperAdminPrincipal() && ! $user->isSuperAdminTechnique()) {
            if ($demande->zone_id !== $user->zone_id) {
                return response()->json(['success' => false, 'message' => 'Accès interdit : demande hors de votre zone.'], 403);
            }
        }

        $validated = $request->validate([
            'propriete_id' => ['required', 'exists:proprietes,id'],
        ]);

        $propriete = Proprietes::findOrFail($validated['propriete_id']);

        $demande->update([
            'matched_propriete_id' => $propriete->id,
        ]);

        AuditService::log('demande_recherche_bien_associe', $demande, [
            'gestionnaire_id' => $user->id,
            'propriete_id' => $propriete->id,
        ]);

        // Envoi d'une notification de proposition au client
        if ($demande->client) {
            $notificationService->dispatchWithFallback(
                canal: 'sms',
                filePriorite: 'notifications-paiement',
                destinataireType: 'client',
                destinataireIdentifiant: $demande->client->telephone ?? $demande->client->email,
                sujet: 'Nouvelle opportunité immobilière',
                contenuPublic: "E-MOBILIER : Un bien correspondant à votre recherche a été sélectionné pour vous (#{$propriete->id} - {$propriete->type} à {$propriete->commune}). Consultez votre espace pour planifier une visite.",
                userId: $demande->client_id,
                referenceEvenement: "DEM-{$demande->id}"
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Le bien a été rattaché à la demande et le client a été notifié.',
            'demande' => $demande,
        ]);
    }

    /**
     * Clôture formelle de la demande de recherche.
     */
    public function cloturer(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $demande = Demande_client::findOrFail($id);

        if ($user->isResponsableZone() && ! $user->isSuperAdminPrincipal() && ! $user->isSuperAdminTechnique()) {
            if ($demande->zone_id !== $user->zone_id) {
                return response()->json(['success' => false, 'message' => 'Accès interdit : demande hors de votre zone.'], 403);
            }
        }

        $validated = $request->validate([
            'motif_cloture' => ['required', 'string', 'in:satisfaite,abandonnee_client,delai_depasse'],
        ]);

        $demande->update([
            'status' => 'closed',
            'motif_cloture' => $validated['motif_cloture'],
        ]);

        AuditService::log('demande_recherche_cloturee', $demande, [
            'gestionnaire_id' => $user->id,
            'motif_cloture' => $validated['motif_cloture'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Demande de recherche clôturée avec succès.',
            'demande' => $demande,
        ]);
    }
}
