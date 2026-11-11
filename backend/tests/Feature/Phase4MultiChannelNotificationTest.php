<?php

namespace Tests\Feature;

use App\Models\DeviceToken;
use App\Models\NotificationAuditLog;
use App\Models\NotificationInterne;
use App\Models\Paiement;
use App\Models\User;
use App\Services\FinancialLedgerService;
use App\Services\Notifications\MultiChannelNotificationService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class Phase4MultiChannelNotificationTest extends TestCase
{
    use DatabaseTransactions;

    protected User $justinOwner;
    protected User $techAdmin;
    protected User $secretaire;
    protected User $client;
    protected MultiChannelNotificationService $notificationService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->notificationService = app(MultiChannelNotificationService::class);

        // 1. Justin MAGNIDE (Super Admin Principal & Owner)
        $this->justinOwner = User::firstOrCreate(
            ['email' => 'justin.magnide@e-mobilier.bj'],
            [
                'name' => 'MAGNIDE',
                'prenom' => 'Justin',
                'telephone' => '+22997000001',
                'password' => bcrypt('Secret123!'),
                'statut' => 'actif',
                'is_verifed' => true,
            ]
        );
        $this->justinOwner->syncRoles(['Super Admin Principal', 'Admin']);

        // 2. Jean-Paul GNIKPO (Super Admin Technique)
        $this->techAdmin = User::firstOrCreate(
            ['email' => 'tech.p4@e-mobilier.bj'],
            [
                'name' => 'GNIKPO',
                'prenom' => 'Jean-Paul',
                'telephone' => '+22997000002',
                'password' => bcrypt('Secret123!'),
                'statut' => 'actif',
                'is_verifed' => true,
            ]
        );
        $this->techAdmin->syncRoles(['Super Admin Technique', 'Admin']);

        // 3. Secrétaire
        $this->secretaire = User::firstOrCreate(
            ['email' => 'secretaire.p4@e-mobilier.bj'],
            [
                'name' => 'Secrétaire',
                'prenom' => 'P4',
                'telephone' => '+22997000003',
                'password' => bcrypt('Secret123!'),
                'statut' => 'actif',
                'is_verifed' => true,
            ]
        );
        $this->secretaire->syncRoles(['Secrétaire']);

        // 4. Client
        $this->client = User::firstOrCreate(
            ['email' => 'client.p4@gmail.com'],
            [
                'name' => 'Client',
                'prenom' => 'P4',
                'telephone' => '+22997000004',
                'password' => bcrypt('Secret123!'),
                'statut' => 'actif',
                'is_verifed' => true,
            ]
        );
        $this->client->syncRoles(['Client']);
    }

    public function test_authenticated_user_can_register_and_revoke_device_token(): void
    {
        $testToken = 'fcm_fake_token_' . uniqid();

        // 1. Enregistrement du token push
        $response = $this->actingAs($this->client, 'sanctum')->postJson('/api/user/device-token', [
            'token' => $testToken,
            'platform' => 'android',
            'device_name' => 'Pixel 8 Pro',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'platform' => 'android',
                    'is_active' => true,
                ],
            ]);

        $this->assertDatabaseHas('device_tokens', [
            'user_id' => $this->client->id,
            'token' => $testToken,
            'platform' => 'android',
        ]);

        // 2. Révocation du token push
        $deleteResponse = $this->actingAs($this->client, 'sanctum')->deleteJson('/api/user/device-token', [
            'token' => $testToken,
        ]);

        $deleteResponse->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseMissing('device_tokens', [
            'user_id' => $this->client->id,
            'token' => $testToken,
        ]);
    }

    public function test_notification_flow_on_payment_confirmation_segregates_content_per_profile(): void
    {
        $txId = 'NOTIF-TEST-' . time();

        // Appel webhook simulant un paiement validé
        $responseWebhook = $this->postJson('/api/kkiapay/webhook', [
            'transactionId' => $txId,
            'amount' => 500,
            'event' => 'payment_success',
        ]);

        $responseWebhook->assertStatus(200);

        // 1. Vérification de l'alerte pour Justin dans le journal d'audit (Montant présent)
        $auditJustin = NotificationAuditLog::where('destinataire_type', 'justin')
            ->where('reference_evenement', $txId)
            ->first();

        $this->assertNotNull($auditJustin);
        $this->assertEquals(500.0, (float) $auditJustin->montant);
        $this->assertEquals('critique-securite', $auditJustin->file_priorite);
        $this->assertStringContainsString('500 FCFA', $auditJustin->contenu_confidentiel);

        // 2. Vérification de la notification opérationnelle pour la Secrétaire (Zéro montant)
        $notifSecretaire = NotificationInterne::where('user_id', $this->secretaire->id)->latest()->first();
        $this->assertNotNull($notifSecretaire);
        $this->assertStringNotContainsString('500', $notifSecretaire->message);
        $this->assertArrayNotHasKey('montant', $notifSecretaire->data ?? []);
    }

    public function test_secondary_admin_viewing_notifications_never_receives_financial_amounts(): void
    {
        // Créer une notification interne pour la Secrétaire
        NotificationInterne::create([
            'user_id' => $this->secretaire->id,
            'type' => 'visite',
            'titre' => 'Nouvelle visite',
            'message' => 'Une visite a été validée pour la parcelle #12.',
            'data' => [
                'visite_id' => 12,
                'montant' => 500, // Doit être purgé par le contrôleur !
                'solde' => 15000, // Doit être purgé !
            ],
        ]);

        $response = $this->actingAs($this->secretaire, 'sanctum')->getJson('/api/notifications');

        $response->assertStatus(200)
            ->assertJsonStructure(['success', 'statistiques', 'data']);

        $json = $response->getContent();
        // Vérification stricte d'étanchéité : aucun montant présent pour la secrétaire
        $this->assertStringNotContainsString('montant', strtolower($json));
        $this->assertStringNotContainsString('solde', strtolower($json));
    }

    public function test_financial_notification_audit_is_strictly_restricted_to_justin(): void
    {
        // Le Tech Admin tente d'accéder au journal d'audit des notifications financières
        $resTech = $this->actingAs($this->techAdmin, 'sanctum')->getJson('/api/finance/notifications/audit');
        $resTech->assertStatus(403);

        // Justin MAGNIDE accède à son journal d'audit financier
        $resJustin = $this->actingAs($this->justinOwner, 'sanctum')->getJson('/api/finance/notifications/audit');
        $resJustin->assertStatus(200)
            ->assertJsonStructure(['success', 'data', 'totaux', 'pagination']);
    }

    public function test_tech_admin_can_view_notification_logs_and_relaunch_failed_without_financial_data(): void
    {
        // 1. Créer un log technique en échec
        $failedLog = NotificationAuditLog::create([
            'reference_evenement' => 'FAIL-NOTIF-01',
            'file_priorite' => 'notifications-paiement',
            'canal' => 'whatsapp',
            'destinataire_type' => 'client',
            'destinataire_identifiant' => '+22997000000',
            'sujet' => 'Alerte visite',
            'contenu_public' => 'Message public sans finance',
            'contenu_confidentiel' => 'Donnée confidentielle 100 000 FCFA',
            'montant' => 100000,
            'statut' => 'echec',
            'tentatives' => 3,
            'erreur_technique' => 'Timeout connexion WhatsApp Cloud API',
            'latence_ms' => 5200,
        ]);

        // 2. Le Super Admin Tech consulte les logs techniques
        $responseLogs = $this->actingAs($this->techAdmin, 'sanctum')->getJson('/api/tech/notifications/logs');

        $responseLogs->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'statistiques_techniques' => [
                    'total_evenements',
                    'taux_succes_pourcentage',
                    'total_en_echec_dlq',
                ],
                'data',
            ]);

        $jsonLogs = $responseLogs->getContent();
        // Vérification d'exclusion des données financières
        $this->assertStringNotContainsString('contenu_confidentiel', $jsonLogs);
        $this->assertStringNotContainsString('100000', $jsonLogs);

        // 3. Relance de la notification en échec (Dead Letter Queue)
        $responseRelance = $this->actingAs($this->techAdmin, 'sanctum')->postJson("/api/tech/notifications/{$failedLog->id}/relancer");

        $responseRelance->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Notification réinjectée avec succès dans la file prioritaire SMS.',
            ]);

        $failedLog->refresh();
        $this->assertEquals('relance_effectuee', $failedLog->statut);
    }
}

