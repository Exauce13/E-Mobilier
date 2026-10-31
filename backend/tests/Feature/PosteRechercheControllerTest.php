<?php

namespace Tests\Feature;

use App\Models\Demande_client;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PosteRechercheControllerTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'Client']);
        Role::firstOrCreate(['name' => 'Agent mobilier']);
        Role::firstOrCreate(['name' => 'Admin']);
    }

    public function test_client_can_create_search_request_post(): void
    {
        $client = User::factory()->create([
            'telephone' => '+2290196000001',
        ]);
        $client->assignRole('Client');

        $response = $this->actingAs($client, 'sanctum')->postJson('/api/demandes-recherche', [
            'property_type' => 'maison',
            'transaction_type' => 'location',
            'target_commune' => 'Cotonou',
            'target_arrondissement' => 'Haie Vive',
            'target_quartier' => 'Les Cocotiers',
            'budget_max' => 350000,
            'criteria_details' => 'Villa avec 3 chambres climatisées et garage 2 voitures.',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'client_id' => $client->id,
                    'property_type' => 'maison',
                    'transaction_type' => 'location',
                    'target_commune' => 'Cotonou',
                    'status' => 'active',
                ],
            ]);

        $this->assertDatabaseHas('demande_clients', [
            'client_id' => $client->id,
            'property_type' => 'maison',
            'transaction_type' => 'location',
            'target_commune' => 'Cotonou',
        ]);
    }

    public function test_rental_demand_cannot_be_for_a_parcelle(): void
    {
        $client = User::factory()->create([
            'telephone' => '+2290196000002',
        ]);
        $client->assignRole('Client');

        // Une parcelle ne peut être louée
        $response = $this->actingAs($client, 'sanctum')->postJson('/api/demandes-recherche', [
            'property_type' => 'parcelle',
            'transaction_type' => 'location',
            'target_commune' => 'Abomey-Calavi',
            'budget_max' => 100000,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_client_can_view_own_search_requests(): void
    {
        $client1 = User::factory()->create([
            'telephone' => '+2290196000003',
        ]);
        $client1->assignRole('Client');

        $client2 = User::factory()->create([
            'telephone' => '+2290196000004',
        ]);
        $client2->assignRole('Client');

        // Demande client 1
        Demande_client::create([
            'client_id' => $client1->id,
            'property_type' => 'chambre',
            'transaction_type' => 'location',
            'target_commune' => 'Ouidah',
            'budget_max' => 45000,
            'status' => 'active',
        ]);

        // Demande client 2
        Demande_client::create([
            'client_id' => $client2->id,
            'property_type' => 'parcelle',
            'transaction_type' => 'vente',
            'target_commune' => 'Porto-Novo',
            'budget_max' => 5000000,
            'status' => 'active',
        ]);

        $response = $this->actingAs($client1, 'sanctum')->getJson('/api/mes-demandes-recherche');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        // Client 1 ne doit voir que ses propres demandes
        $data = $response->json('data.data');
        $this->assertNotEmpty($data);
        foreach ($data as $item) {
            $this->assertEquals($client1->id, $item['client_id']);
        }
    }

    public function test_client_can_update_own_search_request(): void
    {
        $client = User::factory()->create([
            'telephone' => '+2290196000005',
        ]);
        $client->assignRole('Client');

        $demande = Demande_client::create([
            'client_id' => $client->id,
            'property_type' => 'chambre',
            'transaction_type' => 'location',
            'target_commune' => 'Parakou',
            'budget_max' => 30000,
            'status' => 'active',
        ]);

        $response = $this->actingAs($client, 'sanctum')->putJson("/api/demandes-recherche/{$demande->id}", [
            'budget_max' => 40000,
            'criteria_details' => 'Avec sanitaire personnel et compteur individuel.',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $demande->id,
                    'budget_max' => '40000.00',
                    'criteria_details' => 'Avec sanitaire personnel et compteur individuel.',
                ],
            ]);

        $this->assertDatabaseHas('demande_clients', [
            'id' => $demande->id,
            'budget_max' => 40000,
        ]);
    }

    public function test_user_cannot_update_or_delete_another_user_request(): void
    {
        $client1 = User::factory()->create([
            'telephone' => '+2290196000006',
        ]);
        $client1->assignRole('Client');

        $client2 = User::factory()->create([
            'telephone' => '+2290196000007',
        ]);
        $client2->assignRole('Client');

        $demande = Demande_client::create([
            'client_id' => $client1->id,
            'property_type' => 'maison',
            'transaction_type' => 'vente',
            'target_commune' => 'Cotonou',
            'budget_max' => 50000000,
            'status' => 'active',
        ]);

        // Tentative de modification par client2
        $responseUpdate = $this->actingAs($client2, 'sanctum')->putJson("/api/demandes-recherche/{$demande->id}", [
            'budget_max' => 1000,
        ]);
        $responseUpdate->assertStatus(403);

        // Tentative de suppression par client2
        $responseDelete = $this->actingAs($client2, 'sanctum')->deleteJson("/api/demandes-recherche/{$demande->id}");
        $responseDelete->assertStatus(403);
    }

    public function test_client_can_delete_own_search_request(): void
    {
        $client = User::factory()->create([
            'telephone' => '+2290196000008',
        ]);
        $client->assignRole('Client');

        $demande = Demande_client::create([
            'client_id' => $client->id,
            'property_type' => 'maison',
            'transaction_type' => 'location',
            'target_commune' => 'Cotonou',
            'budget_max' => 200000,
            'status' => 'active',
        ]);

        $response = $this->actingAs($client, 'sanctum')->deleteJson("/api/demandes-recherche/{$demande->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Demande de recherche supprimée avec succès.',
            ]);

        $this->assertDatabaseMissing('demande_clients', [
            'id' => $demande->id,
        ]);
    }

    public function test_non_admin_cannot_view_all_clients_requests(): void
    {
        $client = User::factory()->create([
            'telephone' => '+2290196000009',
        ]);
        $client->assignRole('Client');

        $agent = User::factory()->create([
            'telephone' => '+2290196000010',
        ]);
        $agent->assignRole('Agent mobilier');

        // Client ne peut pas voir toutes les demandes via VueDemandeClient
        $responseClient = $this->actingAs($client, 'sanctum')->getJson('/api/admin/demandes-clients');
        $responseClient->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Accès refusé. Cette section est strictement réservée aux administrateurs.',
            ]);

        // Agent immobilier non plus
        $responseAgent = $this->actingAs($agent, 'sanctum')->getJson('/api/admin/demandes-clients');
        $responseAgent->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Accès refusé. Cette section est strictement réservée aux administrateurs.',
            ]);
    }

    public function test_only_admin_can_view_all_clients_requests(): void
    {
        $admin = User::factory()->create([
            'telephone' => '+2290196000011',
        ]);
        $admin->assignRole('Admin');

        $client = User::factory()->create([
            'telephone' => '+2290196000012',
        ]);
        $client->assignRole('Client');

        Demande_client::create([
            'client_id' => $client->id,
            'property_type' => 'parcelle',
            'transaction_type' => 'vente',
            'target_commune' => 'Abomey-Calavi',
            'budget_max' => 12000000,
            'status' => 'active',
        ]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/demandes-clients');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $data = $response->json('data.data');
        $this->assertNotEmpty($data);
        // Doit inclure les informations de la relation client
        $this->assertArrayHasKey('client', $data[0]);
    }
}
