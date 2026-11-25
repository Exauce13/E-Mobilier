<?php

namespace App\Http\Controllers\Api\Finance;

use App\Contracts\PaymentGatewayInterface;
use App\Http\Controllers\Controller;
use App\Models\Paiement;
use App\Models\Proprietes;
use App\Models\Visite_client;
use App\Models\WebhookLog;
use App\Services\AuditService;
use App\Services\FinancialLedgerService;
use App\Services\Gateways\PaymentGatewayManager;
use App\Services\PlatformSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
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
     * Le client ne définit JAMAIS le montant ; le serveur fixe le tarif officiel
     * et vérifie l'acceptation expresse des CGU.
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

        // Sécurité tarifaire : un compte Client ne peut pas initier une publication au tarif Agent (100 F)
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

        // Création de la référence interne unique
        $ref = 'PAY-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(4)));
        $gateway = $this->gatewayManager->gateway();

        // Enregistrement de l'intention de paiement à l'état pending
        $paiement = Paiement::create([
            'user_id' => $user->id,
            'property_id' => in_array($validated['type_operation'], ['visite', 'deblocage_coordonnees']) ? ($validated['entity_id'] ?? null) : null,
            'transaction_reference' => $ref,
            'payment_type' => match ($validated['type_operation']) {
                'visite' => 'visit_fee',
                'deblocage_coordonnees' => 'view_details',
                'publication_agent' => 'agent_post',
                'publication_client' => 'owner_post_submission',
            },
            'related_entity_id' => $validated['type_operation'] === 'visite' ? null : ($validated['entity_id'] ?? null),
            'amount' => $montant,
            'status' => 'pending',
        ]);

        $widgetConfig = $gateway->getWidgetConfig(
            $montant,
            "Règlement {$validated['type_operation']} ({$montant} FCFA) - Ref: {$ref}",
            ['reference_interne' => $ref, 'user_id' => $user->id]
        );

        return response()->json([
            'success' => true,
            'message' => 'Intention de paiement initiée avec succès.',
            'data' => [
                'reference' => $ref,
                'montant_officiel' => $montant,
                'devise' => 'XOF',
                'type_operation' => $validated['type_operation'],
                'gateway' => $gateway->getName(),
                'widget_config' => $widgetConfig,
            ],
        ], 201);
    }

    /**
     * Traitement asynchrone des Webhooks de paiement.
     * Idempotence stricte et réconciliation serveur-à-serveur.
     */
    public function webhook(Request $request, ?string $gatewayName = null): JsonResponse
    {
        $gatewayName = $gatewayName ?: config('emobilier.payment_gateway', 'kkiapay');
        $gateway = $this->gatewayManager->gateway($gatewayName);

        $payload = $request->all();
        $headers = $request->headers->all();

        // 1. Validation de la signature cryptographique du webhook
        $isSignatureValid = $gateway->verifyWebhookSignature($payload, $headers);
        if (! $isSignatureValid) {
            WebhookLog::create([
                'gateway' => $gatewayName,
                'event_type' => $payload['event'] ?? 'unknown',
                'gateway_transaction_id' => $payload['transactionId'] ?? $payload['id'] ?? null,
                'status_http' => 401,
                'is_signature_valid' => false,
                'reconciliation_status' => 'echec_verification',
                'payload_brut' => $payload,
                'headers' => $headers,
                'ip_address' => $request->ip(),
            ]);

            return response()->json(['success' => false, 'message' => 'Signature de webhook invalide.'], 401);
        }

        $transactionId = $payload['transactionId'] ?? $payload['transaction_id'] ?? $payload['id'] ?? null;
        if (! $transactionId) {
            return response()->json(['success' => false, 'message' => 'Identifiant de transaction absent.'], 400);
        }

        // 2. Traitement de réconciliation idempotent
        $result = $this->traiterReconciliationPaiement($gateway, (string) $transactionId, $payload, $request->ip());

        return response()->json($result, $result['status_code'] ?? 200);
    }

    /**
     * Vérification manuelle après widget de paiement (idem webhook).
     */
    public function verify(Request $request): JsonResponse
    {
        $transactionId = $request->input('transactionId')
            ?: $request->input('transaction_id')
            ?: $request->input('transaction_reference');

        if (! $transactionId) {
            return response()->json([
                'success' => false,
                'message' => 'L\'identifiant de transaction est requis.',
            ], 422);
        }

        $gateway = $this->gatewayManager->gateway();
        $result = $this->traiterReconciliationPaiement($gateway, (string) $transactionId, $request->all(), $request->ip());

        return response()->json($result, $result['status_code'] ?? 200);
    }

    /**
     * Réconciliation atomique et mise à jour du Grand Livre.
     */
    protected function traiterReconciliationPaiement(PaymentGatewayInterface $gateway, string $transactionId, array $rawPayload, ?string $ip): array
    {
        // 1. Double vérification serveur-à-serveur
        $verif = $gateway->verifyTransaction($transactionId);

        if (! $verif['success']) {
            WebhookLog::create([
                'gateway' => $gateway->getName(),
                'gateway_transaction_id' => $transactionId,
                'status_http' => 422,
                'is_signature_valid' => true,
                'reconciliation_status' => 'echec_verification',
                'montant' => $verif['amount'] ?? 0,
                'payload_brut' => $rawPayload,
                'ip_address' => $ip,
            ]);

            return [
                'success' => false,
                'message' => $verif['message'],
                'status_code' => 422,
            ];
        }

        $montantBrut = (float) $verif['amount'];
        $frais = (float) $verif['fee'];
        $paymentMethod = $verif['payment_method'] ?? 'MOBILE_MONEY';

        // 2. Verrouillage atomique et idempotence
        $internalRef = $rawPayload['reference'] ?? $rawPayload['internal_reference'] ?? null;
        $result = DB::transaction(function () use ($gateway, $transactionId, $internalRef, $montantBrut, $frais, $paymentMethod, $rawPayload, $ip) {
            // Recherche de paiement existant par transaction Kkiapay, référence interne PAY-..., ou ID strictement numérique
            $paiement = Paiement::where('transaction_reference', $transactionId)
                ->when($internalRef, fn ($q) => $q->orWhere('transaction_reference', $internalRef))
                ->when(ctype_digit($transactionId), fn ($q) => $q->orWhere('id', (int) $transactionId))
                ->lockForUpdate()
                ->first();

            // IDEMPOTENCE : Si déjà validé, ignorer le doublon proprement
            if ($paiement && $paiement->status === 'successful') {
                WebhookLog::create([
                    'gateway' => $gateway->getName(),
                    'gateway_transaction_id' => $transactionId,
                    'status_http' => 200,
                    'is_signature_valid' => true,
                    'reconciliation_status' => 'doublon_ignore',
                    'montant' => $montantBrut,
                    'payload_brut' => $rawPayload,
                    'ip_address' => $ip,
                ]);

                return [
                    'success' => true,
                    'message' => 'Paiement déjà validé et réconcilié (Doublon ignoré).',
                    'paiement' => $paiement,
                    'data' => [
                        'transaction_id' => $transactionId,
                        'amount' => (int) $montantBrut,
                        'is_already_used' => true,
                        'reference' => $paiement->transaction_reference,
                    ],
                    'status_code' => 200,
                ];
            }

            // Si le paiement n'existait pas encore (créé en direct lors de la visite)
            if (! $paiement) {
                $paiement = Paiement::create([
                    'user_id' => Auth::id() ?? 1,
                    'transaction_reference' => $transactionId,
                    'payment_type' => 'visit_fee',
                    'amount' => $montantBrut,
                    'payment_method' => $paymentMethod,
                    'status' => 'successful',
                ]);
            } else {
                $paiement->update([
                    'transaction_reference' => $transactionId,
                    'status' => 'successful',
                    'payment_method' => $paymentMethod,
                ]);
            }

            // 3. Mise à jour de l'entité liée
            if ($paiement->payment_type === 'visit_fee' && $paiement->related_entity_id) {
                Visite_client::where('id', $paiement->related_entity_id)->update(['is_fee_paid' => true]);
            }

            // 4. Inscription de l'écriture au Grand Livre (Partie Double)
            $refDescription = $internalRef && $internalRef !== $transactionId
                ? "{$paiement->transaction_reference} / {$internalRef}"
                : $paiement->transaction_reference;
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
                $transactionId,
                $paiement->user_id,
                $gateway->getName(),
                ['internal_reference' => $internalRef, 'raw_payload' => $rawPayload]
            );

            // 5. Journalisation webhook
            WebhookLog::create([
                'gateway' => $gateway->getName(),
                'gateway_transaction_id' => $transactionId,
                'status_http' => 200,
                'is_signature_valid' => true,
                'reconciliation_status' => 'reconcilie',
                'montant' => $montantBrut,
                'payload_brut' => $rawPayload,
                'ip_address' => $ip,
            ]);

            AuditService::log('paiement_valide_reconcilie', $paiement, [
                'montant_brut' => $montantBrut,
                'frais' => $frais,
                'montant_net' => $montantBrut - $frais,
                'grand_livre_ref' => $ecritureGL->reference_unique,
            ], true);

            return [
                'success' => true,
                'message' => 'Paiement réconcilié avec succès et inscrit au Grand Livre.',
                'paiement' => $paiement,
                'data' => [
                    'transaction_id' => $transactionId,
                    'amount' => (int) $montantBrut,
                    'is_already_used' => false,
                    'reference' => $paiement->transaction_reference,
                ],
                'ecriture_grand_livre' => $ecritureGL->reference_unique,
                'status_code' => 200,
            ];
        });

        // AfterCommit Dispatching : Distribution multi-canal asynchrone uniquement après validation SQL
        if (! empty($result['success']) && ! empty($result['paiement']) && ($result['message'] ?? '') !== 'Paiement déjà validé et réconcilié (Doublon ignoré).') {
            try {
                app(\App\Services\Notifications\MultiChannelNotificationService::class)->notifierPaiementConfirme($result['paiement']);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::error('[NOTIFICATION_AFTER_COMMIT_ERROR] ' . $e->getMessage());
            }
        }

        return $result;
    }

    /**
     * Délivre le reçu officiel numérique de paiement.
     */
    public function recu(Request $request, string $ref): JsonResponse
    {
        $user = $request->user();

        $paiement = Paiement::where('transaction_reference', $ref)->first();
        if (! $paiement) {
            $ecriture = \App\Models\GrandLivre::where('gateway_transaction_id', $ref)
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
                'emetteur' => $this->settings->getString('platform_legal_name', 'E-MOBILIER SARL (Bénin)'),
                'payeur' => [
                    'id' => $paiement->user_id,
                    'nom' => $paiement->user?->full_name,
                    'email' => $paiement->user?->email,
                ],
                'montant_paye' => (float) $paiement->amount,
                'devise' => 'XOF',
                'type_prestation' => $paiement->payment_type,
                'mode_reglement' => $paiement->payment_method ?? 'Mobile Money',
                'statut' => $paiement->status === 'successful' ? 'ACQUITTÉ' : 'EN ATTENTE',
                'date_reglement' => $paiement->created_at?->toIso8601String(),
            ],
        ]);
    }
}
