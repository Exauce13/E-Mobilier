<?php

namespace App\Contracts;

interface PaymentGatewayInterface
{
    /**
     * Identifiant de la passerelle (ex: 'kkiapay', 'fedapay').
     */
    public function getName(): string;

    /**
     * Retourne la configuration pour le frontend ou le composant de paiement.
     */
    public function getWidgetConfig(int $amount, string $reason, array $metadata = []): array;

    /**
     * Réconcilie et vérifie une transaction auprès de l'API de l'agrégateur.
     *
     * @return array{
     *     success: bool,
     *     amount: float,
     *     fee: float,
     *     net: float,
     *     transaction_id: string,
     *     payment_method: string|null,
     *     message: string,
     *     raw: array
     * }
     */
    public function verifyTransaction(string $transactionId, int $expectedAmount = 0): array;

    /**
     * Déclenche un virement sortant (Payout / Décaissement) vers le compte bénéficiaire.
     *
     * @return array{
     *     success: bool,
     *     payout_id: string|null,
     *     status: string,
     *     message: string,
     *     raw: array
     * }
     */
    public function initiatePayout(string $beneficiaryAccount, float $amount, string $reference, array $metadata = []): array;

    /**
     * Valide l'authenticité de la signature cryptographique d'un webhook entrant.
     */
    public function verifyWebhookSignature(array $payload, array $headers): bool;
}

