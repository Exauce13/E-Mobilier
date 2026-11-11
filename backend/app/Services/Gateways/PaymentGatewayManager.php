<?php

namespace App\Services\Gateways;

use App\Contracts\PaymentGatewayInterface;
use InvalidArgumentException;

class PaymentGatewayManager
{
    protected array $gateways = [];

    public function gateway(?string $name = null): PaymentGatewayInterface
    {
        $name = strtolower($name ?: config('emobilier.payment_gateway', env('PAYMENT_GATEWAY', 'kkiapay')));

        if (! isset($this->gateways[$name])) {
            $this->gateways[$name] = $this->createGateway($name);
        }

        return $this->gateways[$name];
    }

    protected function createGateway(string $name): PaymentGatewayInterface
    {
        return match ($name) {
            'kkiapay' => new KkiapayGatewayAdapter(),
            'fedapay' => new FedapayGatewayAdapter(),
            default => throw new InvalidArgumentException("Passerelle de paiement non supportée : '{$name}'."),
        };
    }
}

