<?php

namespace App\Logging;

use Monolog\LogRecord;
use Monolog\Processor\ProcessorInterface;

class FinancialLogScrubber implements ProcessorInterface
{
    /**
     * Clés sensibles à caviarder dans les logs.
     */
    protected array $sensitiveKeys = [
        'montant',
        'solde',
        'amount',
        'balance',
        'secret_key',
        'private_key',
        'otp',
        'code_otp',
        'payout_amount',
        'solde_disponible',
    ];

    public function __invoke(LogRecord $record): LogRecord
    {
        $context = $this->sanitizeArray($record->context);
        $extra = $this->sanitizeArray($record->extra);

        return $record->with(context: $context, extra: $extra);
    }

    protected function sanitizeArray(array $data): array
    {
        foreach ($data as $key => $value) {
            $lowerKey = strtolower((string) $key);

            if (in_array($lowerKey, $this->sensitiveKeys, true)) {
                $data[$key] = '[CONFIDENTIEL_FINANCE]';
            } elseif (is_array($value)) {
                $data[$key] = $this->sanitizeArray($value);
            }
        }

        return $data;
    }
}

