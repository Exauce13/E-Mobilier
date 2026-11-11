<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Visite_client;
use App\Services\AuditService;
use App\Services\Notifications\MultiChannelNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VisitOperationalController extends Controller
{
    /**
     * Planifie la visite physique (date, heure, consignes).
     */
    public function planifier(Request $request, int $id, MultiChannelNotificationService $notificationService): JsonResponse
    {
        $user = $request->user();
        $visite = Visite_client::with(['client', 'property'])->findOrFail($id);

        // Anti-IDOR pour Responsable de zone
        if ($user->isResponsableZone() && ! $user->isSuperAdminPrincipal() && ! $user->isSuperAdminTechnique()) {
            if ($visite->zone_id !== $user->zone_id) {
                return response()->json(['success' => false, 'message' => 'Accès interdit : visite hors de votre zone.'], 403);
            }
        }

        $validated = $request->validate([
            'scheduled_date' => ['required', 'date', 'after:now'],
            'instructions_itineraire' => ['nullable', 'string', 'max:500'],
            'target_agent_id' => ['nullable', 'exists:users,id'],
        ]);

        $visite->update([
            'scheduled_date' => $validated['scheduled_date'],
            'instructions_itineraire' => $validated['instructions_itineraire'] ?? null,
            'target_agent_id' => $validated['target_agent_id'] ?? $visite->target_agent_id,
            'status' => 'confirmed',
        ]);

        AuditService::log('visite_planifiee', $visite, [
            'planificateur_id' => $user->id,
            'date_visite' => $validated['scheduled_date'],
        ]);

        // Convocation du client
        if ($visite->client) {
            $notificationService->dispatchWithFallback(
                canal: 'sms',
                filePriorite: 'notifications-paiement',
                destinataireType: 'client',
                destinataireIdentifiant: $visite->client->telephone ?? $visite->client->email,
                sujet: 'Visite programmée',
                contenuPublic: "Votre visite pour le bien #{$visite->property_id} est confirmée pour le {$visite->scheduled_date->format('d/m/Y à H:i')}. Instructions: {$visite->instructions_itineraire}",
                userId: $visite->client_id,
                referenceEvenement: "VIS-{$visite->id}"
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'La visite a été planifiée avec succès et la convocation a été transmise au client.',
            'visite' => $visite,
        ]);
    }

    /**
     * Saisit le compte-rendu après réalisation de la visite sur le terrain.
     */
    public function compteRendu(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $visite = Visite_client::findOrFail($id);

        if ($user->isResponsableZone() && ! $user->isSuperAdminPrincipal() && ! $user->isSuperAdminTechnique()) {
            if ($visite->zone_id !== $user->zone_id) {
                return response()->json(['success' => false, 'message' => 'Accès interdit : visite hors de votre zone.'], 403);
            }
        }

        $validated = $request->validate([
            'compte_rendu' => ['required', 'string', 'min:10', 'max:2000'],
        ]);

        $visite->update([
            'compte_rendu' => $validated['compte_rendu'],
            'status' => 'completed',
        ]);

        AuditService::log('visite_compte_rendu_saisi', $visite, [
            'agent_id' => $user->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Compte-rendu de visite consigné avec succès.',
            'visite' => $visite,
        ]);
    }

    /**
     * Clôture formelle du dossier de visite.
     */
    public function cloturer(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $visite = Visite_client::findOrFail($id);

        if ($user->isResponsableZone() && ! $user->isSuperAdminPrincipal() && ! $user->isSuperAdminTechnique()) {
            if ($visite->zone_id !== $user->zone_id) {
                return response()->json(['success' => false, 'message' => 'Accès interdit : visite hors de votre zone.'], 403);
            }
        }

        $validated = $request->validate([
            'issue' => ['required', 'string', 'in:succes_offre,sans_suite,client_absent,autre'],
            'motif' => ['nullable', 'string', 'max:500'],
        ]);

        $visite->update([
            'issue_cloture' => $validated['issue'],
            'status' => $validated['issue'] === 'client_absent' ? 'cancelled' : 'completed',
        ]);

        AuditService::log('visite_cloturee', $visite, [
            'gestionnaire_id' => $user->id,
            'issue' => $validated['issue'],
            'motif' => $validated['motif'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Dossier de visite clôturé avec succès.',
            'visite' => $visite,
        ]);
    }

    /**
     * Escalade commerciale majeure : Notifie Justin MAGNIDE pour négociation directe de l'offre.
     */
    public function escaladerOffre(Request $request, int $id, MultiChannelNotificationService $notificationService): JsonResponse
    {
        $user = $request->user();
        $visite = Visite_client::with(['client', 'property'])->findOrFail($id);

        if ($user->isResponsableZone() && ! $user->isSuperAdminPrincipal() && ! $user->isSuperAdminTechnique()) {
            if ($visite->zone_id !== $user->zone_id) {
                return response()->json(['success' => false, 'message' => 'Accès interdit : visite hors de votre zone.'], 403);
            }
        }

        $validated = $request->validate([
            'commentaires' => ['required', 'string', 'min:5', 'max:1000'],
            'offre_montant' => ['nullable', 'numeric', 'min:1'],
        ]);

        $visite->update([
            'is_escalade_haute' => true,
            'offre_montant' => $validated['offre_montant'] ?? null,
        ]);

        // Notification critique instantanée vers Justin MAGNIDE
        $details = "Offre formulée sur visite #{$visite->id} (Bien #{$visite->property_id} à {$visite->property?->commune}). ";
        if (! empty($validated['offre_montant'])) {
            $details .= "Montant proposé : {$validated['offre_montant']} FCFA. ";
        }
        $details .= "Note agent: {$validated['commentaires']}";

        $notificationService->notifierAlerteSecurite(
            'NÉGOCIATION_HAUTE_OFFRE_ACHAT',
            $details
        );

        AuditService::securityAlert('ESCALADE_OFFRE_ACHAT', "Offre d'achat majeure escaladée vers M. Justin MAGNIDE sur la visite #{$visite->id}", [
            'escalade_par' => $user->id,
            'offre_montant' => $validated['offre_montant'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Dossier escaladé avec succès en NÉGOCIATION_HAUTE. M. Justin MAGNIDE a été alerté directement.',
            'visite' => $visite,
        ]);
    }
}

