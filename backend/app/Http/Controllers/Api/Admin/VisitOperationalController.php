<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\VisiteClientResource;
use App\Models\User;
use App\Models\Visite_client;
use App\Services\AuditService;
use App\Services\Notifications\MultiChannelNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VisitOperationalController extends Controller
{
    /**
     * Planifie ou replanifie la visite physique (date, heure, consignes de rendez-vous) et la passe en 'confirmed'.
     */
    public function planifier(Request $request, int $id, MultiChannelNotificationService $notificationService): JsonResponse
    {
        $user = $request->user();
        $visite = Visite_client::with(['client', 'propriete.zone', 'propriete.media', 'agentAssigne', 'zone'])->findOrFail($id);

        if (! $this->canAccessVisite($user, $visite)) {
            return response()->json(['success' => false, 'message' => 'Accès interdit : visite hors de votre zone.'], 403);
        }

        if (! in_array($visite->status, ['pending', 'confirmed'], true)) {
            return response()->json([
                'success' => false,
                'message' => "Transition interdite : impossible de planifier une visite au statut '{$visite->status}'.",
            ], 422);
        }

        $validated = $request->validate([
            'scheduled_date' => ['required', 'date', 'after:now'],
            'instructions_itineraire' => ['nullable', 'string', 'max:500'],
            'target_agent_id' => ['nullable', 'exists:users,id'],
        ]);

        $ancienStatut = $visite->status;

        $visite->update([
            'scheduled_date' => $validated['scheduled_date'],
            'instructions_itineraire' => $validated['instructions_itineraire'] ?? $visite->instructions_itineraire,
            'target_agent_id' => $validated['target_agent_id'] ?? $visite->target_agent_id,
            'status' => 'confirmed',
        ]);

        AuditService::log('visite_planifiee', $visite, [
            'ancien_statut' => $ancienStatut,
            'nouveau_statut' => 'confirmed',
            'planificateur_id' => $user->id,
            'date_visite' => $validated['scheduled_date'],
            'instructions_itineraire' => $validated['instructions_itineraire'] ?? null,
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

        $fresh = $visite->fresh(['client', 'propriete.zone', 'propriete.media', 'agentAssigne', 'zone']);

        return response()->json([
            'success' => true,
            'message' => 'La visite a été planifiée avec succès et la convocation a été transmise au client.',
            'visite' => new VisiteClientResource($fresh),
        ]);
    }

    /**
     * Saisit le compte-rendu après réalisation de la visite sur le terrain et passe le statut en 'completed'.
     */
    public function compteRendu(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $visite = Visite_client::with('propriete')->findOrFail($id);

        if (! $this->canAccessVisite($user, $visite)) {
            return response()->json(['success' => false, 'message' => 'Accès interdit : visite hors de votre zone.'], 403);
        }

        if ($visite->status !== 'confirmed') {
            return response()->json([
                'success' => false,
                'message' => "Transition interdite : un compte-rendu terrain ne peut être saisi que sur une visite confirmée/programmée (statut actuel : '{$visite->status}').",
            ], 422);
        }

        $validated = $request->validate([
            'compte_rendu' => ['required', 'string', 'min:10', 'max:2000'],
        ]);

        $ancienStatut = $visite->status;

        $visite->update([
            'compte_rendu' => $validated['compte_rendu'],
            'status' => 'completed',
        ]);

        AuditService::log('visite_compte_rendu_saisi', $visite, [
            'ancien_statut' => $ancienStatut,
            'nouveau_statut' => 'completed',
            'agent_id' => $user->id,
        ]);

        $fresh = $visite->fresh(['client', 'propriete.zone', 'propriete.media', 'agentAssigne', 'zone']);

        return response()->json([
            'success' => true,
            'message' => 'Compte-rendu de visite consigné avec succès.',
            'visite' => new VisiteClientResource($fresh),
        ]);
    }

    /**
     * Clôture formelle du dossier de visite avec enregistrement de l'issue.
     */
    public function cloturer(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $visite = Visite_client::with('propriete')->findOrFail($id);

        if (! $this->canAccessVisite($user, $visite)) {
            return response()->json(['success' => false, 'message' => 'Accès interdit : visite hors de votre zone.'], 403);
        }

        if ($visite->status === 'cancelled') {
            return response()->json([
                'success' => false,
                'message' => 'Transition interdite : impossible de clôturer une visite déjà annulée.',
            ], 422);
        }

        if (! empty($visite->issue_cloture)) {
            return response()->json([
                'success' => false,
                'message' => "Ce dossier de visite a déjà été clôturé (issue : {$visite->issue_cloture}).",
            ], 422);
        }

        $validated = $request->validate([
            'issue' => ['required', 'string', 'in:succes_offre,sans_suite,client_absent,autre'],
            'motif' => ['nullable', 'string', 'max:500'],
        ]);

        $ancienStatut = $visite->status;
        $nouveauStatut = $validated['issue'] === 'client_absent' ? 'cancelled' : 'completed';

        if (! $visite->canTransitionTo($nouveauStatut)) {
            return response()->json([
                'success' => false,
                'message' => "Transition interdite de '{$ancienStatut}' vers '{$nouveauStatut}'.",
            ], 422);
        }

        $visite->update([
            'issue_cloture' => $validated['issue'],
            'status' => $nouveauStatut,
        ]);

        AuditService::log('visite_cloturee', $visite, [
            'ancien_statut' => $ancienStatut,
            'nouveau_statut' => $nouveauStatut,
            'gestionnaire_id' => $user->id,
            'issue' => $validated['issue'],
            'motif' => $validated['motif'] ?? null,
        ]);

        $fresh = $visite->fresh(['client', 'propriete.zone', 'propriete.media', 'agentAssigne', 'zone']);

        return response()->json([
            'success' => true,
            'message' => 'Dossier de visite clôturé avec succès.',
            'visite' => new VisiteClientResource($fresh),
        ]);
    }

    /**
     * Escalade commerciale majeure : Notifie Justin MAGNIDE pour négociation directe de l'offre.
     */
    public function escaladerOffre(Request $request, int $id, MultiChannelNotificationService $notificationService): JsonResponse
    {
        $user = $request->user();
        $visite = Visite_client::with(['client', 'propriete'])->findOrFail($id);

        if (! $this->canAccessVisite($user, $visite)) {
            return response()->json(['success' => false, 'message' => 'Accès interdit : visite hors de votre zone.'], 403);
        }

        if (! in_array($visite->status, ['confirmed', 'completed'], true)) {
            return response()->json([
                'success' => false,
                'message' => "Impossible d'escalader une offre sur une visite au statut '{$visite->status}'.",
            ], 422);
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
        $details = "Offre formulée sur visite #{$visite->id} (Bien #{$visite->property_id} à {$visite->propriete?->commune}). ";
        if (! empty($validated['offre_montant'])) {
            $details .= "Montant proposé : {$validated['offre_montant']} FCFA. ";
        }
        $details .= "Note agent: {$validated['commentaires']}";

        $notificationService->notifierAlerteSecurite(
            'NÉGOCIATION_HAUTE_OFFRE_ACHAT',
            $details
        );

        AuditService::log('visite_offre_escaladee', $visite, [
            'escalade_par' => $user->id,
            'offre_montant' => $validated['offre_montant'] ?? null,
            'commentaires' => $validated['commentaires'],
        ]);

        AuditService::securityAlert('ESCALADE_OFFRE_ACHAT', "Offre d'achat majeure escaladée vers M. Justin MAGNIDE sur la visite #{$visite->id}", [
            'escalade_par' => $user->id,
            'offre_montant' => $validated['offre_montant'] ?? null,
        ]);

        $fresh = $visite->fresh(['client', 'propriete.zone', 'propriete.media', 'agentAssigne', 'zone']);

        return response()->json([
            'success' => true,
            'message' => 'Dossier escaladé avec succès en NÉGOCIATION_HAUTE. M. Justin MAGNIDE a été alerté directement.',
            'visite' => new VisiteClientResource($fresh),
        ]);
    }

    protected function canAccessVisite(User $user, Visite_client $visite): bool
    {
        if (! $user->isResponsableZone() || $user->isSuperAdminPrincipal() || $user->isSuperAdminTechnique()) {
            return true;
        }

        $userZoneId = $user->zone_id;
        $propZoneId = $visite->propriete?->zone_id;
        $visiteZoneId = $visite->zone_id;
        $isAssigned = (int) $visite->target_agent_id === (int) $user->id;
        $commune = $user->zone?->commune;
        $isSameCommune = $commune && $visite->propriete?->commune
            && str_contains(mb_strtolower($visite->propriete->commune), mb_strtolower($commune));

        return $visiteZoneId === $userZoneId || $propZoneId === $userZoneId || $isAssigned || $isSameCommune;
    }
}
