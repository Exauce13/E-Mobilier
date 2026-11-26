<?php

namespace App\Http\Controllers\Api\Finance;

use App\Contracts\PaymentGatewayInterface;
use App\Http\Controllers\Controller;
use App\Models\GrandLivre;
use App\Models\Paiement;
use App\Models\Proprietes;
use App\Models\User;
use App\Models\Visite_client;
use App\Models\WebhookLog;
use App\Services\AuditService;
use App\Services\FinancialLedgerService;
use App\Services\Gateways\PaymentGatewayManager;
use App\Services\PlatformSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class PaymentController extends Controller
{
    protected PaymentGatewayManager $gatewayManager;
    protected FinancialLedgerService $ledgerService;
    protected PlatformSettingsService $settings;

    public function __construct(
        PaymentGatewayManager $gatewayManager,
        FinancialLedgerService $ledgerService,
        PlatformSettingsService $settings
    ) {
        $this->gatewayManager = $gatewayManager;
        $this->ledgerService = $ledgerService;
        $this->settings = $settings;
    }

    /**
     * ÉTAPE 1 : Initiation d'une intention de paiement côté serveur.
     * Le client ne définit JAMAIS le montant ; le serveur génère une référence interne unique,
     * fixe le tarif officiel depuis la BDD et vérifie l'acceptation des CGU.
     */
    public function initier(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'type_operation' => ['required', 'string', Rule::in([
                'visite',
                'deblocage_coordonnees',
                'publication_client',
                'publication_agent',
            ])],
            'entity_id' => ['nullable', 'integer'],
            'cgu_acceptees' => ['required', 'accepted'],
        ]);

        // Sécurité tarifaire : un compte Client ne peut pas initier une publication au tarif Agent
        if ($validated['type_operation'] === 'publication_agent' && ! $user->hasRole('Agent mobilier') && ! $user->isAnyAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Le tarif préférentiel Agent mobilier est réservé aux comptes agents agréés.',
            ], 403);
        }

        // Détermination du tarif officiel côté serveur (Server-Side Price Authority depuis BDD)
        $tarifs = $this->settings->getTarifs();
        $montant = match ($validated['type_operation']) {
            'visite' => (int) $tarifs['visite'],
            'deblocage_coordonnees' => (int) $tarifs['deblocage_coordonnees'],
            'publication_agent' => (int) $tarifs['post_agent'],
            'publication_client' => (int) $tarifs['post_client'],
        };

        // Création de la référence interne unique immuable
        $ref = 'PAY-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(4)));
        $gateway = $this->gatewayManager->gateway();
        $expiresAt = now()->addMinutes(30);

        $paiement = Paiement::create([
            'user_id' => $user->id,
            'property_id' => in_array($validated['type_operation'], ['visite', 'deblocage_coordonnees'], true) ? ($validated['entity_id'] ?? null) : null,
            'transaction_reference' => $ref,
            'payment_type' => match ($validated['type_operation']) {
                'visite' => 'visit_fee',
                'deblocage_coordonnees' => 'view_details',
                'publication_agent' => 'agent_post',
                'publication_client' => 'owner_post_submission',
            },
            'related_entity_id' => null,
            'amount' => $montant,
            'currency' => 'XOF',
            'status' => 'pending',
            'gateway_status' => 'INITIATED',
            'expires_at' => $expiresAt,
        ]);

        $widgetConfig = $gateway->getWidgetConfig(
            $montant,
            "Règlement {$validated['type_operation']} ({$montant} FCFA) - Ref: {$ref}",
            ['reference_interne' => $ref, 'user_id' => $user->id]
        );

        AuditService::log('paiement_initie', $paiement, [
            'reference' => $ref,
            'type_operation' => $validated['type_operation'],
            'montant_officiel' => $montant,
            'currency' => 'XOF',
        ], true);

        return response()->json([
            'success' => true,
            'message' => 'Intention de paiement initiée avec succès.',
            'data' => [
                'payment_id' => $paiement->id,
                'reference' => $ref,
                'montant_officiel' => $montant,
                'devise' => 'XOF',
                'status' => 'pending',
                'normalized_status' => 'pending',
                'expires_at' => $expiresAt->toIso8601String(),
                'type_operation' => $validated['type_operation'],
                'gateway' => $gateway->getName(),
                'widget_config' => $widgetConfig,
            ],
        ], 201);
    }

    /**
     * Traitement asynchrone des Webhooks de paiement Kkiapay.
     * Vérification d'authenticité (x-kkiapay-secret), vérification S2S obligatoire et idempotence stricte.
     */
    public function webhook(Request $request, ?string $gatewayName = null): JsonResponse
    {
        $gatewayName = $gatewayName ?: config('emobilier.payment_gateway', 'kkiapay');
        $gateway = $this->gatewayManager->gateway($gatewayName);

        $payload = $request->all();
        $headers = $request->headers->all();
        $headers['__raw_body__'] = $request->getContent();

        // 1. Validation de l'authenticité du webhook (x-kkiapay-secret / HMAC)
        $isSignatureValid = $gateway->verifyWebhookSignature($payload, $headers);
        if (! $isSignatureValid) {
            WebhookLog::create([
                'gateway' => $gatewayName,
                'event_type' => $payload['event'] ?? 'unknown',
                'gateway_transaction_id' => $payload['transactionId'] ?? $payload['transaction_id'] ?? $payload['id'] ?? null,
                'status_http' => 401,
                'is_signature_valid' => false,
                'reconciliation_status' => 'echec_verification',
                'payload_brut' => $payload,
                'headers' => $request->headers->all(),
                'ip_address' => $request->ip(),
            ]);

            AuditService::log('webhook_signature_invalide', null, [
                'gateway' => $gatewayName,
                'ip' => $request->ip(),
            ], true);

            return response()->json([
                'success' => false,
                'message' => 'Signature ou secret webhook Kkiapay invalide.',
            ], 401);
        }

        $transactionId = $payload['transactionId'] ?? $payload['transaction_id'] ?? $payload['id'] ?? null;
        if (! $transactionId) {
            return response()->json(['success' => false, 'message' => 'Identifiant de transaction absent.'], 400);
        }

        // 2. Réconciliation S2S atomique et idempotente (jamais sur la seule base du payload webhook)
        $result = $this->reconcilePayment($gateway, (string) $transactionId, $payload, $request->ip(), null, true);

        return response()->json($result, $result['status_code'] ?? 200);
    }

    /**
     * Vérification serveur-à-serveur déclenchée automatiquement après callback JS Kkiapay.
     * Le frontend ne décide jamais du succès : seul ce endpoint vérifie auprès de Kkiapay et valide.
     */
    public function verify(Request $request): JsonResponse
    {
        $transactionId = trim((string) (
            $request->input('transactionId')
            ?: $request->input('transaction_id')
            ?: ''
        ));

        if ($transactionId === '') {
            return response()->json([
                'success' => false,
                'message' => "L'identifiant de transaction Kkiapay est requis.",
            ], 422);
        }

        $gateway = $this->gatewayManager->gateway();
        $result = $this->reconcilePayment(
            $gateway,
            $transactionId,
            $request->all(),
            $request->ip(),
            $request->user(),
            false
        );

        return response()->json($result, $result['status_code'] ?? 200);
    }

    /**
     * Consultation & rafraîchissement du statut réel d'un paiement via sa référence interne (PAY-...)
     * Permet de retrouver et réconcilier un paiement après fermeture accidentelle du navigateur.
     */
    public function statut(Request $request, string $ref): JsonResponse
    {
        $user = $request->user();
        $paiement = Paiement::where('transaction_reference', $ref)
            ->orWhere('gateway_transaction_id', $ref)
            ->first();

        if (! $paiement) {
            return response()->json([
                'success' => false,
                'message' => 'Paiement introuvable.',
            ], 404);
        }

        if ($paiement->user_id !== $user->id && ! $user->isFinancialOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Accès non autorisé à ce paiement.',
            ], 403);
        }

        // Si le paiement est en attente mais a déjà un gateway_transaction_id, revérifier automatiquement côté Kkiapay
        if ($paiement->status === 'pending' && ! empty($paiement->gateway_transaction_id)) {
            $gateway = $this->gatewayManager->gateway();
            $this->reconcilePayment(
                $gateway,
                $paiement->gateway_transaction_id,
                ['reference' => $paiement->transaction_reference],
                $request->ip(),
                $user,
                false
            );
            $paiement->refresh();
        }

        // Expiration automatique si toujours pending après expires_at
        if ($paiement->status === 'pending' && $paiement->expires_at && now()->greaterThan($paiement->expires_at)) {
            $paiement->update([
                'status' => 'expired',
                'gateway_status' => 'EXPIRED',
                'failure_reason' => 'Délai de paiement expiré.',
            ]);
            $paiement->refresh();
        }

        return response()->json([
            'success' => true,
            'data' => $this->formatPaymentStatus($paiement),
        ], 200);
    }

    /**
     * Marque un paiement en attente comme annulé lorsque l'utilisateur ferme/annule le widget Kkiapay.
     */
    public function annuler(Request $request, string $ref): JsonResponse
    {
        $user = $request->user();

        $paiement = Paiement::where('transaction_reference', $ref)
            ->where('user_id', $user->id)
            ->first();

        if (! $paiement) {
            return response()->json([
                'success' => false,
                'message' => 'Intention de paiement introuvable.',
            ], 404);
        }

        if ($paiement->status === 'successful') {
            return response()->json([
                'success' => false,
                'message' => 'Ce paiement est déjà confirmé et ne peut pas être annulé.',
                'data' => $this->formatPaymentStatus($paiement),
            ], 409);
        }

        if ($paiement->status === 'pending') {
            $paiement->update([
                'status' => 'cancelled',
                'gateway_status' => 'CANCELLED',
                'failure_reason' => $request->input('reason', 'Annulé par l\'utilisateur dans le guichet Kkiapay.'),
            ]);

            AuditService::log('paiement_annule_utilisateur', $paiement, [
                'reference' => $paiement->transaction_reference,
            ], true);
        }

        return response()->json([
            'success' => true,
            'message' => 'Paiement marqué comme annulé.',
            'data' => $this->formatPaymentStatus($paiement->fresh()),
        ], 200);
    }

    /**
     * Liste paginée des paiements réels de l'utilisateur connecté (base de données serveur).
     */
    public function mesPaiements(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Paiement::where('user_id', $user->id)->latest();

        if ($request->filled('status')) {
            $st = $request->input('status');
            $query->where('status', $st === 'success' ? 'successful' : $st);
        }

        if ($request->filled('payment_type')) {
            $query->where('payment_type', $request->input('payment_type'));
        }

        $perPage = min(50, max(1, (int) $request->input('per_page', 20)));
        $paginated = $query->paginate($perPage);

        // Mettre à jour les paiements expirés à la lecture
        $paginated->getCollection()->transform(function (Paiement $p) {
            if ($p->status === 'pending' && $p->expires_at && now()->greaterThan($p->expires_at)) {
                $p->update([
                    'status' => 'expired',
                    'gateway_status' => 'EXPIRED',
                    'failure_reason' => 'Délai de paiement expiré.',
                ]);
                $p->refresh();
            }

            return $this->formatPaymentStatus($p);
        });

        return response()->json([
            'success' => true,
            'message' => 'Historique des paiements récupéré avec succès.',
            'data' => $paginated,
        ], 200);
    }

    /**
     * Moteur central de réconciliation serveur-à-serveur, atomique et strictement idempotent.
     * Utilisé à la fois par le callback vérifié (verify), les webhooks et la reprise de statut.
     */
    public function reconcilePayment(
        PaymentGatewayInterface $gateway,
        string $transactionId,
        array $rawPayload,
        ?string $ip,
        ?User $actor = null,
        bool $isWebhook = false
    ): array {
        $transactionId = trim($transactionId);
        $requestedInternalRef = $this->extractInternalRefFromPayload($rawPayload);

        // 1. Vérification serveur-à-serveur OBLIGATOIRE auprès de l'API officielle Kkiapay
        $verif = $gateway->verifyTransaction($transactionId);
        $gatewayStatus = strtoupper((string) ($verif['gateway_status'] ?? ($verif['success'] ? 'SUCCESS' : 'FAILED')));
        $verifiedTxId = trim((string) ($verif['transaction_id'] ?: $transactionId));
        $kkiapayStateRef = $verif['state_data'] ?? null;

        // Cas A : Passerelle temporairement indisponible (503 / timeout) -> conserver pending, NE JAMAIS valider !
        if ($gatewayStatus === 'UNAVAILABLE' || $gatewayStatus === 'AUTH_ERROR' || $gatewayStatus === 'MISCONFIGURED') {
            WebhookLog::create([
                'gateway' => $gateway->getName(),
                'event_type' => $isWebhook ? ($rawPayload['event'] ?? 'webhook') : 'verify_callback',
                'gateway_transaction_id' => $verifiedTxId,
                'status_http' => $verif['http_status'] ?? 503,
                'is_signature_valid' => true,
                'reconciliation_status' => 'echec_verification',
                'montant' => 0,
                'payload_brut' => $rawPayload,
                'ip_address' => $ip,
            ]);

            // Associer le gateway_transaction_id au paiement pending si libre pour permettre la reprise ultérieure
            if ($requestedInternalRef) {
                $this->attachGatewayTxToPending($requestedInternalRef, $verifiedTxId, 'PENDING', $actor);
            }

            return [
                'success' => false,
                'status' => 'pending',
                'normalized_status' => 'pending',
                'code' => 'GATEWAY_UNAVAILABLE',
                'message' => $verif['message'],
                'status_code' => $verif['http_status'] ?? 503,
            ];
        }

        // Cas B : Paiement toujours PENDING côté Kkiapay -> conserver pending, NE JAMAIS publier !
        if ($gatewayStatus === 'PENDING') {
            $targetRef = $requestedInternalRef ?: $kkiapayStateRef;
            if ($targetRef) {
                $this->attachGatewayTxToPending($targetRef, $verifiedTxId, 'PENDING', $actor);
            }

            WebhookLog::create([
                'gateway' => $gateway->getName(),
                'event_type' => $isWebhook ? ($rawPayload['event'] ?? 'webhook') : 'verify_callback',
                'gateway_transaction_id' => $verifiedTxId,
                'status_http' => 202,
                'is_signature_valid' => true,
                'reconciliation_status' => 'en_attente',
                'montant' => $verif['amount'] ?? 0,
                'payload_brut' => $rawPayload,
                'ip_address' => $ip,
            ]);

            return [
                'success' => false,
                'status' => 'pending',
                'normalized_status' => 'pending',
                'code' => 'PAYMENT_PENDING',
                'message' => $verif['message'],
                'data' => [
                    'transaction_id' => $verifiedTxId,
                    'reference' => $targetRef,
                    'status' => 'pending',
                    'normalized_status' => 'pending',
                ],
                'status_code' => 202,
            ];
        }

        // Cas C : Paiement non validé par Kkiapay (FAILED, CANCELLED, NOT_FOUND, INVALID_CURRENCY, etc.)
        if (! $verif['success']) {
            $localStatus = $gatewayStatus === 'CANCELLED' ? 'cancelled' : 'failed';
            $targetRef = $requestedInternalRef ?: $kkiapayStateRef;

            $terminalFailureStatuses = [
                'FAILED',
                'FAILURE',
                'CANCELLED',
                'REVERTED',
                'INSUFFICIENT_FUND',
                'INSUFFICIENT_FUNDS',
                'PAYMENT_REFUSED',
                'DECLINED',
                'REFUSED',
                'PROCESSING_ERROR',
            ];

            if ($targetRef && in_array($gatewayStatus, $terminalFailureStatuses, true)) {
                $this->markPendingAsFailedOrCancelled(
                    $targetRef,
                    $verifiedTxId,
                    $localStatus,
                    $gatewayStatus,
                    $verif['message'],
                    $verif['raw'] ?? [],
                    $actor
                );
            }

            WebhookLog::create([
                'gateway' => $gateway->getName(),
                'event_type' => $isWebhook ? ($rawPayload['event'] ?? 'webhook') : 'verify_callback',
                'gateway_transaction_id' => $verifiedTxId,
                'status_http' => 422,
                'is_signature_valid' => true,
                'reconciliation_status' => 'echec_verification',
                'montant' => $verif['amount'] ?? 0,
                'payload_brut' => $rawPayload,
                'ip_address' => $ip,
            ]);

            AuditService::log('paiement_verification_refusee', null, [
                'gateway_transaction_id' => $verifiedTxId,
                'reference' => $targetRef,
                'gateway_status' => $gatewayStatus,
                'reason' => $verif['message'],
                'user_id' => $actor?->id,
            ], true);

            return [
                'success' => false,
                'status' => $localStatus,
                'normalized_status' => $localStatus,
                'code' => $gatewayStatus,
                'message' => $verif['message'],
                'status_code' => 422,
            ];
        }

        $montantBrut = (float) ($verif['amount'] ?? 0);
        $frais = (float) ($verif['fee'] ?? 0);
        $currency = strtoupper((string) ($verif['currency'] ?? 'XOF'));
        $paymentMethod = $verif['payment_method'] ?? 'MOBILE_MONEY';

        if ($currency !== 'XOF') {
            AuditService::log('paiement_anomalie_devise', null, [
                'gateway_transaction_id' => $verifiedTxId,
                'currency' => $currency,
            ], true);

            return [
                'success' => false,
                'code' => 'INVALID_CURRENCY',
                'message' => "Devise non autorisée ({$currency}). Seul le FCFA (XOF) est accepté.",
                'status_code' => 422,
            ];
        }

        // 2. Verrouillage SQL atomique (SELECT ... FOR UPDATE) + validations métier + idempotence stricte
        $result = DB::transaction(function () use (
            $gateway,
            $verifiedTxId,
            $requestedInternalRef,
            $kkiapayStateRef,
            $montantBrut,
            $frais,
            $currency,
            $paymentMethod,
            $rawPayload,
            $verif,
            $ip,
            $actor,
            $isWebhook
        ) {
            // 2.1 Vérifier d'abord si ce gateway_transaction_id existe déjà en base (anti-rejeu / anti-réutilisation)
            $existingByGatewayTx = Paiement::where('gateway_transaction_id', $verifiedTxId)
                ->orWhere('transaction_reference', $verifiedTxId)
                ->lockForUpdate()
                ->first();

            if ($existingByGatewayTx && $existingByGatewayTx->status === 'successful') {
                // Tentative d'un autre utilisateur d'usurper une transaction Kkiapay déjà validée
                if ($actor && $existingByGatewayTx->user_id !== $actor->id && ! $actor->isFinancialOwner()) {
                    AuditService::log('paiement_tentative_usurpation_tx', $existingByGatewayTx, [
                        'gateway_transaction_id' => $verifiedTxId,
                        'attacker_user_id' => $actor->id,
                    ], true);

                    return [
                        'success' => false,
                        'code' => 'TRANSACTION_ALREADY_USED',
                        'message' => 'Cette transaction Kkiapay a déjà été utilisée pour un autre compte.',
                        'status_code' => 409,
                    ];
                }

                // Tentative de réutiliser la même transaction Kkiapay sur une AUTRE intention interne (PAY-...)
                if (
                    $requestedInternalRef
                    && $requestedInternalRef !== $existingByGatewayTx->transaction_reference
                    && $requestedInternalRef !== $existingByGatewayTx->gateway_transaction_id
                ) {
                    AuditService::log('paiement_tentative_reutilisation_tx', $existingByGatewayTx, [
                        'gateway_transaction_id' => $verifiedTxId,
                        'existing_reference' => $existingByGatewayTx->transaction_reference,
                        'requested_reference' => $requestedInternalRef,
                        'user_id' => $actor?->id,
                    ], true);

                    return [
                        'success' => false,
                        'code' => 'TRANSACTION_ALREADY_USED',
                        'message' => 'Cette transaction Kkiapay a déjà été utilisée pour valider une autre opération.',
                        'status_code' => 409,
                    ];
                }

                // Rejeu idempotent exact (ex: webhook reçu 2 fois, ou callback + webhook simultanés)
                WebhookLog::create([
                    'gateway' => $gateway->getName(),
                    'event_type' => $isWebhook ? ($rawPayload['event'] ?? 'webhook') : 'verify_callback',
                    'gateway_transaction_id' => $verifiedTxId,
                    'status_http' => 200,
                    'is_signature_valid' => true,
                    'reconciliation_status' => 'doublon_ignore',
                    'montant' => $montantBrut,
                    'payload_brut' => $rawPayload,
                    'ip_address' => $ip,
                ]);

                return [
                    'success' => true,
                    'is_duplicate' => true,
                    'message' => 'Paiement déjà validé et réconcilié (Doublon ignoré).',
                    'paiement' => $existingByGatewayTx,
                    'data' => [
                        'transaction_id' => $verifiedTxId,
                        'gateway_transaction_id' => $verifiedTxId,
                        'reference' => $existingByGatewayTx->transaction_reference,
                        'amount' => (int) round((float) $existingByGatewayTx->amount),
                        'currency' => $existingByGatewayTx->currency ?: 'XOF',
                        'status' => 'successful',
                        'normalized_status' => 'success',
                        'is_already_used' => $existingByGatewayTx->isConsumed(),
                    ],
                    'status_code' => 200,
                ];
            }

            // 2.2 Localiser l'intention de paiement initiée côté serveur (par référence interne)
            $lookupRef = $requestedInternalRef ?: $kkiapayStateRef;
            $paiement = null;
            if ($lookupRef) {
                $paiement = Paiement::where('transaction_reference', $lookupRef)
                    ->lockForUpdate()
                    ->first();
            } elseif ($existingByGatewayTx) {
                $paiement = $existingByGatewayTx;
            }

            // Sécurité : si un paiement initié existe, vérifier strictement propriétaire, référence, expiration, montant, devise
            if ($paiement) {
                if ($actor && $paiement->user_id !== $actor->id && ! $actor->isFinancialOwner()) {
                    AuditService::log('paiement_anomalie_utilisateur', $paiement, [
                        'expected_user_id' => $paiement->user_id,
                        'actor_user_id' => $actor->id,
                        'gateway_transaction_id' => $verifiedTxId,
                    ], true);

                    return [
                        'success' => false,
                        'code' => 'PAYMENT_OWNER_MISMATCH',
                        'message' => 'Ce paiement ne correspond pas à votre compte utilisateur.',
                        'status_code' => 403,
                    ];
                }

                // Vérifier la correspondance de la référence interne si Kkiapay retourne stateData
                if ($kkiapayStateRef && str_starts_with($kkiapayStateRef, 'PAY-') && $kkiapayStateRef !== $paiement->transaction_reference) {
                    AuditService::log('paiement_anomalie_reference', $paiement, [
                        'expected_reference' => $paiement->transaction_reference,
                        'kkiapay_state_ref' => $kkiapayStateRef,
                        'gateway_transaction_id' => $verifiedTxId,
                    ], true);

                    return [
                        'success' => false,
                        'code' => 'REFERENCE_MISMATCH',
                        'message' => 'La référence interne retournée par Kkiapay ne correspond pas à ce paiement.',
                        'status_code' => 422,
                    ];
                }

                // Vérifier expiration si toujours en attente
                if ($paiement->status === 'expired' || ($paiement->status === 'pending' && $paiement->expires_at && now()->greaterThan($paiement->expires_at))) {
                    $paiement->update([
                        'status' => 'expired',
                        'gateway_status' => 'EXPIRED',
                        'failure_reason' => 'Délai de paiement expiré avant confirmation.',
                    ]);

                    return [
                        'success' => false,
                        'code' => 'PAYMENT_EXPIRED',
                        'message' => 'Cette intention de paiement a expiré. Veuillez initier un nouveau paiement.',
                        'status_code' => 422,
                    ];
                }

                // Vérifier l'exactitude du montant officiel (aucune falsification acceptée)
                $expectedAmount = (int) round((float) $paiement->amount);
                $paidAmount = (int) round($montantBrut);
                if ($expectedAmount > 0 && $paidAmount !== $expectedAmount) {
                    AuditService::log('paiement_anomalie_montant', $paiement, [
                        'expected_amount' => $expectedAmount,
                        'paid_amount' => $paidAmount,
                        'gateway_transaction_id' => $verifiedTxId,
                    ], true);

                    return [
                        'success' => false,
                        'code' => 'AMOUNT_MISMATCH',
                        'message' => "Montant réglé ({$paidAmount} FCFA) incohérent avec le montant officiel attendu ({$expectedAmount} FCFA).",
                        'status_code' => 422,
                    ];
                }

                // Vérifier la devise attendue
                $expectedCurrency = strtoupper((string) ($paiement->currency ?: 'XOF'));
                if ($currency !== $expectedCurrency) {
                    AuditService::log('paiement_anomalie_devise', $paiement, [
                        'expected_currency' => $expectedCurrency,
                        'paid_currency' => $currency,
                        'gateway_transaction_id' => $verifiedTxId,
                    ], true);

                    return [
                        'success' => false,
                        'code' => 'CURRENCY_MISMATCH',
                        'message' => "Devise incorrecte ({$currency} au lieu de {$expectedCurrency}).",
                        'status_code' => 422,
                    ];
                }

                // Mise à jour atomique en conservant transaction_reference (PAY-...) immuable !
                $paiement->update([
                    'gateway_transaction_id' => $verifiedTxId,
                    'status' => 'successful',
                    'gateway_status' => 'SUCCESS',
                    'gateway_fees' => $frais,
                    'currency' => $currency,
                    'payment_method' => $paymentMethod,
                    'verified_at' => now(),
                    'failure_reason' => null,
                    'gateway_payload' => $verif['raw'] ?? [],
                ]);
            } else {
                // Si une référence interne explicite a été envoyée mais n'existe pas -> refus strict
                if ($requestedInternalRef) {
                    return [
                        'success' => false,
                        'code' => 'PAYMENT_NOT_FOUND',
                        'message' => 'Référence interne de paiement introuvable.',
                        'status_code' => 404,
                    ];
                }

                // Si aucune référence interne n'est associée : autoriser uniquement en webhook si Kkiapay a bien validé la tx
                // (cas historique d'une transaction Kkiapay directe sans pré-initiation)
                $paiement = Paiement::create([
                    'user_id' => $actor?->id ?? User::query()->value('id') ?? 1,
                    'transaction_reference' => 'PAY-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(4))),
                    'gateway_transaction_id' => $verifiedTxId,
                    'payment_type' => 'visit_fee',
                    'amount' => $montantBrut,
                    'currency' => $currency,
                    'gateway_fees' => $frais,
                    'payment_method' => $paymentMethod,
                    'status' => 'successful',
                    'gateway_status' => 'SUCCESS',
                    'verified_at' => now(),
                    'gateway_payload' => $verif['raw'] ?? [],
                ]);
            }

            // 3. Mise à jour de l'entité liée si déjà existante
            if ($paiement->payment_type === 'visit_fee' && $paiement->related_entity_id) {
                Visite_client::where('id', $paiement->related_entity_id)->update(['is_fee_paid' => true]);
            }
            if ($paiement->property_id && in_array($paiement->payment_type, ['agent_post', 'owner_post_submission'], true)) {
                Proprietes::where('id', $paiement->property_id)
                    ->where('status', 'pending_payment')
                    ->update(['status' => 'pending']);
            }

            // 4. Inscription au Grand Livre en Partie Double (garantie anti-doublon sur gateway_transaction_id)
            $ecritureGL = GrandLivre::where('gateway_transaction_id', $verifiedTxId)->first();
            if (! $ecritureGL) {
                $refDescription = "{$paiement->transaction_reference} (Kkiapay: {$verifiedTxId})";
                $ecritureGL = $this->ledgerService->credit(
                    $montantBrut,
                    $frais,
                    match ($paiement->payment_type) {
                        'visit_fee' => 'encaissement_visite',
                        'view_details' => 'encaissement_deblocage',
                        default => 'encaissement_hebergement',
                    },
                    "Paiement réconcilié - Ref: {$refDescription} ({$paymentMethod})",
                    $paiement->id,
                    $verifiedTxId,
                    $paiement->user_id,
                    $gateway->getName(),
                    ['internal_reference' => $paiement->transaction_reference, 'raw_payload' => $rawPayload]
                );
            }

            // 5. Journalisation WebhookLog & AuditService
            WebhookLog::create([
                'gateway' => $gateway->getName(),
                'event_type' => $isWebhook ? ($rawPayload['event'] ?? 'payment_success') : 'verify_callback',
                'gateway_transaction_id' => $verifiedTxId,
                'status_http' => 200,
                'is_signature_valid' => true,
                'reconciliation_status' => 'reconcilie',
                'montant' => $montantBrut,
                'payload_brut' => $rawPayload,
                'ip_address' => $ip,
            ]);

            AuditService::log('paiement_valide_reconcilie', $paiement, [
                'reference_interne' => $paiement->transaction_reference,
                'gateway_transaction_id' => $verifiedTxId,
                'montant_brut' => $montantBrut,
                'frais' => $frais,
                'montant_net' => $montantBrut - $frais,
                'currency' => $currency,
                'grand_livre_ref' => $ecritureGL->reference_unique,
                'source' => $isWebhook ? 'webhook' : 'callback_s2s',
            ], true);

            return [
                'success' => true,
                'is_duplicate' => false,
                'message' => 'Paiement vérifié auprès de Kkiapay et réconcilié avec succès.',
                'paiement' => $paiement->fresh(),
                'data' => [
                    'transaction_id' => $verifiedTxId,
                    'gateway_transaction_id' => $verifiedTxId,
                    'reference' => $paiement->transaction_reference,
                    'amount' => (int) round($montantBrut),
                    'currency' => $currency,
                    'status' => 'successful',
                    'normalized_status' => 'success',
                    'is_already_used' => $paiement->isConsumed(),
                    'verified_at' => $paiement->verified_at?->toIso8601String(),
                ],
                'ecriture_grand_livre' => $ecritureGL->reference_unique,
                'status_code' => 200,
            ];
        });

        // AfterCommit Dispatching : Notification uniquement lors de la première validation
        if (! empty($result['success']) && empty($result['is_duplicate']) && ! empty($result['paiement'])) {
            try {
                app(\App\Services\Notifications\MultiChannelNotificationService::class)->notifierPaiementConfirme($result['paiement']);
            } catch (\Throwable $e) {
                Log::error('[NOTIFICATION_AFTER_COMMIT_ERROR] ' . $e->getMessage());
            }
        }

        return $result;
    }

    /**
     * Délivre le reçu officiel numérique de paiement (recherche par référence interne OU ID Kkiapay).
     */
    public function recu(Request $request, string $ref): JsonResponse
    {
        $user = $request->user();

        $paiement = Paiement::where('transaction_reference', $ref)
            ->orWhere('gateway_transaction_id', $ref)
            ->first();

        if (! $paiement) {
            $ecriture = GrandLivre::where('gateway_transaction_id', $ref)
                ->orWhere('description', 'LIKE', "%{$ref}%")
                ->first();
            $paiement = $ecriture?->paiement;
        }

        if (! $paiement) {
            abort(404);
        }

        // Seul le payeur ou M. Justin MAGNIDE peut consulter le reçu
        if ($user->id !== $paiement->user_id && ! $user->isFinancialOwner()) {
            return response()->json(['success' => false, 'message' => 'Accès non autorisé à ce reçu.'], 403);
        }

        return response()->json([
            'success' => true,
            'message' => 'Reçu officiel de paiement généré avec succès.',
            'data' => [
                'quittance_numero' => 'REC-' . strtoupper(substr(md5($paiement->transaction_reference), 0, 8)),
                'reference_transaction' => $paiement->transaction_reference,
                'gateway_transaction_id' => $paiement->gateway_transaction_id,
                'emetteur' => $this->settings->getString('platform_legal_name', 'E-MOBILIER SARL (Bénin)'),
                'payeur' => [
                    'id' => $paiement->user_id,
                    'nom' => $paiement->user?->full_name,
                    'email' => $paiement->user?->email,
                ],
                'montant_paye' => (float) $paiement->amount,
                'devise' => $paiement->currency ?: 'XOF',
                'type_prestation' => $paiement->payment_type,
                'mode_reglement' => $paiement->payment_method ?? 'Mobile Money',
                'statut' => match ($paiement->status) {
                    'successful' => 'ACQUITTÉ',
                    'failed' => 'ÉCHOUÉ',
                    'cancelled' => 'ANNULÉ',
                    'expired' => 'EXPIRÉ',
                    default => 'EN ATTENTE',
                },
                'date_reglement' => ($paiement->verified_at ?? $paiement->created_at)?->toIso8601String(),
            ],
        ]);
    }

    protected function extractInternalRefFromPayload(array $rawPayload): ?string
    {
        $candidates = [
            $rawPayload['reference'] ?? null,
            $rawPayload['internal_reference'] ?? null,
            $rawPayload['payment_reference'] ?? null,
            $rawPayload['stateData'] ?? null,
            $rawPayload['data'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
            if (is_array($candidate)) {
                $nested = $candidate['reference'] ?? $candidate['reference_interne'] ?? null;
                if (is_string($nested) && trim($nested) !== '') {
                    return trim($nested);
                }
            }
        }

        return null;
    }

    protected function attachGatewayTxToPending(string $internalRef, string $gatewayTxId, string $gatewayStatus, ?User $actor): void
    {
        DB::transaction(function () use ($internalRef, $gatewayTxId, $gatewayStatus, $actor) {
            $alreadyUsed = Paiement::where('gateway_transaction_id', $gatewayTxId)->exists();
            if ($alreadyUsed) {
                return;
            }
            $query = Paiement::where('transaction_reference', $internalRef)->where('status', 'pending');
            if ($actor) {
                $query->where('user_id', $actor->id);
            }
            $paiement = $query->lockForUpdate()->first();
            if ($paiement && empty($paiement->gateway_transaction_id)) {
                $paiement->update([
                    'gateway_transaction_id' => $gatewayTxId,
                    'gateway_status' => $gatewayStatus,
                ]);
            }
        });
    }

    protected function markPendingAsFailedOrCancelled(
        string $internalRef,
        string $gatewayTxId,
        string $localStatus,
        string $gatewayStatus,
        string $reason,
        array $raw,
        ?User $actor
    ): void {
        DB::transaction(function () use ($internalRef, $gatewayTxId, $localStatus, $gatewayStatus, $reason, $raw, $actor) {
            $query = Paiement::where('transaction_reference', $internalRef)->where('status', 'pending');
            if ($actor) {
                $query->where('user_id', $actor->id);
            }
            $paiement = $query->lockForUpdate()->first();
            if (! $paiement) {
                return;
            }

            $updateData = [
                'status' => $localStatus,
                'gateway_status' => $gatewayStatus,
                'failure_reason' => substr($reason, 0, 250),
                'gateway_payload' => $raw,
            ];

            if (! empty($gatewayTxId) && ! Paiement::where('gateway_transaction_id', $gatewayTxId)->exists()) {
                $updateData['gateway_transaction_id'] = $gatewayTxId;
            }

            $paiement->update($updateData);
        });
    }

    protected function formatPaymentStatus(Paiement $p): array
    {
        return [
            'id' => $p->id,
            'reference' => $p->transaction_reference,
            'gateway_transaction_id' => $p->gateway_transaction_id,
            'payment_type' => $p->payment_type,
            'amount' => (float) $p->amount,
            'currency' => $p->currency ?: 'XOF',
            'gateway_fees' => (float) ($p->gateway_fees ?? 0),
            'payment_method' => $p->payment_method,
            'status' => $p->status,
            'normalized_status' => $p->normalized_status,
            'gateway_status' => $p->gateway_status,
            'property_id' => $p->property_id,
            'related_entity_id' => $p->related_entity_id,
            'is_consumed' => $p->isConsumed(),
            'failure_reason' => $p->failure_reason,
            'verified_at' => $p->verified_at?->toIso8601String(),
            'expires_at' => $p->expires_at?->toIso8601String(),
            'created_at' => $p->created_at?->toIso8601String(),
        ];
    }
}
