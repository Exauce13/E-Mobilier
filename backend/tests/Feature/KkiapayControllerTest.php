<?php

namespace Tests\Feature;

use App\Models\Paiement;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class KkiapayControllerTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'Client']);
        Role::firstOrCreate(['name' => 'Agent mobilier']);
        Role::firstOrCreate(['name' => 'Admin']);
    }

    public function test_kkiapay_config_returns_pricing_and_widget_data_for_client(): void
    {
        $client = User::factory()->create([
            'telephone' => '+2290197000007',
        ]);
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
        $agent = User::factory()->create([
            'telephone' => '+2290197000008',
        ]);
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
        $client = User::factory()->create([
            'telephone' => '+2290197000009',
        ]);
        $client->assignRole('Client');

        $response = $this->actingAs($client, 'sanctum')->postJson('/api/kkiapay/verify', []);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_kkiapay_verify_succeeds_with_valid_transaction(): void
    {
        $client = User::factory()->create([
            'telephone' => '+2290197000010',
        ]);
        $client->assignRole('Client');

        $response = $this->actingAs($client, 'sanctum')->postJson('/api/kkiapay/verify', [
            'transactionId' => 'TEST_KKIAPAY_VERIFY_999',
            'amount' => 500,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'transaction_id' => 'TEST_KKIAPAY_VERIFY_999',
                    'amount' => 500,
                    'is_already_used' => false,
                ],
            ]);
    }

    public function test_kkiapay_webhook_updates_pending_payment(): void
    {
        $client = User::factory()->create([
            'telephone' => '+2290197000011',
        ]);
        $client->assignRole('Client');

        $paiement = Paiement::create([
            'user_id' => $client->id,
            'transaction_reference' => 'TEST_WEBHOOK_TX_456',
            'payment_type' => 'owner_post_submission',
            'amount' => 500,
            'payment_method' => 'kkiapay',
            'status' => 'pending',
        ]);

        // Appel du webhook Kkiapay public
        $response = $this->postJson('/api/kkiapay/webhook', [
            'transactionId' => 'TEST_WEBHOOK_TX_456',
            'amount' => 500,
            'state' => 'SUCCESS',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertDatabaseHas('paiements', [
            'id' => $paiement->id,
            'status' => 'successful',
        ]);
    }
}
