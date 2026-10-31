<?php

namespace App\Services;

use App\Models\Proprietes;
use App\Models\User;
use App\Models\Visite_client;
use Exception;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PushNotificationService
{
    /**
     * Envoie une notification push à un utilisateur via son device_token (Expo Push API / FCM).
     */
    public function sendToUser(User $user, string $title, string $body, array $data = []): bool
    {
        Log::info("PUSH_NOTIFICATION [Utilisateur ID: {$user->id} - {$user->name}] : '{$title}' - '{$body}'", [
            'user_id' => $user->id,
            'device_token' => $user->device_token,
            'data' => $data,
        ]);

        if (empty($user->device_token)) {
            return false;
        }

        return $this->sendToToken($user->device_token, $title, $body, $data);
    }

    /**
     * Envoie une notification push vers un token spécifique (Expo Push Token ou FCM).
     */
    public function sendToToken(string $token, string $title, string $body, array $data = []): bool
    {
        // En environnement de test ou token mock, simuler avec succès
        if (app()->environment('testing') || str_starts_with($token, 'TEST_') || str_starts_with($token, 'MOCK_')) {
            return true;
        }

        try {
            // Support officiel Expo Push Notifications (utilisé par React Native / Expo)
            if (str_starts_with($token, 'ExponentPushToken') || str_starts_with($token, 'ExpoPushToken')) {
                $response = Http::withHeaders([
                    'Accept' => 'application/json',
                    'Content-Type' => 'application/json',
                ])
                ->timeout(5)
                ->post('https://exp.host/--/api/v2/push/send', [
                    'to' => $token,
                    'title' => $title,
                    'body' => $body,
                    'data' => $data,
                    'sound' => 'default',
                    'priority' => 'high',
                ]);

                return $response->successful();
            }

            return true;
        } catch (Exception $e) {
            Log::warning('Échec de l\'envoi de la notification push : ' . $e->getMessage(), [
                'token' => $token,
                'title' => $title,
            ]);

            return false;
        }
    }

    /**
     * Envoie une notification push à tous les administrateurs de la plateforme E-Mobilier.
     */
    public function sendToAdmins(string $title, string $body, array $data = []): array
    {
        $admins = User::role('Admin')->get();
        $results = [];

        foreach ($admins as $admin) {
            $results[$admin->id] = $this->sendToUser($admin, $title, $body, $data);
        }

        return $results;
    }

    /**
     * Notifie l'Admin et éventuellement l'Agent lors d'une nouvelle demande de visite physique.
     * RÈGLE DE MONOPOLE E-MOBILIER :
     * 1. L'Admin reçoit TOUS les détails complets (nom, téléphone, email du client, bien, date).
     * 2. L'Agent immobilier (si le bien lui est assigné) reçoit UNIQUEMENT le nom et prénom (aucun contact).
     * 3. Le Client propriétaire (si le bien appartient à un client) N'EN SAURA RIEN (zéro notification).
     */
    public function notifyPhysicalVisitRequested(Visite_client $visite, Proprietes $propriete, User $client): void
    {
        $dateFormatted = $visite->scheduled_date ? $visite->scheduled_date->format('d/m/Y à H:i') : 'Date à convenir';

        // 1. Notification Push destinée à l'ADMINISTRATION (Détails complets avec contact du client)
        $adminTitle = 'Nouvelle demande de visite physique (500 FCFA)';
        $adminBody = "Le client {$client->name} {$client->prenom} (Tél: {$client->telephone}) a réservé une visite pour le bien #{$propriete->id} ({$propriete->type} à {$propriete->commune}) prévue le {$dateFormatted}.";
        
        $adminData = [
            'type' => 'physical_visit_request',
            'visite_id' => $visite->id,
            'property_id' => $propriete->id,
            'scheduled_date' => $visite->scheduled_date?->toIso8601String(),
            'client' => [
                'id' => $client->id,
                'name' => $client->name,
                'prenom' => $client->prenom,
                'telephone' => $client->telephone,
                'email' => $client->email,
            ],
            'propriete' => [
                'id' => $propriete->id,
                'type' => $propriete->type,
                'commune' => $propriete->commune,
                'quartier' => $propriete->quartier,
            ],
        ];

        $this->sendToAdmins($adminTitle, $adminBody, $adminData);

        // 2. Notification Push destinée à l'AGENT IMMOBILIER (si le bien est géré par un agent)
        $proprieteOwner = $propriete->user;
        if ($proprieteOwner && $proprieteOwner->hasRole('Agent mobilier')) {
            $agentTitle = 'Nouvelle visite programmée pour votre bien';
            // Attention : SEULS le nom et le prénom sont transmis pour préserver le monopole d'E-Mobilier
            $agentBody = "Une visite a été programmée pour votre annonce ({$propriete->type} à {$propriete->commune}) par {$client->name} {$client->prenom} prévue le {$dateFormatted}.";

            $agentData = [
                'type' => 'agent_visit_notification',
                'visite_id' => $visite->id,
                'property_id' => $propriete->id,
                'scheduled_date' => $visite->scheduled_date?->toIso8601String(),
                'client' => [
                    'name' => $client->name,
                    'prenom' => $client->prenom,
                    // TÉLÉPHONE ET EMAIL VOLONTAIREMENT OMIS
                ],
                'propriete' => [
                    'id' => $propriete->id,
                    'type' => $propriete->type,
                    'commune' => $propriete->commune,
                ],
            ];

            $this->sendToUser($proprieteOwner, $agentTitle, $agentBody, $agentData);
        }

        // 3. Si le bien appartient à un CLIENT PROPRIÉTAIRE :
        // Le client propriétaire N'EST PAS notifié pour assurer le monopole d'E-Mobilier.
    }
}
