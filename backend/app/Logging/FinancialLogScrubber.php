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
        $message = $this->sanitizeMessage($record->message);

        return $record->with(message: $message, context: $context, extra: $extra);
    }

    protected function sanitizeMessage(string $message): string
    {
        $pattern = '/\b(montant|solde|amount|balance|secret_key|code_otp|otp)\s*[:=]\s*([^\s,;]+)/i';

        return (string) preg_replace($pattern, '$1=[CONFIDENTIEL_FINANCE]', $message);
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

