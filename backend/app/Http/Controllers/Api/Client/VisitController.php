<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Http\Requests\VisiteRequest;
use App\Models\Paiement;
use App\Models\Proprietes;
use App\Models\Visite_client;
use App\Services\KkiapayService;
use App\Services\PlatformSettingsService;
use App\Services\PushNotificationService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class VisitController extends Controller
{
    public function __construct(
        protected KkiapayService $kkiapayService,
        protected PushNotificationService $pushNotificationService,
        protected PlatformSettingsService $settings
    ) {
    }

    /**
     * Enregistre une nouvelle demande de visite physique après validation obligatoire du paiement de 500 FCFA.
     * RÈGLES DE MONOPOLE E-MOBILIER :
     * 1. Si le bien appartient à un client propriétaire : le client propriétaire n'en saura RIEN (target_agent_id = null).
     * 2. Si le bien appartient à un agent immobilier : target_agent_id = agent.
     * 3. Notifications push envoyées à l'Admin (détails complets) et à l'Agent (nom et prénom uniquement).
     */
    public function demandeVisite(VisiteRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Utilisateur non authentifié.',
            ], 401);
        }

        // L'utilisateur peut être un Client ou un Agent mobilier (tant que ce n'est pas son propre post)

        $propertyId = $request->input('property_id');
        $propriete = Proprietes::with('user')->find($propertyId);

        if (! $propriete || $propriete->status !== 'published') {
            return response()->json([
                'success' => false,
                'message' => 'Cette propriété n\'est pas disponible pour une visite.',
            ], 404);
        }

        // On ne peut pas demander de visite sur sa propre propriété
        if ($propriete->user_id === $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Vous ne pouvez pas demander de visite pour un bien dont vous êtes le propriétaire ou le gestionnaire.',
            ], 422);
        }

        // Frais obligatoires de visite physique (centralisés en BDD)
        $fraisVisite = (int) $this->settings->getTarifs()['visite'];
        $paymentReference = trim((string) ($request->input('payment_reference') ?: $request->input('reference') ?: ''));
        $transactionId = trim((string) ($request->input('kkiapay_transaction_id') ?: $request->input('transaction_id') ?: ''));

        // Rechercher un paiement déjà confirmé en base ou réconcilier S2S auprès de Kkiapay
        $candidatePayment = null;
        if ($paymentReference !== '') {
            $candidatePayment = Paiement::where('transaction_reference', $paymentReference)->first();
        }
        if (! $candidatePayment && $transactionId !== '') {
            $candidatePayment = Paiement::where('gateway_transaction_id', $transactionId)
                ->orWhere('transaction_reference', $transactionId)
                ->first();
        }

        if (! $candidatePayment || $candidatePayment->status !== 'successful') {
            if ($transactionId === '') {
                return response()->json([
                    'success' => false,
                    'message' => "Le paiement des frais de visite de {$fraisVisite} FCFA via Kkiapay est obligatoire avant que votre demande ne soit enregistrée.",
                ], 402);
            }

            $reconcile = app(\App\Http\Controllers\Api\Finance\PaymentController::class)->reconcilePayment(
                app(\App\Services\Gateways\PaymentGatewayManager::class)->gateway(),
                $transactionId,
                ['reference' => $paymentReference ?: null],
                $request->ip(),
                $user,
                false
            );

            if (empty($reconcile['success']) || empty($reconcile['paiement'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Le paiement des frais de visite de ' . $fraisVisite . ' FCFA via Kkiapay est obligatoire avant que votre demande ne soit enregistrée : ' . ($reconcile['message'] ?? 'Paiement non confirmé.'),
                ], $reconcile['status_code'] ?? 422);
            }

            $candidatePayment = $reconcile['paiement'];
        }

        try {
            $result = DB::transaction(function () use ($user, $propriete, $request, $fraisVisite, $candidatePayment) {
                $lockedPayment = Paiement::where('id', $candidatePayment->id)->lockForUpdate()->first();

                if (! $lockedPayment || $lockedPayment->status !== 'successful') {
                    return ['error' => ['status' => 402, 'message' => 'Paiement non confirmé côté serveur.']];
                }
                if ($lockedPayment->user_id !== $user->id) {
                    return ['error' => ['status' => 403, 'message' => 'Ce paiement appartient à un autre utilisateur.']];
                }
                if ($lockedPayment->payment_type !== 'visit_fee') {
                    return ['error' => ['status' => 422, 'message' => 'Ce paiement ne correspond pas à des frais de visite physique.']];
                }
                if ($lockedPayment->property_id !== null && (int) $lockedPayment->property_id !== (int) $propriete->id) {
                    return ['error' => ['status' => 422, 'message' => 'Ce paiement a été initié pour un autre bien immobilier.']];
                }
                if ((int) round((float) $lockedPayment->amount) !== $fraisVisite) {
                    return ['error' => ['status' => 422, 'message' => "Montant payé différent des frais de visite officiels ({$fraisVisite} FCFA)."]];
                }
                if ($lockedPayment->related_entity_id !== null) {
                    return ['error' => ['status' => 409, 'message' => 'Cette transaction Kkiapay a déjà été utilisée pour une autre visite.']];
                }

                // RÈGLE MONOPOLE E-MOBILIER :
                // Si le bien a été posté par un Agent immobilier, l'agent est assigné comme target_agent_id.
                // Si le bien a été posté par un simple Client, target_agent_id = null : E-Mobilier gère la visite en direct,
                // et le client propriétaire n'en saura absolument rien !
                $targetAgentId = null;
                if ($propriete->user && $propriete->user->hasRole('Agent mobilier')) {
                    $targetAgentId = $propriete->user_id;
                }

                // 1. Enregistrement de la visite
                $visite = Visite_client::create([
                    'client_id' => $user->id,
                    'property_id' => $propriete->id,
                    'target_agent_id' => $targetAgentId,
                    'scheduled_date' => $request->input('scheduled_date'),
                    'status' => 'pending',
                    'is_fee_paid' => true,
                ]);

                // 2. Liaison atomique du paiement confirmé à cette visite
                $lockedPayment->update([
                    'property_id' => $propriete->id,
                    'payment_type' => 'visit_fee',
                    'related_entity_id' => $visite->id,
                ]);

                return [
                    'visite' => $visite,
                    'paiement' => $lockedPayment->fresh(),
                ];
            });

            if (! empty($result['error'])) {
                return response()->json([
                    'success' => false,
                    'message' => $result['error']['message'],
                ], $result['error']['status']);
            }

            $visite = $result['visite'];
            $paiement = $result['paiement'];

            // 3. Déclenchement des notifications push pour l'Admin et l'Agent immobilier
            // (Le client propriétaire n'est pas notifié si c'est son bien)
            $this->pushNotificationService->notifyPhysicalVisitRequested($visite, $propriete, $user);

            return response()->json([
                'success' => true,
                'message' => "Votre demande de visite a été enregistrée avec succès suite à la confirmation de vos frais de visite ({$fraisVisite} FCFA).",
                'data' => [
                    'visite' => $visite->load(['propriete.media']),
                    'paiement' => $paiement,
                ],
            ], 201);
        } catch (Exception $e) {
            Log::error('Erreur lors de l\'enregistrement de la visite : ' . $e->getMessage(), [
                'user_id' => $user->id,
                'property_id' => $propriete->id,
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Une erreur est survenue lors de l\'enregistrement de votre demande de visite.',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Alias standard REST pour la création d'une visite.
     */
    public function store(VisiteRequest $request): JsonResponse
    {
        return $this->demandeVisite($request);
    }

    /**
     * Liste les visites selon le rôle et les règles strictes de monopole E-Mobilier :
     * - Admin : Voit TOUTES les demandes de visite avec TOUS les détails (contacts, montants, adresses).
     * - Agent mobilier : Voit juste qu'il a une demande, avec UNIQUEMENT le nom et prénom du demandeur (téléphone et email masqués).
     * - Client : Voit UNIQUEMENT ses propres demandes de visite (s'il est propriétaire d'un bien visité, il n'en sait RIEN).
     */
    public function mesVisites(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Utilisateur non authentifié.',
            ], 401);
        }

        $isAdmin = $user->isAnyAdmin();
        $isAgent = $user->hasRole('Agent mobilier');

        $query = Visite_client::with(['propriete.media', 'propriete.user', 'agent:id,name,prenom,telephone,email', 'client:id,name,prenom,telephone,email'])
            ->latest();

        if ($isAdmin) {
            // L'administrateur a la visibilité complète sur toutes les demandes de visite
        } elseif ($isAgent) {
            // L'agent mobilier voit les visites reçues sur ses biens ET les visites qu'il a lui-même demandées
            $query->where(function ($q) use ($user) {
                $q->where('target_agent_id', $user->id)
                    ->orWhere('client_id', $user->id);
            });
        } else {
            // Le client demandeur voit UNIQUEMENT les visites qu'IL a demandées.
            // S'il est propriétaire d'un bien visité par un tiers, il n'en voit RIEN.
            $query->where('client_id', $user->id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $perPage = (int) $request->input('per_page', 15);
        $paginated = $query->paginate($perPage);

        // Transformation de la collection pour appliquer les restrictions d'affichage selon le rôle
        $paginated->getCollection()->transform(function ($visite) use ($user, $isAdmin, $isAgent) {
            return $this->formatVisiteForUser($visite, $user, $isAdmin, $isAgent);
        });

        return response()->json([
            'success' => true,
            'message' => 'Liste des visites récupérée avec succès.',
            'data' => $paginated,
        ], 200);
    }

    /**
     * Alias standard REST pour la liste des visites.
     */
    public function index(Request $request): JsonResponse
    {
        return $this->mesVisites($request);
    }

    /**
     * Affiche les détails d'une visite spécifique avec respect des droits de monopole.
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

        $visite = Visite_client::with(['propriete.media', 'propriete.user', 'agent:id,name,prenom,telephone,email', 'client:id,name,prenom,telephone,email'])
            ->find($id);

        if (! $visite) {
            return response()->json([
                'success' => false,
                'message' => 'Visite introuvable.',
            ], 404);
        }

        $isAdmin = $user->isAnyAdmin();
        $isAgent = $user->hasRole('Agent mobilier') && $visite->target_agent_id === $user->id;
        $isRequesterClient = $visite->client_id === $user->id;

        // Contrôle d'accès strict :
        // Seuls l'Admin, l'Agent assigné et le Client demandeur ont accès.
        // Si le propriétaire du bien est un client, il reçoit 403 Forbidden et n'a aucun accès !
        if (! $isAdmin && ! $isAgent && ! $isRequesterClient) {
            return response()->json([
                'success' => false,
                'message' => 'Vous n\'êtes pas autorisé à consulter cette visite.',
            ], 403);
        }

        $data = $this->formatVisiteForUser($visite, $user, $isAdmin, $isAgent);

        return response()->json([
            'success' => true,
            'message' => 'Détails de la visite récupérés avec succès.',
            'data' => $data,
        ], 200);
    }

    /**
     * Permet au client demandeur ou à l'admin d'annuler une demande de visite en attente.
     */
    public function annulerVisite(Request $request, int|string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Utilisateur non authentifié.',
            ], 401);
        }

        $visite = Visite_client::find($id);

        if (! $visite) {
            return response()->json([
                'success' => false,
                'message' => 'Visite introuvable.',
            ], 404);
        }

        if ($visite->client_id !== $user->id && ! $user->isAnyAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Vous n\'êtes pas autorisé à modifier cette visite.',
            ], 403);
        }

        if ($visite->status === 'cancelled') {
            return response()->json([
                'success' => false,
                'message' => 'Cette visite est déjà annulée.',
            ], 422);
        }

        if ($visite->status === 'completed') {
            return response()->json([
                'success' => false,
                'message' => 'Impossible d\'annuler une visite déjà effectuée.',
            ], 422);
        }

        $visite->update(['status' => 'cancelled']);

        return response()->json([
            'success' => true,
            'message' => 'La demande de visite a été annulée avec succès.',
            'data' => $visite,
        ], 200);
    }

    /**
     * Enregistre le device_token push pour les notifications mobiles (Expo / FCM).
     */
    public function registerDeviceToken(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Utilisateur non authentifié.',
            ], 401);
        }

        $request->validate([
            'device_token' => ['required', 'string', 'max:255'],
        ]);

        $user->update([
            'device_token' => $request->input('device_token'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Token de notification push enregistré avec succès.',
        ], 200);
    }

    /**
     * Alias standard REST pour l'annulation de visite.
     */
    public function destroy(Request $request, int|string $id): JsonResponse
    {
        return $this->annulerVisite($request, $id);
    }

    /**
     * Formate les données de visite en fonction du rôle pour préserver le monopole d'E-Mobilier.
     */
    protected function formatVisiteForUser(Visite_client $visite, $user, bool $isAdmin, bool $isAgent): array
    {
        $data = $visite->toArray();

        // Si l'utilisateur est un Agent mobilier qui reçoit une visite sur son bien (et non Admin),
        // il ne voit QUE le nom et le prénom du demandeur. Téléphone et email sont strictement masqués !
        if ($isAgent && ! $isAdmin && $visite->target_agent_id === $user->id && $visite->client_id !== $user->id) {
            if (isset($data['client'])) {
                $data['client'] = [
                    'id' => $data['client']['id'] ?? null,
                    'name' => $data['client']['name'] ?? '',
                    'prenom' => $data['client']['prenom'] ?? '',
                    'telephone' => null, // Strictement masqué
                    'email' => null,     // Strictement masqué
                ];
            }
        }

        return $data;
    }
}
