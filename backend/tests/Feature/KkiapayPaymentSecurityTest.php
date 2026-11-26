<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\GrandLivre;
use App\Models\Paiement;
use App\Models\Proprietes;
use App\Models\User;
use App\Services\FinancialLedgerService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Suite exhaustive des 13 scénarios obligatoires Kkiapay :
 * Toutes les réponses externes Kkiapay (/api/v1/transactions/status) sont explicitement
 * mockées via Http::fake() — AUCUN contournement n'existe dans le code applicatif.
 */
class KkiapayPaymentSecurityTest extends TestCase
{
    use DatabaseTransactions;

    protected User $client;
    protected User $otherClient;
    protected User $agent;
    protected string $webhookSecret = 'test_kkiapay_webhook_secret_emobilier_2026';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');

        Role::firstOrCreate(['name' => 'Client']);
        Role::firstOrCreate(['name' => 'Agent mobilier']);
        Role::firstOrCreate(['name' => 'Admin']);

        Config::set('services.kkiapay.sandbox', true);
        Config::set('services.kkiapay.base_url', 'https://api-sandbox.kkiapay.me');
        Config::set('services.kkiapay.public_key', 'pk_test_emobilier_public');
        Config::set('services.kkiapay.private_key', 'tpk_test_emobilier_private');
        Config::set('services.kkiapay.secret_key', 'tsk_test_emobilier_secret');
        Config::set('services.kkiapay.webhook_secret', $this->webhookSecret);

        $suffix = (string) random_int(10000000, 99999999);
        $this->client = User::factory()->create(['telephone' => '+22901' . $suffix]);
        $this->client->assignRole('Client');

        $suffix2 = (string) random_int(10000000, 99999999);
        $this->otherClient = User::factory()->create(['telephone' => '+22901' . $suffix2]);
        $this->otherClient->assignRole('Client');

