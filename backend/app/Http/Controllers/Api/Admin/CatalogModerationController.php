<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Proprietes;
use App\Services\AuditService;
use App\Services\Notifications\MultiChannelNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CatalogModerationController extends Controller
{
    /**
     * Liste les biens soumis en attente de modération.
     * Filtrage territorial automatique si Responsable de zone.
     */
    public function enAttente(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Proprietes::with(['user:id,name,prenom,email,telephone', 'zone:id,nom', 'documents'])
            ->whereIn('status', ['pending', 'pending_payment'])
            ->latest();

        // Scope territorial Anti-IDOR pour Responsable de zone
        if ($user->isResponsableZone() && ! $user->isSuperAdminPrincipal() && ! $user->isSuperAdminTechnique()) {
            $query->where('zone_id', $user->zone_id);
        }

        $biens = $query->paginate($request->integer('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $biens->items(),
            'pagination' => [
                'current_page' => $biens->currentPage(),
                'last_page' => $biens->lastPage(),
                'per_page' => $biens->perPage(),
                'total' => $biens->total(),
            ],
        ]);
    }

    /**
     * Valide la publication de l'annonce dans le catalogue public.
     */
    public function valider(Request $request, int $id, MultiChannelNotificationService $notificationService): JsonResponse
    {
        $user = $request->user();

        // Super Admins et Secrétaire uniquement
        if (! $user->isSuperAdminPrincipal() && ! $user->isSuperAdminTechnique() && ! $user->isSecretaire()) {
            return response()->json(['success' => false, 'message' => 'Action non autorisée.'], 403);
        }

        $propriete = Proprietes::findOrFail($id);
        $propriete->update([
            'status' => 'published',
            'motif_rejet' => null,
        ]);

        AuditService::log('moderation_propriete_validee', $propriete, [
            'moderateur_id' => $user->id,
            'statut_precedent' => 'pending',
            'nouveau_statut' => 'published',
        ]);

        // Notification du créateur du bien
        if ($propriete->user) {
            $notificationService->dispatchWithFallback(
                canal: 'push',
                filePriorite: 'notifications-paiement',
                destinataireType: 'agent',
                destinataireIdentifiant: $propriete->user->telephone ?? $propriete->user->email,
                sujet: 'Annonce validée et publiée',
                contenuPublic: "Votre bien #{$propriete->id} ({$propriete->type} à {$propriete->commune}) a été validé et est désormais visible en ligne.",
                userId: $propriete->user_id,
                referenceEvenement: "PROP-{$propriete->id}"
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'L\'annonce a été validée et est désormais visible dans le catalogue public.',
            'propriete' => $propriete,
        ]);
    }

    /**
     * Rejette la publication de l'annonce avec motif obligatoire.
     */
    public function rejeter(Request $request, int $id, MultiChannelNotificationService $notificationService): JsonResponse
    {
        $user = $request->user();

        if (! $user->isSuperAdminPrincipal() && ! $user->isSuperAdminTechnique() && ! $user->isSecretaire()) {
            return response()->json(['success' => false, 'message' => 'Action non autorisée.'], 403);
        }

        $validated = $request->validate([
            'motif' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        $propriete = Proprietes::findOrFail($id);
        $propriete->update([
            'status' => 'rejected',
            'motif_rejet' => $validated['motif'],
        ]);

        AuditService::log('moderation_propriete_rejetee', $propriete, [
            'moderateur_id' => $user->id,
            'motif' => $validated['motif'],
        ]);

        if ($propriete->user) {
            $notificationService->dispatchWithFallback(
                canal: 'sms',
                filePriorite: 'notifications-paiement',
                destinataireType: 'agent',
                destinataireIdentifiant: $propriete->user->telephone ?? $propriete->user->email,
                sujet: 'Publication refusée',
                contenuPublic: "Votre annonce #{$propriete->id} a été rejetée. Motif: {$validated['motif']}",
                userId: $propriete->user_id,
                referenceEvenement: "PROP-{$propriete->id}"
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'L\'annonce a été rejetée avec succès.',
            'propriete' => $propriete,
        ]);
    }

    /**
     * Marque le bien comme vendu ou loué et le retire du fil public.
     */
    public function marquerConclu(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $propriete = Proprietes::findOrFail($id);

        // Anti-IDOR pour Responsable de zone
        if ($user->isResponsableZone() && ! $user->isSuperAdminPrincipal() && ! $user->isSuperAdminTechnique()) {
            if ($propriete->zone_id !== $user->zone_id) {
                return response()->json(['success' => false, 'message' => 'Accès interdit : ce bien n\'appartient pas à votre zone géographique.'], 403);
            }
        }

        $propriete->update(['status' => 'sold_rented']);

        AuditService::log('propriete_marquage_conclu', $propriete, [
            'gestionnaire_id' => $user->id,
            'statut' => 'sold_rented',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Le bien a été marqué comme conclu (vendu/loué) et retiré de la publication active.',
            'propriete' => $propriete,
        ]);
    }

    /**
     * Consultation sécurisée des documents fonciers (Titres fonciers, attestations).
     */
    public function documents(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        if (! $user->isSuperAdminPrincipal() && ! $user->isSuperAdminTechnique() && ! $user->isSecretaire()) {
            return response()->json(['success' => false, 'message' => 'Accès réservé aux auditeurs légaux et administrateurs autorisés.'], 403);
        }

        $propriete = Proprietes::with('documents')->findOrFail($id);

        $documents = $propriete->documents->map(function ($doc) {
            return [
                'id' => $doc->id,
                'type' => $doc->document_type,
                'nom' => basename($doc->document_url),
                'url_consultation' => $doc->document_url,
                'created_at' => $doc->created_at->toIso8601String(),
            ];
        });

        return response()->json([
            'success' => true,
            'propriete_id' => $propriete->id,
            'documents' => $documents,
        ]);
    }
}
