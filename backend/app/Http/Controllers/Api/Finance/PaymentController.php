<?php

namespace App\Http\Controllers\Api\Finance;

use App\Http\Controllers\Controller;
use App\Models\Paiement;
use App\Models\Proprietes;
use App\Models\Visite_client;
use App\Models\WebhookLog;
use App\Services\AuditService;
use App\Services\FinancialLedgerService;
use App\Services\Gateways\PaymentGatewayManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PaymentController extends Controller
{
    protected PaymentGatewayManager $gatewayManager;
    protected FinancialLedgerService $ledgerService;

    public function __construct(PaymentGatewayManager $gatewayManager, FinancialLedgerService $ledgerService)
    {
        $this->gatewayManager = $gatewayManager;
        $this->ledgerService = $ledgerService;
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

        // Détermination du tarif officiel côté serveur (Server-Side Price Authority)
        $tarifs = config('emobilier.tarifs_officiels');
        $montant = match ($validated['type_operation']) {
            'visite' => (int) $tarifs['visite'], // 500 FCFA
            'deblocage_coordonnees' => (int) $tarifs['deblocage_coordonnees'], // 50 FCFA
            'publication_agent' => (int) $tarifs['post_agent'], // 100 FCFA
            'publication_client' => (int) $tarifs['post_client'], // 500 FCFA
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
            'related_entity_id' => $validated['entity_id'] ?? null,
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
    protected function traiterReconciliationPaiement($gateway, string $transactionId, array $rawPayload, ?string $ip): array
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
        $result = DB::transaction(function () use ($gateway, $transactionId, $montantBrut, $frais, $paymentMethod, $rawPayload, $ip) {
            // Recherche de paiement existant ou associé
            $paiement = Paiement::where('transaction_reference', $transactionId)
                ->orWhere('id', (int) filter_var($transactionId, FILTER_SANITIZE_NUMBER_INT))
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
                    'status_code' => 200,
                ];
            }

            // Si le paiement n'existait pas encore (créé en direct lors de la visite)
            if (! $paiement) {
                $paiement = Paiement::create([
                    'user_id' => auth()->id() ?? 1,
                    'transaction_reference' => $transactionId,
                    'payment_type' => 'visit_fee',
                    'amount' => $montantBrut,
                    'payment_method' => $paymentMethod,
                    'status' => 'successful',
                ]);
            } else {
                $paiement->update([
                    'status' => 'successful',
                    'payment_method' => $paymentMethod,
                ]);
            }

            // 3. Mise à jour de l'entité liée
            if ($paiement->payment_type === 'visit_fee' && $paiement->related_entity_id) {
                Visite_client::where('id', $paiement->related_entity_id)->update(['is_fee_paid' => true]);
            }

            // 4. Inscription de l'écriture au Grand Livre (Partie Double)
            $ecritureGL = $this->ledgerService->credit(
                $montantBrut,
                $frais,
                match ($paiement->payment_type) {
                    'visit_fee' => 'encaissement_visite',
                    'view_details' => 'encaissement_deblocage',
                    default => 'encaissement_hebergement',
                },
                "Paiement réconcilié - Ref: {$paiement->transaction_reference} ({$paymentMethod})",
                $paiement->id,
                $transactionId,
                $paiement->user_id,
                $gateway->getName(),
                ['raw_payload' => $rawPayload]
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

        $paiement = Paiement::where('transaction_reference', $ref)->firstOrFail();

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
                'emetteur' => 'E-MOBILIER SARL (Bénin)',
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
