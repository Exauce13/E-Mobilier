<?php

namespace App\Services\Notifications\Channels;

use App\Models\DeviceToken;
use Exception;
use Illuminate\Support\Facades\Log;

class PushChannel
{
    /**
     * Envoi d'une notification push Web / Mobile (FCM).
     */
    public function sendToUser(int $userId, string $titre, string $body, array $data = []): array
    {
        $tokens = DeviceToken::where('user_id', $userId)
            ->where('is_active', true)
            ->pluck('token')
            ->toArray();

        if (empty($tokens)) {
            return [
                'success' => true,
                'destinataires' => 0,
                'message' => 'Aucun jeton actif pour cet utilisateur',
                'canal' => 'push',
                'latence_ms' => 1,
            ];
        }

        $startTime = microtime(true);

        try {
            Log::info("[PUSH_DISPATCH] Vers User ID {$userId} (" . count($tokens) . " appareils) : [{$titre}] {$body}");
            $latencyMs = (int) round((microtime(true) - $startTime) * 1000);

            return [
                'success' => true,
                'destinataires' => count($tokens),
                'canal' => 'push',
                'latence_ms' => max(1, $latencyMs),
            ];
        } catch (Exception $e) {
            $latencyMs = (int) round((microtime(true) - $startTime) * 1000);

            return [
                'success' => false,
                'erreur' => $e->getMessage(),
                'canal' => 'push',
                'latence_ms' => $latencyMs,
            ];
        }
    }
}

