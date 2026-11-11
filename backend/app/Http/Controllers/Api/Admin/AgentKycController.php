<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Proprietes;
use App\Models\User;
use App\Services\AuditService;
use App\Services\Notifications\MultiChannelNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AgentKycController extends Controller
{
    /**
     * Annuaire des agents mobiliers partenaires avec statut KYC.
     */
    public function index(Request $request): JsonResponse
    {
        $query = User::role('Agent mobilier')
            ->with('zone')
            ->latest();

        if ($request->filled('statut')) {
            $query->where('statut', $request->query('statut'));
        }

        if ($request->has('verifie')) {
            $query->where('is_verifed', $request->boolean('verifie'));
        }

        $agents = $query->paginate($request->integer('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $agents->items(),
            'pagination' => [
                'current_page' => $agents->currentPage(),
                'last_page' => $agents->lastPage(),
                'per_page' => $agents->perPage(),
                'total' => $agents->total(),
            ],
        ]);
    }

    /**
     * Dossier détaillé de conformité et d'activité de l'agent.
     */
    public function dossier(int $id): JsonResponse
    {
        $agent = User::role('Agent mobilier')
            ->with(['zone', 'proprietes'])
            ->findOrFail($id);

        $totalBiens = $agent->proprietes->count();
        $biensPublies = $agent->proprietes->where('status', 'published')->count();
        $biensConclus = $agent->proprietes->where('status', 'sold_rented')->count();

        return response()->json([
            'success' => true,
            'agent' => [
                'id' => $agent->id,
                'nom_complet' => "{$agent->prenom} {$agent->name}",
                'email' => $agent->email,
                'telephone' => $agent->telephone,
                'statut' => $agent->statut,
                'is_verifed' => $agent->is_verifed,
                'zone' => $agent->zone?->nom,
                'date_inscription' => $agent->created_at->toIso8601String(),
            ],
            'statistiques_activite' => [
                'total_annonces' => $totalBiens,
                'annonces_en_ligne' => $biensPublies,
                'annonces_conclues' => $biensConclus,
            ],
        ]);
    }

    /**
     * Approuve l'agrément KYC de l'agent mobilier (is_verifed = true).
     */
    public function approuver(Request $request, int $id, MultiChannelNotificationService $notificationService): JsonResponse
    {
        $user = $request->user();

        if (! $user->isSuperAdminPrincipal() && ! $user->isSuperAdminTechnique() && ! $user->isSecretaire()) {
            return response()->json(['success' => false, 'message' => 'Action non autorisée.'], 403);
        }

        $agent = User::role('Agent mobilier')->findOrFail($id);
        $agent->update(['is_verifed' => true]);

        AuditService::log('kyc_agent_approuve', $agent, [
            'validateur_id' => $user->id,
        ]);

        $notificationService->dispatchWithFallback(
            canal: 'sms',
            filePriorite: 'notifications-paiement',
            destinataireType: 'agent',
            destinataireIdentifiant: $agent->telephone ?? $agent->email,
            sujet: 'Agrément KYC Validé',
            contenuPublic: 'Félicitations, votre dossier professionnel E-Mobilier a été validé. Vos annonces peuvent désormais être diffusées publiquement.',
            userId: $agent->id,
            referenceEvenement: "KYC-{$agent->id}"
        );

        return response()->json([
            'success' => true,
            'message' => 'Agrément de l\'agent validé avec succès. Les publications sont autorisées.',
            'agent' => $agent,
        ]);
    }

    /**
     * Suspend l'agent et applique la révocation en cascade sur l'ensemble de ses annonces en ligne.
     */
    public function suspendre(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        if (! $user->isSuperAdminPrincipal() && ! $user->isSuperAdminTechnique() && ! $user->isSecretaire()) {
            return response()->json(['success' => false, 'message' => 'Action non autorisée.'], 403);
        }

        $agent = User::role('Agent mobilier')->findOrFail($id);

        $agent->update([
            'statut' => 'suspendu',
            'is_verifed' => false,
        ]);

        // Révocation de toutes les sessions actives
        $agent->tokens()->delete();

        // RÉVOCATION & GEL EN CASCADE : Retrait atomique de toutes ses annonces en ligne
        $nbBiensSuspendus = Proprietes::where('user_id', $agent->id)
            ->where('status', 'published')
            ->update(['status' => 'pending']);

        AuditService::securityAlert('KYC_AGENT_SUSPENDU_AVEC_CASCADE', "Suspension de l'agent ID {$agent->id}. {$nbBiensSuspendus} annonce(s) en ligne déréférencée(s) immédiatement.", [
            'initiateur_id' => $user->id,
            'biens_retires' => $nbBiensSuspendus,
        ]);

        return response()->json([
            'success' => true,
            'message' => "L'agent a été suspendu avec succès. {$nbBiensSuspendus} annonce(s) ont été immédiatement retirées du catalogue public.",
            'agent' => $agent,
            'annonces_desactivees' => $nbBiensSuspendus,
        ]);
    }
}
