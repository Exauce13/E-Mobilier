<?php

namespace App\Services\Notifications\Channels;

use Exception;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppChannel
{
    /**
     * Envoi d'un message WhatsApp via l'API Cloud (Meta ou agrégateur local).
     * En environnement local ou test, simule l'expédition.
     */
    public function send(string $telephone, string $message, array $metadata = []): array
    {
        $startTime = microtime(true);

        try {
            $apiUrl = config('emobilier.whatsapp.api_url');
            $apiToken = config('emobilier.whatsapp.api_token');

            // Simulation en local ou test ou si non configuré
            if (app()->environment(['local', 'testing']) || empty($apiUrl) || empty($apiToken)) {
                Log::info("[WHATSAPP_DISPATCH] Vers {$telephone} : {$message}");
                $latencyMs = (int) round((microtime(true) - $startTime) * 1000);

                return [
                    'success' => true,
                    'message_id' => 'WA-SIM-' . uniqid(),
                    'canal' => 'whatsapp',
                    'latence_ms' => max(1, $latencyMs),
                ];
            }

            $response = Http::withToken($apiToken)
                ->timeout(5)
                ->post($apiUrl, [
                    'messaging_product' => 'whatsapp',
                    'to' => $telephone,
                    'type' => 'text',
                    'text' => ['body' => $message],
                ]);

            $latencyMs = (int) round((microtime(true) - $startTime) * 1000);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'message_id' => $response->json('messages.0.id') ?? ('WA-' . uniqid()),
                    'canal' => 'whatsapp',
                    'latence_ms' => $latencyMs,
                ];
            }

            return [
                'success' => false,
                'erreur' => 'Erreur API WhatsApp: ' . $response->body(),
                'canal' => 'whatsapp',
                'latence_ms' => $latencyMs,
            ];
        } catch (Exception $e) {
            $latencyMs = (int) round((microtime(true) - $startTime) * 1000);

            return [
                'success' => false,
                'erreur' => $e->getMessage(),
                'canal' => 'whatsapp',
                'latence_ms' => $latencyMs,
            ];
        }
    }
}

