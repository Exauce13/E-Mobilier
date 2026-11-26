<?php

namespace Tests\Feature;

use App\Models\Paiement;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class KkiapayControllerTest extends TestCase
{
    use DatabaseTransactions;

    protected string $webhookSecret = 'kkiapay_ctrl_test_secret';

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'Client']);
        Role::firstOrCreate(['name' => 'Agent mobilier']);
        Role::firstOrCreate(['name' => 'Admin']);

        Config::set('services.kkiapay.sandbox', true);
        Config::set('services.kkiapay.base_url', 'https://api-sandbox.kkiapay.me');
        Config::set('services.kkiapay.public_key', 'pk_test_ctrl');
        Config::set('services.kkiapay.private_key', 'tpk_test_ctrl');
        Config::set('services.kkiapay.secret_key', 'tsk_test_ctrl');
        Config::set('services.kkiapay.webhook_secret', $this->webhookSecret);
    }

    protected function uniquePhone(): string
    {
        return '+22901' . random_int(10000000, 99999999);
    }

    public function test_kkiapay_config_returns_pricing_and_widget_data_for_client(): void
    {
        $client = User::factory()->create(['telephone' => $this->uniquePhone()]);
        $client->assignRole('Client');

        $response = $this->actingAs($client, 'sanctum')->getJson('/api/kkiapay/config');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'widget' => [
                        'amount' => 500,
                        'sandbox' => true,
                    ],
                    'pricing' => [
                        'post_client' => 500,
                        'post_agent' => 100,
                        'current_user_post_fee' => 500,
                    ],
                ],
            ]);
    }

    public function test_kkiapay_config_returns_100_fcfa_for_agent(): void
    {
        $agent = User::factory()->create(['telephone' => $this->uniquePhone()]);
        $agent->assignRole('Agent mobilier');

        $response = $this->actingAs($agent, 'sanctum')->getJson('/api/kkiapay/config');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'pricing' => [
                        'current_user_post_fee' => 100,
                    ],
                ],
            ]);
    }

    public function test_kkiapay_verify_requires_transaction_id(): void
    {
        $client = User::factory()->create(['telephone' => $this->uniquePhone()]);
        $client->assignRole('Client');

        $response = $this->actingAs($client, 'sanctum')->postJson('/api/kkiapay/verify', []);

        $response->assertStatus(422)
            ->assertJson(['success' => false]);
    }

    public function test_kkiapay_verify_succeeds_with_valid_transaction(): void
    {
        $client = User::factory()->create(['telephone' => $this->uniquePhone()]);
        $client->assignRole('Client');

        $init = $this->actingAs($client, 'sanctum')->postJson('/api/paiements/initier', [
            'type_operation' => 'publication_client',
            'cgu_acceptees' => true,
        ])->assertStatus(201)->json('data');

        $txId = 'KK_CTRL_OK_' . uniqid();
        Http::fake([
            'https://api-sandbox.kkiapay.me/api/v1/transactions/status' => Http::response([
                'status' => 'SUCCESS',
                'transactionId' => $txId,
                'amount' => 500,
                'fees' => 10,
                'currency' => 'XOF',
                'state' => $init['reference'],
            ], 200),
        ]);

        $response = $this->actingAs($client, 'sanctum')->postJson('/api/kkiapay/verify', [
            'transactionId' => $txId,
            'reference' => $init['reference'],
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'transaction_id' => $txId,
                    'reference' => $init['reference'],
                    'amount' => 500,
                    'is_already_used' => false,
                ],
            ]);
    }

    public function test_kkiapay_webhook_updates_pending_payment(): void
    {
        $client = User::factory()->create(['telephone' => $this->uniquePhone()]);
        $client->assignRole('Client');

        $ref = 'PAY-WH-' . strtoupper(bin2hex(random_bytes(4)));
        $txId = 'KK_WH_' . uniqid();

        $paiement = Paiement::create([
            'user_id' => $client->id,
            'transaction_reference' => $ref,
            'payment_type' => 'owner_post_submission',
            'amount' => 500,
            'currency' => 'XOF',
            'payment_method' => 'kkiapay',
            'status' => 'pending',
        ]);

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

        // Appel du webhook Kkiapay public authentifié par x-kkiapay-secret
        $response = $this->withHeader('x-kkiapay-secret', $this->webhookSecret)
            ->postJson('/api/kkiapay/webhook', [
                'transactionId' => $txId,
                'stateData' => $ref,
                'state' => 'SUCCESS',
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('paiements', [
            'id' => $paiement->id,
            'gateway_transaction_id' => $txId,
            'status' => 'successful',
        ]);
    }
}
