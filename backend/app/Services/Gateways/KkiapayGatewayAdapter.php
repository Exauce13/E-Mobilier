<?php

namespace App\Services\Gateways;

use App\Contracts\PaymentGatewayInterface;
use Exception;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class KkiapayGatewayAdapter implements PaymentGatewayInterface
{
    protected string $baseUrl;
    protected ?string $publicKey;
    protected ?string $privateKey;
    protected ?string $secretKey;
    protected ?string $webhookSecret;
    protected bool $sandbox;

    public function __construct()
    {
        $this->sandbox = filter_var(config('services.kkiapay.sandbox', true), FILTER_VALIDATE_BOOLEAN);
        $configuredBaseUrl = trim((string) config('services.kkiapay.base_url', ''));
        $defaultBaseUrl = $this->sandbox ? 'https://api-sandbox.kkiapay.me' : 'https://api.kkiapay.me';

        // Verrou Sandbox strict : en mode Sandbox, aucun appel ne peut être routé vers la production (api.kkiapay.me).
        if ($this->sandbox && ($configuredBaseUrl === '' || str_contains(strtolower($configuredBaseUrl), 'api.kkiapay.me'))) {
            if ($configuredBaseUrl !== '' && str_contains(strtolower($configuredBaseUrl), 'api.kkiapay.me')) {
                Log::warning('[KKIAPAY_SANDBOX] KKIAPAY_BASE_URL pointait vers la production alors que KKIAPAY_SANDBOX=true. Forçage vers https://api-sandbox.kkiapay.me.');
            }
            $this->baseUrl = 'https://api-sandbox.kkiapay.me';
        } else {
            $this->baseUrl = rtrim($configuredBaseUrl !== '' ? $configuredBaseUrl : $defaultBaseUrl, '/');
        }

        $this->publicKey = $this->cleanEnvValue(config('services.kkiapay.public_key'));
        $this->privateKey = $this->cleanEnvValue(config('services.kkiapay.private_key'));
        $this->secretKey = $this->cleanEnvValue(config('services.kkiapay.secret_key'));
        $this->webhookSecret = $this->cleanEnvValue(config('services.kkiapay.webhook_secret')) ?: $this->secretKey;
    }

    public function isSandbox(): bool
    {
        return $this->sandbox;
    }

    public function getBaseUrl(): string
    {
        return $this->baseUrl;
    }

    /**
     * Vérifie que des clés de production (pk_ / sk_) ne sont pas utilisées par erreur en mode Sandbox.
     * Les clés serveur Sandbox Kkiapay utilisent les préfixes tpk_ (Test Private Key) et tsk_ (Test Secret Key).
     */
    protected function hasSandboxKeyMismatch(): bool
    {
        if (! $this->sandbox) {
            return false;
        }
        $priv = (string) $this->privateKey;
        $sec = (string) $this->secretKey;

        return str_starts_with($priv, 'pk_') || str_starts_with($sec, 'sk_');
    }

    protected function cleanEnvValue(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $clean = trim((string) $value, " \t\n\r\0\x0B\"'");

        return $clean !== '' ? $clean : null;
    }

    public function getName(): string
    {
        return 'kkiapay';
    }

    public function getWidgetConfig(int $amount, string $reason, array $metadata = []): array
    {
        // IMPORTANT : Seule la clé publique est transmise au frontend. Jamais private_key ni secret_key.
        return [
            'gateway' => $this->getName(),
            'public_key' => $this->publicKey,
            'amount' => $amount,
            'currency' => 'XOF',
            'reason' => $reason,
            'sandbox' => $this->sandbox,
            'theme' => $this->cleanEnvValue(config('services.kkiapay.theme')) ?: '#0E7C5B',
            'script_url' => $this->cleanEnvValue(config('services.kkiapay.widget_script')) ?: 'https://cdn.kkiapay.me/k.js',
            'callback' => $this->cleanEnvValue(config('services.kkiapay.callback_url')) ?: '',
            'metadata' => $metadata,
        ];
    }

    /**
     * Vérification serveur-à-serveur officielle auprès de Kkiapay :
     * POST {baseUrl}/api/v1/transactions/status
     * En-têtes d'authentification : x-api-key (public), x-private-key (private), x-secret-key (secret).
     *
     * AUCUN contournement ni fallback hors-ligne ne valide une transaction non confirmée par Kkiapay.
     */
    public function verifyTransaction(string $transactionId, int $expectedAmount = 0): array
    {
        $transactionId = trim($transactionId);

        if ($transactionId === '') {
            return $this->failureResult('', 'INVALID_REQUEST', 'L\'identifiant de transaction KKiaPay est requis.', 422);
        }

        if (empty($this->publicKey) || empty($this->privateKey) || empty($this->secretKey)) {
            Log::error('[KKIAPAY] Clés API serveur incomplètes dans la configuration.');

            return $this->failureResult(
                $transactionId,
                'MISCONFIGURED',
                'La configuration serveur KKiaPay est incomplète (clés API manquantes).',
                500
            );
        }

        if ($this->hasSandboxKeyMismatch()) {
            Log::error('[KKIAPAY_SANDBOX] Clés Live (pk_/sk_) détectées alors que KKIAPAY_SANDBOX=true. Vérification bloquée.');

            return $this->failureResult(
                $transactionId,
                'MISCONFIGURED',
                'Incohérence de configuration : utilisez exclusivement des clés API Sandbox (tpk_ / tsk_) lorsque KKIAPAY_SANDBOX=true.',
                500
            );
        }

        try {
            $response = Http::withHeaders([
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
                'x-api-key' => $this->publicKey,
                'x-private-key' => $this->privateKey,
                'x-secret-key' => $this->secretKey,
            ])
                ->timeout(15)
                ->post("{$this->baseUrl}/api/v1/transactions/status", [
                    'transactionId' => $transactionId,
                ]);

            $httpStatus = $response->status();
            $data = $response->json();
            if (! is_array($data)) {
                $data = [];
            }

            if ($response->successful()) {
                $status = strtoupper(trim((string) ($data['status'] ?? $data['state'] ?? '')));
                $amount = isset($data['amount']) ? (float) $data['amount'] : 0.0;
                $fee = isset($data['fees']) ? (float) $data['fees'] : round($amount * 0.015, 2);
                $net = max(0.0, $amount - $fee);
                $currency = strtoupper(trim((string) ($data['currency'] ?? 'XOF')));
                $resolvedTxId = (string) ($data['transactionId'] ?? $data['transaction_id'] ?? $transactionId);
                $paymentMethod = $data['source_common_name'] ?? $data['source'] ?? 'MOBILE_MONEY';
                $stateData = $this->extractStateReference($data);

                if ($status === 'SUCCESS') {
                    if ($currency !== 'XOF') {
                        return [
                            'success' => false,
                            'gateway_status' => 'INVALID_CURRENCY',
                            'http_status' => 422,
                            'amount' => $amount,
                            'currency' => $currency,
                            'fee' => $fee,
                            'net' => $net,
                            'transaction_id' => $resolvedTxId,
                            'state_data' => $stateData,
                            'payment_method' => $paymentMethod,
                            'message' => "Devise invalide retournée par KKiaPay ({$currency} au lieu de XOF).",
                            'raw' => $data,
                        ];
                    }

                    if ($expectedAmount > 0 && (int) round($amount) !== $expectedAmount) {
                        return [
                            'success' => false,
                            'gateway_status' => 'AMOUNT_MISMATCH',
                            'http_status' => 422,
                            'amount' => $amount,
                            'currency' => $currency,
                            'fee' => $fee,
                            'net' => $net,
                            'transaction_id' => $resolvedTxId,
                            'state_data' => $stateData,
                            'payment_method' => $paymentMethod,
                            'message' => "Anomalie financière : montant payé ({$amount} FCFA) différent du montant officiel attendu ({$expectedAmount} FCFA).",
                            'raw' => $data,
                        ];
                    }

                    return [
                        'success' => true,
                        'gateway_status' => 'SUCCESS',
                        'http_status' => 200,
                        'amount' => $amount,
                        'currency' => $currency,
                        'fee' => $fee,
                        'net' => $net,
                        'transaction_id' => $resolvedTxId,
                        'state_data' => $stateData,
                        'payment_method' => $paymentMethod,
                        'message' => 'Paiement vérifié et confirmé par les serveurs KKiaPay.',
                        'raw' => $data,
                    ];
                }

                if ($status === 'PENDING' || $status === 'PROCESSING') {
                    return [
                        'success' => false,
                        'gateway_status' => 'PENDING',
                        'http_status' => 202,
                        'amount' => $amount,
                        'currency' => $currency,
                        'fee' => 0.0,
                        'net' => 0.0,
                        'transaction_id' => $resolvedTxId,
                        'state_data' => $stateData,
                        'payment_method' => $paymentMethod,
                        'message' => 'Le paiement est encore en attente de confirmation auprès de votre opérateur Mobile Money.',
                        'raw' => $data,
                    ];
                }

                $rawReasonCode = strtoupper(trim((string) (
                    $data['failureCode']
                    ?? (is_array($data['reason'] ?? null) ? ($data['reason']['code'] ?? '') : '')
                    ?? ''
                )));
                $rawReasonMessage = trim((string) (
                    $data['failureMessage']
                    ?? (is_array($data['reason'] ?? null) ? ($data['reason']['message'] ?? '') : '')
                    ?? (is_string($data['reason'] ?? null) ? $data['reason'] : '')
                    ?? ''
                ));

                $mappedStatus = match (true) {
                    in_array($status, ['CANCELLED', 'CANCELED', 'ABORTED'], true) => 'CANCELLED',
                    in_array($rawReasonCode, ['INSUFFICIENT_FUND', 'INSUFFICIENT_FUNDS'], true)
                        || in_array($status, ['INSUFFICIENT_FUND', 'INSUFFICIENT_FUNDS'], true) => 'INSUFFICIENT_FUND',
                    in_array($rawReasonCode, ['PAYMENT_REFUSED', 'DECLINED', 'REFUSED', 'TRANSACTION_DECLINED'], true)
                        || in_array($status, ['PAYMENT_REFUSED', 'DECLINED', 'REFUSED'], true) => 'PAYMENT_REFUSED',
                    in_array($rawReasonCode, ['PROCESSING_ERROR'], true)
                        || $status === 'PROCESSING_ERROR' => 'PROCESSING_ERROR',
                    in_array($status, ['REVERTED', 'REFUNDED'], true) => 'REVERTED',
                    default => ($status !== '' ? ($status === 'FAILURE' ? 'FAILED' : $status) : 'FAILED'),
                };

                $friendlyMessage = $rawReasonMessage !== ''
                    ? $rawReasonMessage
                    : match ($mappedStatus) {
                        'INSUFFICIENT_FUND' => 'Paiement refusé par KKiaPay : solde Mobile Money insuffisant.',
                        'PAYMENT_REFUSED' => 'Paiement refusé par l\'opérateur ou la banque.',
                        'PROCESSING_ERROR' => 'Erreur de traitement Mobile Money lors de la transaction KKiaPay.',
                        'CANCELLED' => 'Transaction annulée avant confirmation.',
                        'REVERTED' => 'Transaction annulée ou remboursée par KKiaPay.',
                        default => "La transaction KKiaPay n'a pas abouti (statut : {$mappedStatus}).",
                    };

                return [
                    'success' => false,
                    'gateway_status' => $mappedStatus,
                    'failure_code' => $rawReasonCode ?: $mappedStatus,
                    'http_status' => 422,
                    'amount' => $amount,
                    'currency' => $currency,
                    'fee' => 0.0,
                    'net' => 0.0,
                    'transaction_id' => $resolvedTxId,
                    'state_data' => $stateData,
                    'payment_method' => $paymentMethod,
                    'message' => $friendlyMessage,
                    'raw' => $data,
                ];
            }

            if ($httpStatus === 404 || $httpStatus === 400) {
                Log::warning('[KKIAPAY] Transaction introuvable ou invalide', [
                    'http_status' => $httpStatus,
                    'transaction_id' => $transactionId,
                    'body' => substr($response->body(), 0, 500),
                ]);

                return $this->failureResult(
                    $transactionId,
                    'NOT_FOUND',
                    'Transaction introuvable ou invalide auprès de KKiaPay.',
                    422,
                    $data
                );
            }

            if ($httpStatus === 401 || $httpStatus === 403) {
                Log::error('[KKIAPAY] Authentification API rejetée', [
                    'http_status' => $httpStatus,
                    'transaction_id' => $transactionId,
                    'body' => substr($response->body(), 0, 300),
                ]);

                return $this->failureResult(
                    $transactionId,
                    'AUTH_ERROR',
                    'Clés API serveur KKiaPay refusées par la passerelle.',
                    502,
                    $data
                );
            }

            Log::error('[KKIAPAY] Passerelle indisponible lors de la vérification', [
                'http_status' => $httpStatus,
                'transaction_id' => $transactionId,
                'body' => substr($response->body(), 0, 300),
            ]);

            return $this->failureResult(
                $transactionId,
                'UNAVAILABLE',
                "Les serveurs KKiaPay sont temporairement indisponibles (HTTP {$httpStatus}). Votre paiement reste en attente et pourra être revérifié sans repayer.",
                503,
                $data
            );
        } catch (Exception $e) {
            Log::error('[KKIAPAY] Exception réseau lors de la vérification : ' . $e->getMessage(), [
                'transaction_id' => $transactionId,
            ]);

            return $this->failureResult(
                $transactionId,
                'UNAVAILABLE',
                'Impossible de joindre les serveurs KKiaPay pour confirmer la transaction. Veuillez réessayer la vérification.',
                503
            );
        }
    }

    public function initiatePayout(string $beneficiaryAccount, float $amount, string $reference, array $metadata = []): array
    {
        if (app()->environment('testing')) {
            return [
                'success' => true,
                'payout_id' => 'PAYOUT_KKIAPAY_' . time(),
                'status' => 'PENDING_OPERATOR',
                'message' => "Ordre de virement de {$amount} FCFA vers {$beneficiaryAccount} transmis à KKiaPay (Test).",
                'raw' => [
                    'reference' => $reference,
                    'beneficiary' => $beneficiaryAccount,
                    'amount' => $amount,
                ],
            ];
        }

        try {
            $response = Http::withHeaders([
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
                'x-api-key' => $this->publicKey,
                'x-private-key' => $this->privateKey,
                'x-secret-key' => $this->secretKey,
            ])
                ->timeout(15)
                ->post("{$this->baseUrl}/api/v1/payout", [
                    'amount' => (int) $amount,
                    'destination' => $beneficiaryAccount,
                    'reference' => $reference,
                ]);

            if ($response->successful()) {
                $data = $response->json() ?? [];

                return [
                    'success' => true,
                    'payout_id' => $data['transaction_id'] ?? $data['id'] ?? null,
                    'status' => $data['status'] ?? 'SUCCESS',
                    'message' => 'Virement initié avec succès.',
                    'raw' => $data,
                ];
            }

            return [
                'success' => false,
                'payout_id' => null,
                'status' => 'FAILED',
                'message' => 'Rejet de la demande de virement par l\'agrégateur.',
                'raw' => $response->json() ?? [],
            ];
        } catch (Exception $e) {
            Log::error('Exception Payout KKiaPay : ' . $e->getMessage(), ['reference' => $reference]);

            return [
                'success' => false,
                'payout_id' => null,
                'status' => 'ERROR',
                'message' => 'Erreur technique lors du décaissement : ' . $e->getMessage(),
                'raw' => [],
            ];
        }
    }

    /**
     * Vérification officielle de l'authenticité des webhooks KKiaPay.
     * Documentation officielle KKiaPay : header HTTP `x-kkiapay-secret` comparé en temps constant
     * au secret configuré sur le tableau de bord KKiaPay (`KKIAPAY_WEBHOOK_SECRET`).
     * Supporte également `x-kkiapay-signature` (HMAC-SHA256) si fourni.
     */
    public function verifyWebhookSignature(array $payload, array $headers): bool
    {
        if (empty($this->webhookSecret)) {
            Log::error('[KKIAPAY_WEBHOOK] Aucun secret webhook configuré (KKIAPAY_WEBHOOK_SECRET / KKIAPAY_SECRET_KEY).');

            return false;
        }

        $normalized = [];
        foreach ($headers as $k => $v) {
            $normalized[strtolower((string) $k)] = is_array($v) ? ($v[0] ?? null) : $v;
        }

        // Mécanisme officiel KKiaPay : en-tête x-kkiapay-secret
        $receivedSecret = $normalized['x-kkiapay-secret'] ?? null;
        if (is_string($receivedSecret) && $receivedSecret !== '') {
            return hash_equals($this->webhookSecret, $receivedSecret);
        }

        // Support complémentaire : signature HMAC-SHA256
        $signature = $normalized['x-kkiapay-signature'] ?? null;
        if (is_string($signature) && $signature !== '') {
            $rawBody = $normalized['__raw_body__'] ?? json_encode($payload);
            $computed = hash_hmac('sha256', (string) $rawBody, $this->webhookSecret);

            return hash_equals($computed, $signature);
        }

        return false;
    }

    protected function extractStateReference(array $data): ?string
    {
        $candidates = [
            $data['state'] ?? null,
            $data['stateData'] ?? null,
            $data['data'] ?? null,
            $data['partnerId'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (is_string($candidate)) {
                $trimmed = trim($candidate);
                if ($trimmed !== '') {
                    // Si la chaîne est un JSON contenant reference / reference_interne
                    if (str_starts_with($trimmed, '{')) {
                        $decoded = json_decode($trimmed, true);
                        if (is_array($decoded)) {
                            $ref = $decoded['reference'] ?? $decoded['reference_interne'] ?? null;
                            if (is_string($ref) && trim($ref) !== '') {
                                return trim($ref);
                            }
                        }
                    }

                    return $trimmed;
                }
            } elseif (is_array($candidate)) {
                $ref = $candidate['reference'] ?? $candidate['reference_interne'] ?? null;
                if (is_string($ref) && trim($ref) !== '') {
                    return trim($ref);
                }
            }
        }

        return null;
    }

    protected function failureResult(
        string $transactionId,
        string $gatewayStatus,
        string $message,
        int $httpStatus,
        array $raw = []
    ): array {
        return [
            'success' => false,
            'gateway_status' => $gatewayStatus,
            'http_status' => $httpStatus,
            'amount' => 0.0,
            'currency' => 'XOF',
            'fee' => 0.0,
            'net' => 0.0,
            'transaction_id' => $transactionId,
            'state_data' => null,
            'payment_method' => null,
            'message' => $message,
            'raw' => $raw,
        ];
    }
}