        $suffix3 = (string) random_int(10000000, 99999999);
        $this->agent = User::factory()->create(['telephone' => '+22901' . $suffix3]);
        $this->agent->assignRole('Agent mobilier');
    }

    protected function propertyPayload(array $overrides = []): array
    {
        return array_merge([
            'type' => 'chambre',
            'transaction_type' => 'location',
            'commune' => 'Cotonou',
            'arrondissement' => 'Akpakpa',
            'quartier' => 'Dédokpo',
            'accessibilite' => 'Voie pavée',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 28,
            'nombres_chambres' => 1,
            'avance_mois' => 3,
            'prix' => 40000,
            'photo' => UploadedFile::fake()->create('bien.jpg', 120, 'image/jpeg'),
        ], $overrides);
    }

    protected function initiatePublication(User $user, string $operationType = 'publication_client'): array
    {
        $res = $this->actingAs($user, 'sanctum')->postJson('/api/paiements/initier', [
            'type_operation' => $operationType,
            'cgu_acceptees' => true,
        ]);
        $res->assertStatus(201);

        return $res->json('data');
    }

    /**
     * Scénario 1 : Paiement réellement réussi (S2S vérifié auprès de Kkiapay -> Grand Livre + publication)
     */
    public function test_01_successful_payment_verified_server_to_server_and_publishes_property(): void
    {
        $init = $this->initiatePublication($this->client, 'publication_client');
        $ref = $init['reference'];
        $txId = 'KK_LIVE_OK_' . uniqid();

        Http::fake([
            'https://api-sandbox.kkiapay.me/api/v1/transactions/status' => Http::response([
                'status' => 'SUCCESS',
                'transactionId' => $txId,
                'amount' => 500,
                'fees' => 10,
                'currency' => 'XOF',
                'source' => 'MOBILE_MONEY',
                'source_common_name' => 'mtn-benin',
                'state' => $ref,
            ], 200),
        ]);

        // 1. Vérification S2S via callback automatique
        $verifyRes = $this->actingAs($this->client, 'sanctum')->postJson('/api/paiements/verifier', [
            'transactionId' => $txId,
            'reference' => $ref,
        ]);

        $verifyRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'transaction_id' => $txId,
                    'reference' => $ref,
                    'amount' => 500,
                    'currency' => 'XOF',
                    'status' => 'successful',
                    'normalized_status' => 'success',
                ],
            ]);

        // Vérifier que les 3 en-têtes officiels Kkiapay ont été transmis côté serveur
        Http::assertSent(function ($request) use ($txId) {
            return $request->url() === 'https://api-sandbox.kkiapay.me/api/v1/transactions/status'
                && $request->hasHeader('x-api-key', 'pk_test_emobilier_public')
                && $request->hasHeader('x-private-key', 'tpk_test_emobilier_private')
                && $request->hasHeader('x-secret-key', 'tsk_test_emobilier_secret')
                && $request['transactionId'] === $txId;
        });

        // 2. Publication de l'annonce autorisée après confirmation
        $pubRes = $this->actingAs($this->client, 'sanctum')->postJson('/api/proprietes', $this->propertyPayload([
            'payment_reference' => $ref,
            'kkiapay_transaction_id' => $txId,
        ]));

        $pubRes->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.souscription.reference', $ref)
            ->assertJsonPath('data.souscription.gateway_transaction_id', $txId);

        $propertyId = $pubRes->json('data.propriete.id');
        $this->assertDatabaseHas('paiements', [
            'transaction_reference' => $ref,
            'gateway_transaction_id' => $txId,
            'property_id' => $propertyId,
            'status' => 'successful',
            'currency' => 'XOF',
        ]);
        $this->assertEquals(1, GrandLivre::where('gateway_transaction_id', $txId)->count());
    }

    /**
     * Scénario 2 : Paiement échoué côté Kkiapay -> refusé, statut failed, aucune publication
     */
    public function test_02_failed_payment_is_rejected_and_cannot_publish(): void
    {
        $init = $this->initiatePublication($this->client, 'publication_client');
        $ref = $init['reference'];
        $txId = 'KK_FAILED_' . uniqid();

        Http::fake([
            'https://api-sandbox.kkiapay.me/api/v1/transactions/status' => Http::response([
                'status' => 'FAILED',
                'transactionId' => $txId,
                'amount' => 500,
                'failureMessage' => 'Solde Mobile Money insuffisant.',
            ], 200),
        ]);

        $verifyRes = $this->actingAs($this->client, 'sanctum')->postJson('/api/paiements/verifier', [
            'transactionId' => $txId,
            'reference' => $ref,
        ]);

        $verifyRes->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('status', 'failed');

        $this->assertDatabaseHas('paiements', [
            'transaction_reference' => $ref,
            'status' => 'failed',
        ]);
        $this->assertEquals(0, GrandLivre::where('gateway_transaction_id', $txId)->count());

        // Impossible de publier avec ce paiement échoué
        $pubRes = $this->actingAs($this->client, 'sanctum')->postJson('/api/proprietes', $this->propertyPayload([
            'payment_reference' => $ref,
            'kkiapay_transaction_id' => $txId,
        ]));
        $pubRes->assertStatus(422);
    }

    /**
     * Scénario 3 : Paiement annulé par l'utilisateur -> statut cancelled, aucune publication
     */
    public function test_03_cancelled_payment_marks_cancelled_and_blocks_publication(): void
    {
        $init = $this->initiatePublication($this->client, 'publication_client');
        $ref = $init['reference'];

        $cancelRes = $this->actingAs($this->client, 'sanctum')->postJson("/api/paiements/{$ref}/annuler", [
            'reason' => 'Fermeture du widget par utilisateur',
        ]);

        $cancelRes->assertStatus(200)
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.normalized_status', 'cancelled');

        $this->assertDatabaseHas('paiements', [
            'transaction_reference' => $ref,
            'status' => 'cancelled',
        ]);

        $pubRes = $this->actingAs($this->client, 'sanctum')->postJson('/api/proprietes', $this->propertyPayload([
            'payment_reference' => $ref,
        ]));
        $pubRes->assertStatus(402);
    }

    /**
     * Scénario 4 : Paiement en attente (PENDING) -> reste pending (202), aucune publication prématurée
     */
    public function test_04_pending_payment_stays_pending_and_blocks_premature_publication(): void
    {
        $init = $this->initiatePublication($this->client, 'publication_client');
        $ref = $init['reference'];
        $txId = 'KK_PENDING_' . uniqid();

        Http::fake([
            'https://api-sandbox.kkiapay.me/api/v1/transactions/status' => Http::response([
                'status' => 'PENDING',
                'transactionId' => $txId,
                'amount' => 500,
                'currency' => 'XOF',
            ], 200),
        ]);

        $verifyRes = $this->actingAs($this->client, 'sanctum')->postJson('/api/paiements/verifier', [
            'transactionId' => $txId,
            'reference' => $ref,
        ]);

        $verifyRes->assertStatus(202)
            ->assertJsonPath('success', false)
            ->assertJsonPath('status', 'pending');

        $this->assertDatabaseHas('paiements', [
            'transaction_reference' => $ref,
            'gateway_transaction_id' => $txId,
            'status' => 'pending',
        ]);
        $this->assertEquals(0, GrandLivre::where('gateway_transaction_id', $txId)->count());

        // Tentative de publication alors que le paiement est encore pending -> refus
        $pubRes = $this->actingAs($this->client, 'sanctum')->postJson('/api/proprietes', $this->propertyPayload([
            'payment_reference' => $ref,
            'kkiapay_transaction_id' => $txId,
        ]));
        $pubRes->assertStatus(202)->assertJsonPath('success', false);
    }

    /**
     * Scénario 5 : Transaction inexistante (HTTP 404 côté Kkiapay) -> refus strict 422
     */
    public function test_05_non_existent_transaction_is_rejected(): void
    {
        $init = $this->initiatePublication($this->client, 'publication_client');
        $ref = $init['reference'];

        Http::fake([
            'https://api-sandbox.kkiapay.me/api/v1/transactions/status' => Http::response([
                'message' => 'Transaction not found',
            ], 404),
        ]);

        $res = $this->actingAs($this->client, 'sanctum')->postJson('/api/paiements/verifier', [
            'transactionId' => 'NON_EXISTENT_999999',
            'reference' => $ref,
        ]);

        $res->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('code', 'NOT_FOUND');

        $this->assertDatabaseHas('paiements', [
            'transaction_reference' => $ref,
            'status' => 'pending',
        ]);
    }

    /**
     * Scénario 6 : Identifiant de transaction falsifié (TEST_ / MOCK_ / PAY-...) -> AUCUN bypass !
     */
    public function test_06_forged_transaction_id_prefixes_cannot_bypass_verification(): void
    {
        $init = $this->initiatePublication($this->client, 'publication_client');
        $ref = $init['reference'];

        Http::fake([
            'https://api-sandbox.kkiapay.me/api/v1/transactions/status' => Http::response([
                'message' => 'Invalid transaction',
            ], 404),
        ]);

        foreach (['TEST_BYPASS_123', 'MOCK_BYPASS_456', 'PAY-FORGED-789'] as $forgedId) {
            $res = $this->actingAs($this->client, 'sanctum')->postJson('/api/paiements/verifier', [
                'transactionId' => $forgedId,
                'reference' => $ref,
            ]);
            $res->assertStatus(422)->assertJsonPath('success', false);
        }

        $this->assertDatabaseHas('paiements', [
            'transaction_reference' => $ref,
            'status' => 'pending',
        ]);
    }

    /**
     * Scénario 7 : Montant falsifié (ex: 100 F payés au lieu de 500 F officiels Client) -> refus + audit
     */
    public function test_07_tampered_amount_is_rejected_and_logged(): void
    {
        $init = $this->initiatePublication($this->client, 'publication_client');
        $ref = $init['reference'];
        $txId = 'KK_UNDERPAID_' . uniqid();

        Http::fake([
            'https://api-sandbox.kkiapay.me/api/v1/transactions/status' => Http::response([
                'status' => 'SUCCESS',
                'transactionId' => $txId,
                'amount' => 100, // Client doit payer 500 F !
                'currency' => 'XOF',
                'state' => $ref,
            ], 200),
        ]);

        $res = $this->actingAs($this->client, 'sanctum')->postJson('/api/paiements/verifier', [
            'transactionId' => $txId,
            'reference' => $ref,
        ]);

        $res->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('code', 'AMOUNT_MISMATCH');

        $this->assertDatabaseHas('paiements', [
            'transaction_reference' => $ref,
            'status' => 'pending',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'paiement_anomalie_montant',
        ]);
        $this->assertEquals(0, GrandLivre::where('gateway_transaction_id', $txId)->count());
    }

    /**
     * Scénario 8 : Devise incorrecte (EUR au lieu de XOF) -> refus strict + journalisation
     */
    public function test_08_invalid_currency_is_rejected_and_logged(): void
    {
        $init = $this->initiatePublication($this->client, 'publication_client');
        $ref = $init['reference'];
        $txId = 'KK_EUR_' . uniqid();

        Http::fake([
            'https://api-sandbox.kkiapay.me/api/v1/transactions/status' => Http::response([
                'status' => 'SUCCESS',
                'transactionId' => $txId,
                'amount' => 500,
                'currency' => 'EUR',
                'state' => $ref,
            ], 200),
        ]);

        $res = $this->actingAs($this->client, 'sanctum')->postJson('/api/paiements/verifier', [
            'transactionId' => $txId,
            'reference' => $ref,
        ]);

        $res->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('code', 'INVALID_CURRENCY');

        $this->assertEquals(0, GrandLivre::where('gateway_transaction_id', $txId)->count());
    }

    /**
     * Scénario 9 : Transaction Kkiapay déjà utilisée -> refus sur une 2e intention, un 2e utilisateur ou une 2e annonce
     */
    public function test_09_already_used_transaction_cannot_be_reused(): void
    {
        $init1 = $this->initiatePublication($this->client, 'publication_client');
        $init2 = $this->initiatePublication($this->client, 'publication_client');
        $txId = 'KK_SINGLE_USE_' . uniqid();

        Http::fake([
            'https://api-sandbox.kkiapay.me/api/v1/transactions/status' => Http::response([
                'status' => 'SUCCESS',
                'transactionId' => $txId,
                'amount' => 500,
                'currency' => 'XOF',
                'state' => $init1['reference'],
            ], 200),
        ]);

        // 1. Validation légitime sur init1
        $this->actingAs($this->client, 'sanctum')->postJson('/api/paiements/verifier', [
            'transactionId' => $txId,
            'reference' => $init1['reference'],
        ])->assertStatus(200);

        // 2. Tentative de réutilisation sur une 2e référence interne (init2) -> 409
        $reuseRefRes = $this->actingAs($this->client, 'sanctum')->postJson('/api/paiements/verifier', [
            'transactionId' => $txId,
            'reference' => $init2['reference'],
        ]);
        $reuseRefRes->assertStatus(409)->assertJsonPath('code', 'TRANSACTION_ALREADY_USED');

        // 3. Tentative par un autre utilisateur -> 409
        $otherUserRes = $this->actingAs($this->otherClient, 'sanctum')->postJson('/api/paiements/verifier', [
            'transactionId' => $txId,
            'reference' => $init1['reference'],
        ]);
        $otherUserRes->assertStatus(409)->assertJsonPath('code', 'TRANSACTION_ALREADY_USED');

        // 4. Publication 1 réussit, Publication 2 avec même transaction échoue (422)
        $this->actingAs($this->client, 'sanctum')->postJson('/api/proprietes', $this->propertyPayload([
            'payment_reference' => $init1['reference'],
            'kkiapay_transaction_id' => $txId,
        ]))->assertStatus(201);

        $this->actingAs($this->client, 'sanctum')->postJson('/api/proprietes', $this->propertyPayload([
            'payment_reference' => $init1['reference'],
            'kkiapay_transaction_id' => $txId,
            'photo' => UploadedFile::fake()->create('bien2.jpg', 120, 'image/jpeg'),
        ]))->assertStatus(422);
    }

    /**
     * Scénario 10 : Plusieurs notifications webhook pour une même transaction + rejet signature invalide
     */
    public function test_10_duplicate_webhooks_are_idempotent_and_invalid_signature_is_rejected(): void
    {
        $init = $this->initiatePublication($this->client, 'publication_client');
        $ref = $init['reference'];
        $txId = 'KK_WEBHOOK_IDEMP_' . uniqid();

        Http::fake([
            'https://api-sandbox.kkiapay.me/api/v1/transactions/status' => Http::response([
                'status' => 'SUCCESS',
                'transactionId' => $txId,
                'amount' => 500,
                'fees' => 10,
                'currency' => 'XOF',
                'state' => $ref,
            ], 200),
        ]);

        // 1. Webhook SANS secret valide -> 401
        $this->postJson('/api/kkiapay/webhook', [
            'transactionId' => $txId,
            'stateData' => $ref,
            'event' => 'transaction.success',
        ])->assertStatus(401);

        $ledger = app(FinancialLedgerService::class);
        $soldeAvant = $ledger->getSoldeDisponible();

        // 2. Premier webhook authentifié (x-kkiapay-secret) -> 200 & 1 crédit
        $w1 = $this->withHeader('x-kkiapay-secret', $this->webhookSecret)
            ->postJson('/api/kkiapay/webhook', [
                'transactionId' => $txId,
                'stateData' => $ref,
                'event' => 'transaction.success',
            ]);
        $w1->assertStatus(200)->assertJsonPath('success', true)->assertJsonPath('is_duplicate', false);
        $soldeApres1 = $ledger->getSoldeDisponible();
        $this->assertGreaterThan($soldeAvant, $soldeApres1);

        // 3. 2e et 3e notifications identiques -> ignorées, zéro double crédit
        for ($i = 0; $i < 2; $i++) {
            $wDup = $this->withHeader('x-kkiapay-secret', $this->webhookSecret)
                ->postJson('/api/kkiapay/webhook', [
                    'transactionId' => $txId,
                    'stateData' => $ref,
                    'event' => 'transaction.success',
                ]);
            $wDup->assertStatus(200)->assertJsonPath('is_duplicate', true);
        }

        $this->assertEquals($soldeApres1, $ledger->getSoldeDisponible());
        $this->assertEquals(1, GrandLivre::where('gateway_transaction_id', $txId)->count());
    }

    /**
     * Scénario 11 : Fermeture accidentelle du navigateur -> récupération & actualisation via référence interne
     */
    public function test_11_browser_close_recovery_via_internal_reference_without_manual_tx_id(): void
    {
        $init = $this->initiatePublication($this->client, 'publication_client');
        $ref = $init['reference'];
        $txId = 'KK_RECOVER_' . uniqid();

        // Étape 1 : Premier retour Kkiapay = PENDING (le navigateur se ferme ensuite)
        Http::fake([
            'https://api-sandbox.kkiapay.me/api/v1/transactions/status' => Http::sequence()
                ->push([
                    'status' => 'PENDING',
                    'transactionId' => $txId,
                    'amount' => 500,
                    'currency' => 'XOF',
                    'state' => $ref,
                ], 200)
                ->push([
                    'status' => 'SUCCESS',
                    'transactionId' => $txId,
                    'amount' => 500,
                    'fees' => 10,
                    'currency' => 'XOF',
                    'state' => $ref,
                ], 200),
        ]);

        $this->actingAs($this->client, 'sanctum')->postJson('/api/paiements/verifier', [
            'transactionId' => $txId,
            'reference' => $ref,
        ])->assertStatus(202);

        // Étape 2 : L'utilisateur rouvre son espace "Mes paiements" et retrouve sa référence interne
        $listRes = $this->actingAs($this->client, 'sanctum')->getJson('/api/mes-paiements');
        $listRes->assertStatus(200);
        $found = collect($listRes->json('data.data'))->firstWhere('reference', $ref);
        $this->assertNotNull($found);
        $this->assertEquals('pending', $found['status']);

        // Étape 3 : Il clique sur "Actualiser le statut" (GET /api/paiements/{ref}/statut) SANS saisir d'ID
        $statusRes = $this->actingAs($this->client, 'sanctum')->getJson("/api/paiements/{$ref}/statut");
        $statusRes->assertStatus(200)
            ->assertJsonPath('data.status', 'successful')
            ->assertJsonPath('data.normalized_status', 'success')
            ->assertJsonPath('data.gateway_transaction_id', $txId);

        // Étape 4 : Il peut désormais publier avec sa seule référence interne (sans jamais saisir de transactionId)
        $pubRes = $this->actingAs($this->client, 'sanctum')->postJson('/api/proprietes', $this->propertyPayload([
            'payment_reference' => $ref,
        ]));
        $pubRes->assertStatus(201)->assertJsonPath('success', true);
    }

    /**
     * Scénario 12 : Tentative de publication sans paiement confirmé -> refus 402
     */
    public function test_12_cannot_publish_without_confirmed_payment(): void
    {
        // Aucune référence ni transaction
        $resNoPay = $this->actingAs($this->client, 'sanctum')->postJson('/api/proprietes', $this->propertyPayload());
        $resNoPay->assertStatus(402)->assertJsonPath('success', false);

        // Paiement initié mais toujours pending (non payé)
        $init = $this->initiatePublication($this->agent, 'publication_agent');
        $resPending = $this->actingAs($this->agent, 'sanctum')->postJson('/api/proprietes', $this->propertyPayload([
            'payment_reference' => $init['reference'],
            'photo' => UploadedFile::fake()->create('bien_agent.jpg', 120, 'image/jpeg'),
        ]));
        $resPending->assertStatus(402)->assertJsonPath('success', false);

        $this->assertEquals(0, Proprietes::where('user_id', $this->client->id)->count());
        $this->assertEquals(0, Proprietes::where('user_id', $this->agent->id)->count());
    }

    /**
     * Scénario 13 : Deux requêtes simultanées (concurrence / double confirmation) -> 1 seul crédit & 1 seule publication
     */
    public function test_13_concurrent_confirmations_and_publications_remain_strictly_idempotent(): void
    {
        $init = $this->initiatePublication($this->agent, 'publication_agent');
        $ref = $init['reference'];
        $txId = 'KK_CONCURRENT_' . uniqid();

        Http::fake([
            'https://api-sandbox.kkiapay.me/api/v1/transactions/status' => Http::response([
                'status' => 'SUCCESS',
                'transactionId' => $txId,
                'amount' => 100,
                'fees' => 2,
                'currency' => 'XOF',
                'state' => $ref,
            ], 200),
        ]);

        // Deux confirmations back-to-back (ex: callback frontend + webhook simultané)
        $r1 = $this->actingAs($this->agent, 'sanctum')->postJson('/api/paiements/verifier', [
            'transactionId' => $txId,
            'reference' => $ref,
        ]);
        $r2 = $this->withHeader('x-kkiapay-secret', $this->webhookSecret)
            ->postJson('/api/kkiapay/webhook', [
                'transactionId' => $txId,
                'stateData' => $ref,
            ]);

        $r1->assertStatus(200)->assertJsonPath('is_duplicate', false);
        $r2->assertStatus(200)->assertJsonPath('is_duplicate', true);
        $this->assertEquals(1, GrandLivre::where('gateway_transaction_id', $txId)->count());

        // Deux publications concurrentes avec le même paiement confirmé -> 1ère = 201, 2e = 422
        $p1 = $this->actingAs($this->agent, 'sanctum')->postJson('/api/proprietes', $this->propertyPayload([
            'payment_reference' => $ref,
            'kkiapay_transaction_id' => $txId,
        ]));
        $p2 = $this->actingAs($this->agent, 'sanctum')->postJson('/api/proprietes', $this->propertyPayload([
            'payment_reference' => $ref,
            'kkiapay_transaction_id' => $txId,
            'photo' => UploadedFile::fake()->create('bien_dup.jpg', 120, 'image/jpeg'),
        ]));

        $p1->assertStatus(201);
        $p2->assertStatus(422);
        $this->assertEquals(1, Proprietes::where('user_id', $this->agent->id)->count());
    }

    /**
     * Scénario 14 : Verrou Sandbox strict (jamais d'appel vers api.kkiapay.me ni de clés Live pk_/sk_ en Sandbox)
     */
    public function test_14_sandbox_mode_strictly_blocks_production_url_and_live_keys(): void
    {
        // 1. Même si KKIAPAY_BASE_URL pointe par erreur vers la production, sandbox=true force api-sandbox.kkiapay.me
        Config::set('services.kkiapay.sandbox', true);
        Config::set('services.kkiapay.base_url', 'https://api.kkiapay.me');
        $adapter = new \App\Services\Gateways\KkiapayGatewayAdapter();
        $this->assertTrue($adapter->isSandbox());
        $this->assertEquals('https://api-sandbox.kkiapay.me', $adapter->getBaseUrl());

        // 2. Des clés Live (pk_ / sk_) en mode Sandbox sont immédiatement rejetées sans aucun appel réseau
        Http::fake();
        Config::set('services.kkiapay.private_key', 'pk_live_should_never_be_used_in_sandbox');
        Config::set('services.kkiapay.secret_key', 'sk_live_should_never_be_used_in_sandbox');
        $mismatchedAdapter = new \App\Services\Gateways\KkiapayGatewayAdapter();
        $verif = $mismatchedAdapter->verifyTransaction('KK_LIVE_KEY_BLOCKED');

        $this->assertFalse($verif['success']);
        $this->assertEquals('MISCONFIGURED', $verif['gateway_status']);
        Http::assertNothingSent();
    }

    /**
     * Scénario 15 : Les 4 scénarios d'échec/attente Sandbox officiels Kkiapay :
     * - 61000001 : PROCESSING_ERROR (paiement échoué)
     * - 61000002 : INSUFFICIENT_FUND (solde insuffisant)
     * - 61000003 : PAYMENT_REFUSED (paiement refusé)
     * - PENDING  : en attente opérateur
     * Aucun de ces scénarios ne doit valider le paiement ni autoriser la publication.
     */
    public function test_15_official_sandbox_failure_and_pending_scenarios_persist_and_block_publication(): void
    {
        $scenarios = [
            [
                'name' => 'solde_insuffisant_61000002',
                'payload' => [
                    'status' => 'FAILED',
                    'transactionId' => 'KK_SBX_INSUFF_001',
                    'amount' => 100,
                    'currency' => 'XOF',
                    'reason' => ['code' => 'INSUFFICIENT_FUND', 'message' => 'Solde insuffisant'],
                ],
                'expectedHttp' => 422,
                'expectedDbStatus' => 'failed',
                'expectedCode' => 'INSUFFICIENT_FUND',
            ],
            [
                'name' => 'paiement_refuse_61000003',
                'payload' => [
                    'status' => 'FAILED',
                    'transactionId' => 'KK_SBX_REFUSED_001',
                    'amount' => 100,
                    'currency' => 'XOF',
                    'reason' => ['code' => 'PAYMENT_REFUSED', 'message' => 'Transaction refusée'],
                ],
                'expectedHttp' => 422,
                'expectedDbStatus' => 'failed',
                'expectedCode' => 'PAYMENT_REFUSED',
            ],
            [
                'name' => 'erreur_traitement_61000001',
                'payload' => [
                    'status' => 'FAILED',
                    'transactionId' => 'KK_SBX_PROCERR_001',
                    'amount' => 100,
                    'currency' => 'XOF',
                    'failureCode' => 'PROCESSING_ERROR',
                    'failureMessage' => 'Erreur de traitement opérateur',
                ],
                'expectedHttp' => 422,
                'expectedDbStatus' => 'failed',
                'expectedCode' => 'PROCESSING_ERROR',
            ],
            [
                'name' => 'paiement_en_attente',
                'payload' => [
                    'status' => 'PENDING',
                    'transactionId' => 'KK_SBX_PENDING_001',
                    'amount' => 100,
                    'currency' => 'XOF',
                ],
                'expectedHttp' => 202,
                'expectedDbStatus' => 'pending',
                'expectedCode' => 'PAYMENT_PENDING',
            ],
        ];

        $payloadByTx = [];
        $inits = [];
        foreach ($scenarios as $sc) {
            $init = $this->initiatePublication($this->agent, 'publication_agent');
            $ref = $init['reference'];
            $txId = $sc['payload']['transactionId'];
            $inits[$sc['name']] = ['ref' => $ref, 'txId' => $txId, 'sc' => $sc];
            $payloadByTx[$txId] = array_merge($sc['payload'], ['state' => $ref]);
        }

        Http::fake([
            'https://api-sandbox.kkiapay.me/api/v1/transactions/status' => function ($request) use ($payloadByTx) {
                $tx = $request['transactionId'] ?? '';

                return Http::response($payloadByTx[$tx] ?? ['message' => 'Not found'], isset($payloadByTx[$tx]) ? 200 : 404);
            },
        ]);

        foreach ($inits as $entry) {
            $ref = $entry['ref'];
            $txId = $entry['txId'];
            $sc = $entry['sc'];

            $verifyRes = $this->actingAs($this->agent, 'sanctum')->postJson('/api/paiements/verifier', [
                'transactionId' => $txId,
                'reference' => $ref,
            ]);

            $verifyRes->assertStatus($sc['expectedHttp'])
                ->assertJsonPath('success', false)
                ->assertJsonPath('code', $sc['expectedCode']);

            $this->assertDatabaseHas('paiements', [
                'transaction_reference' => $ref,
                'gateway_transaction_id' => $txId,
                'status' => $sc['expectedDbStatus'],
            ]);

            // Vérifier qu'aucune publication n'est autorisée pour ce paiement non confirmé
            $pubRes = $this->actingAs($this->agent, 'sanctum')->postJson('/api/proprietes', $this->propertyPayload([
                'payment_reference' => $ref,
                'kkiapay_transaction_id' => $txId,
                'photo' => UploadedFile::fake()->create("{$sc['name']}.jpg", 120, 'image/jpeg'),
            ]));
            $this->assertTrue(in_array($pubRes->status(), [202, 402, 422], true));
            $this->assertEquals(0, GrandLivre::where('gateway_transaction_id', $txId)->count());
        }
    }

    /**
     * Scénario 16 : Cloisonnement strict des types d'opérations et entités :
     * - Un paiement de publication_client (500 F) ne peut PAS être détourné pour une visite physique (500 F).
     * - Un paiement visite initié pour un bien A ne peut PAS être utilisé pour un bien B.
     */
    public function test_16_cross_operation_and_cross_property_payment_reuse_for_visit_is_rejected(): void
    {
        $propA = Proprietes::create([
            'user_id' => $this->agent->id,
            'type' => 'maison',
            'transaction_type' => 'location',
            'commune' => 'Cotonou',
            'arrondissement' => 'Fidjrossè',
            'quartier' => 'Kpota',
            'location_details' => 'Bien A.',
            'accessibilite' => 'Pavé',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 180,
            'nombres_chambres' => 3,
            'prix' => 110000,
            'avance_mois' => 3,
            'status' => 'published',
        ]);

        $propB = Proprietes::create([
            'user_id' => $this->agent->id,
            'type' => 'maison',
            'transaction_type' => 'location',
            'commune' => 'Cotonou',
            'arrondissement' => 'Akpakpa',
            'quartier' => 'Jak',
            'location_details' => 'Bien B.',
            'accessibilite' => 'Goudronné',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 210,
            'nombres_chambres' => 4,
            'prix' => 150000,
            'avance_mois' => 3,
            'status' => 'published',
        ]);

        // 1. Paiement de type publication_client (500 F) confirmé
        $pubInit = $this->initiatePublication($this->client, 'publication_client');
        $pubTxId = 'KK_CROSS_PUB_' . uniqid();

        // 2. Paiement de type visite (500 F) initié spécifiquement pour Bien A
        $visitInitRes = $this->actingAs($this->client, 'sanctum')->postJson('/api/paiements/initier', [
            'type_operation' => 'visite',
            'entity_id' => $propA->id,
            'cgu_acceptees' => true,
        ]);
        $visitInitRes->assertStatus(201);
        $visitRef = $visitInitRes->json('data.reference');
        $visitTxId = 'KK_CROSS_VISIT_' . uniqid();

        Http::fake([
            'https://api-sandbox.kkiapay.me/api/v1/transactions/status' => function ($request) use ($pubTxId, $pubInit, $visitTxId, $visitRef) {
                $tx = $request['transactionId'] ?? '';
                if ($tx === $pubTxId) {
                    return Http::response([
                        'status' => 'SUCCESS',
                        'transactionId' => $pubTxId,
                        'amount' => 500,
                        'fees' => 10,
                        'currency' => 'XOF',
                        'state' => $pubInit['reference'],
                    ], 200);
                }
                if ($tx === $visitTxId) {
                    return Http::response([
                        'status' => 'SUCCESS',
                        'transactionId' => $visitTxId,
                        'amount' => 500,
                        'fees' => 10,
                        'currency' => 'XOF',
                        'state' => $visitRef,
                    ], 200);
                }

                return Http::response(['message' => 'Not found'], 404);
            },
        ]);

        // Confirmer les deux paiements S2S
        $this->actingAs($this->client, 'sanctum')->postJson('/api/paiements/verifier', [
            'transactionId' => $pubTxId,
            'reference' => $pubInit['reference'],
        ])->assertStatus(200);

        $this->actingAs($this->client, 'sanctum')->postJson('/api/paiements/verifier', [
            'transactionId' => $visitTxId,
            'reference' => $visitRef,
        ])->assertStatus(200);

        // Tentative 1 : détourner un paiement publication_client (500 F) pour réserver une visite -> 422
        $crossOpRes = $this->actingAs($this->client, 'sanctum')->postJson('/api/visites', [
            'property_id' => $propA->id,
            'scheduled_date' => now()->addDays(2)->format('Y-m-d H:i:s'),
            'payment_reference' => $pubInit['reference'],
            'kkiapay_transaction_id' => $pubTxId,
        ]);
        $crossOpRes->assertStatus(422)->assertJsonPath('success', false);

        // Tentative 2 : utiliser un paiement visite initié pour Bien A sur Bien B -> 422
        $crossPropRes = $this->actingAs($this->client, 'sanctum')->postJson('/api/visites', [
            'property_id' => $propB->id,
            'scheduled_date' => now()->addDays(2)->format('Y-m-d H:i:s'),
            'payment_reference' => $visitRef,
            'kkiapay_transaction_id' => $visitTxId,
        ]);
        $crossPropRes->assertStatus(422)->assertJsonPath('success', false);

        // Utilisation légitime sur Bien A -> 201
        $validRes = $this->actingAs($this->client, 'sanctum')->postJson('/api/visites', [
            'property_id' => $propA->id,
            'scheduled_date' => now()->addDays(2)->format('Y-m-d H:i:s'),
            'payment_reference' => $visitRef,
            'kkiapay_transaction_id' => $visitTxId,
        ]);
        $validRes->assertStatus(201)->assertJsonPath('success', true);
    }
}
