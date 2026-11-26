<?php

namespace App\Services;

use App\Services\Gateways\KkiapayGatewayAdapter;

/**
 * Façade unifiée vers KkiapayGatewayAdapter afin d'éliminer toute duplication
 * et garantir une autorité unique de vérification serveur-à-serveur.
 */
class KkiapayService
{
    protected KkiapayGatewayAdapter $adapter;

    public function __construct(?KkiapayGatewayAdapter $adapter = null)
    {
        $this->adapter = $adapter ?? app(KkiapayGatewayAdapter::class);
    }

    /**
     * Vérifie une transaction Kkiapay auprès de l'API REST officielle.
     */
    public function verifyTransaction(string $transactionId, int $expectedAmount = 0): array
    {
        return $this->adapter->verifyTransaction($transactionId, $expectedAmount);
    }

    /**
     * Retourne la configuration publique Kkiapay pour le frontend (widget de paiement).
     */
    public function getWidgetConfig(int $amount, string $reason = 'Souscription publication E-Mobilier', array $metadata = []): array
    {
        return $this->adapter->getWidgetConfig($amount, $reason, $metadata);
    }
}
