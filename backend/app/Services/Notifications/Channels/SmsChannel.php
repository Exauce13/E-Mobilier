<?php

namespace App\Services\Notifications\Channels;

use Exception;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SmsChannel
{
    /**
     * Envoi d'un SMS transactionnel (Canal de repli ou direct).
     */
    public function send(string $telephone, string $message, array $metadata = []): array
    {
        $startTime = microtime(true);

        try {
            $apiUrl = config('emobilier.sms.api_url');
            $apiKey = config('emobilier.sms.api_key');
            $sender = config('emobilier.sms.sender_id', 'E-MOBILIER');

            if (app()->environment(['local', 'testing']) || empty($apiUrl) || empty($apiKey)) {
                Log::info("[SMS_DISPATCH] Vers {$telephone} [Sender: {$sender}] : {$message}");
                $latencyMs = (int) round((microtime(true) - $startTime) * 1000);

                return [
                    'success' => true,
                    'message_id' => 'SMS-SIM-' . uniqid(),
                    'canal' => 'sms',
                    'latence_ms' => max(1, $latencyMs),
                ];
            }

            $response = Http::withHeaders(['Authorization' => 'Bearer ' . $apiKey])
                ->timeout(5)
                ->post($apiUrl, [
                    'to' => $telephone,
                    'from' => $sender,
                    'text' => $message,
                ]);

            $latencyMs = (int) round((microtime(true) - $startTime) * 1000);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'message_id' => $response->json('message_id') ?? ('SMS-' . uniqid()),
                    'canal' => 'sms',
                    'latence_ms' => $latencyMs,
                ];
            }

            return [
                'success' => false,
                'erreur' => 'Erreur API SMS: ' . $response->body(),
                'canal' => 'sms',
                'latence_ms' => $latencyMs,
            ];
        } catch (Exception $e) {
            $latencyMs = (int) round((microtime(true) - $startTime) * 1000);

            return [
                'success' => false,
                'erreur' => $e->getMessage(),
                'canal' => 'sms',
                'latence_ms' => $latencyMs,
            ];
        }
    }
}

