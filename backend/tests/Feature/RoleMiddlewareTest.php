<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class RoleMiddlewareTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'Client']);
        Role::firstOrCreate(['name' => 'Agent mobilier']);
        Role::firstOrCreate(['name' => 'Admin']);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->getJson('/api/mes-proprietes');
        $response->assertStatus(401);

        $responseAdmin = $this->getJson('/api/admin/demandes-clients');
        $responseAdmin->assertStatus(401);
    }

    public function test_agent_cannot_access_client_search_requests(): void
    {
        $agent = User::factory()->create([
            'telephone' => '+2290199000001',
        ]);
        $agent->assignRole('Agent mobilier');

        $response = $this->actingAs($agent, 'sanctum')->getJson('/api/mes-demandes-recherche');

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_client_cannot_access_admin_routes(): void
    {
        $client = User::factory()->create([
            'telephone' => '+2290199000002',
        ]);
        $client->assignRole('Client');

        $response = $this->actingAs($client, 'sanctum')->getJson('/api/admin/demandes-clients');

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Accès refusé. Cette section est strictement réservée aux administrateurs.',
            ]);
    }

    public function test_agent_cannot_access_admin_routes(): void
    {
        $agent = User::factory()->create([
            'telephone' => '+2290199000003',
        ]);
        $agent->assignRole('Agent mobilier');

        $response = $this->actingAs($agent, 'sanctum')->getJson('/api/admin/demandes-clients');

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Accès refusé. Cette section est strictement réservée aux administrateurs.',
            ]);
    }

    public function test_client_can_access_property_and_demand_routes(): void
    {
        $client = User::factory()->create([
            'telephone' => '+2290199000004',
        ]);
        $client->assignRole('Client');

        // Accès aux propriétés (autorisé pour Client)
        $propResponse = $this->actingAs($client, 'sanctum')->getJson('/api/mes-proprietes');
        $propResponse->assertStatus(200);

        // Accès aux demandes (autorisé pour Client)
        $demandResponse = $this->actingAs($client, 'sanctum')->getJson('/api/mes-demandes-recherche');
        $demandResponse->assertStatus(200);
    }

    public function test_agent_can_access_property_routes(): void
    {
        $agent = User::factory()->create([
            'telephone' => '+2290199000005',
        ]);
        $agent->assignRole('Agent mobilier');

        $propResponse = $this->actingAs($agent, 'sanctum')->getJson('/api/mes-proprietes');
        $propResponse->assertStatus(200);
    }

    public function test_admin_can_access_admin_routes(): void
    {
        $admin = User::factory()->create([
            'telephone' => '+2290199000006',
        ]);
        $admin->assignRole('Admin');

        $adminResponse = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/demandes-clients');
        $adminResponse->assertStatus(200);
    }
}
