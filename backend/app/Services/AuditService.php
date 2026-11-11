<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

class AuditService
{
    /**
     * Enregistre un événement dans la table d'audit immuable.
     */
    public static function log(string $action, ?Model $target = null, array $details = [], bool $isFinancial = false, ?int $userId = null): AuditLog
    {
        return AuditLog::log($action, $target, $details, $isFinancial, $userId);
    }

    /**
     * Enregistre une alerte de sécurité critique.
     */
    public static function securityAlert(string $action, string $message, array $context = []): AuditLog
    {
        Log::channel('single')->warning("[SECURITY_ALERT] {$action} : {$message}", $context);

        return AuditLog::log("SECURITY_ALERT:{$action}", null, array_merge(['message' => $message], $context), false);
    }
}

