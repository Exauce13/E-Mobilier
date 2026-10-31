<?php

namespace Tests\Feature;

use App\Models\Paiement;
use App\Models\Paiement_vue;
use App\Models\Proprietes;
use App\Models\User;
use App\Models\Visite_client;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class FeedAndVisitTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'Client']);
        Role::firstOrCreate(['name' => 'Agent mobilier']);
        Role::firstOrCreate(['name' => 'Admin']);
    }

    public function test_feed_displays_published_properties_with_masked_details_for_unlocked_client(): void
    {
        $owner = User::factory()->create([
            'telephone' => '+2290198000001',
        ]);
        $owner->assignRole('Agent mobilier');

        $property = Proprietes::create([
            'user_id' => $owner->id,
            'type' => 'maison',
            'transaction_type' => 'location',
            'commune' => 'Cotonou',
            'arrondissement' => 'Fidjrossè',
            'quartier' => 'Plage',
            'location_details' => 'Maison à 50m de la plage, portail bleu avec caméra.',
            'accessibilite' => 'Goudronné',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 200,
            'nombres_chambres' => 3,
            'prix' => 150000,
            'avance_mois' => 3,
            'status' => 'published',
        ]);

        $client = User::factory()->create([
            'telephone' => '+2290198000002',
        ]);
        $client->assignRole('Client');

        // Consultation du fil d'actualité par un client qui n'a pas encore payé les 50 FCFA
        $response = $this->actingAs($client, 'sanctum')->getJson('/api/proprietes');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $items = $response->json('data.data');
        $this->assertNotEmpty($items);

        $found = collect($items)->firstWhere('id', $property->id);
        $this->assertNotNull($found);
        $this->assertFalse($found['is_unlocked']);
        $this->assertEquals(50, $found['unlock_fee']);
        $this->assertEquals(500, $found['visit_fee']);
        // Détails masqués
        $this->assertStringContainsString('masqués', $found['location_details']);
        $this->assertStringContainsString('****', $found['user']['telephone']);
    }

    public function test_client_pays_50_fcfa_to_unlock_property_details(): void
    {
        $owner = User::factory()->create([
            'telephone' => '+2290198000003',
        ]);
        $owner->assignRole('Agent mobilier');

        $property = Proprietes::create([
            'user_id' => $owner->id,
            'type' => 'maison',
            'transaction_type' => 'vente',
            'commune' => 'Abomey-Calavi',
            'arrondissement' => 'Godomey',
            'quartier' => 'Togoudo',
            'location_details' => 'Rue pavée 14, villa blanche R+1.',
            'accessibilite' => 'Pavé',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 350,
            'nombres_chambres' => 4,
            'prix' => 45000000,
            'avance_mois' => 0,
            'status' => 'published',
        ]);

        $client = User::factory()->create([
            'telephone' => '+2290198000004',
        ]);
        $client->assignRole('Client');

        // Déblocage avec paiement de 50 FCFA
        $response = $this->actingAs($client, 'sanctum')->postJson("/api/proprietes/{$property->id}/debloquer", [
            'transaction_id' => 'TEST_KKIAPAY_VIEW_' . uniqid(),
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $property->id,
                    'is_unlocked' => true,
                    'location_details' => 'Rue pavée 14, villa blanche R+1.',
                ],
            ]);

        $this->assertDatabaseHas('paiement_vues', [
            'client_id' => $client->id,
            'property_id' => $property->id,
            'amount_paid' => 50,
        ]);

        $this->assertDatabaseHas('paiements', [
            'user_id' => $client->id,
            'property_id' => $property->id,
            'amount' => 50,
            'payment_type' => 'view_details',
            'status' => 'successful',
        ]);
    }

    public function test_client_does_not_pay_twice_for_same_property(): void
    {
        $owner = User::factory()->create([
            'telephone' => '+2290198000005',
        ]);
        $owner->assignRole('Agent mobilier');

        $property = Proprietes::create([
            'user_id' => $owner->id,
            'type' => 'chambre',
            'transaction_type' => 'location',
            'commune' => 'Cotonou',
            'arrondissement' => 'Akpakpa',
            'quartier' => 'Dédokpo',
            'location_details' => 'Face église St Martin.',
            'accessibilite' => 'Pavé',
            'eau_courant' => 'SBEE',
            'surface' => 35,
            'nombres_chambres' => 1,
            'prix' => 25000,
            'avance_mois' => 3,
            'status' => 'published',
        ]);

        $client = User::factory()->create([
            'telephone' => '+2290198000006',
        ]);
        $client->assignRole('Client');

        // Premier déblocage
        Paiement_vue::create([
            'client_id' => $client->id,
            'property_id' => $property->id,
            'amount_paid' => 50,
        ]);

        // Deuxième tentative de déblocage : aucun nouveau débit
        $response = $this->actingAs($client, 'sanctum')->postJson("/api/proprietes/{$property->id}/debloquer", [
            'transaction_id' => 'TEST_KKIAPAY_VIEW_SECOND',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'already_unlocked' => true,
                'data' => [
                    'is_unlocked' => true,
                    'location_details' => 'Face église St Martin.',
                ],
            ]);

        // Il ne doit y avoir qu'une seule ligne de vue
        $this->assertCount(1, Paiement_vue::where('client_id', $client->id)->where('property_id', $property->id)->get());
    }

    public function test_client_cannot_request_visit_without_paying_500_fcfa(): void
    {
        $owner = User::factory()->create([
            'telephone' => '+2290198000007',
        ]);
        $owner->assignRole('Agent mobilier');

        $property = Proprietes::create([
            'user_id' => $owner->id,
            'type' => 'maison',
            'transaction_type' => 'vente',
            'commune' => 'Cotonou',
            'arrondissement' => 'Haie Vive',
            'quartier' => 'Cocotiers',
            'location_details' => 'Villa 5.',
            'accessibilite' => 'Goudronné',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 500,
            'nombres_chambres' => 5,
            'prix' => 120000000,
            'avance_mois' => 0,
            'status' => 'published',
        ]);

        $client = User::factory()->create([
            'telephone' => '+2290198000008',
        ]);
        $client->assignRole('Client');

        // Sans référence Kkiapay
        $response = $this->actingAs($client, 'sanctum')->postJson('/api/visites', [
            'property_id' => $property->id,
            'scheduled_date' => now()->addDays(2)->format('Y-m-d H:i:s'),
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_client_requests_physical_visit_by_paying_500_fcfa(): void
    {
        $owner = User::factory()->create([
            'telephone' => '+2290198000009',
        ]);
        $owner->assignRole('Agent mobilier');

        $property = Proprietes::create([
            'user_id' => $owner->id,
            'type' => 'maison',
            'transaction_type' => 'location',
            'commune' => 'Ouidah',
            'arrondissement' => 'Pahou',
            'quartier' => 'Kpassè',
            'location_details' => 'Porte 12.',
            'accessibilite' => 'Pavé',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 250,
            'nombres_chambres' => 3,
            'prix' => 75000,
            'avance_mois' => 3,
            'status' => 'published',
        ]);

        $client = User::factory()->create([
            'telephone' => '+2290198000010',
        ]);
        $client->assignRole('Client');

        $dateVisite = now()->addDays(3)->format('Y-m-d H:i:s');

        $response = $this->actingAs($client, 'sanctum')->postJson('/api/visites', [
            'property_id' => $property->id,
            'scheduled_date' => $dateVisite,
            'kkiapay_transaction_id' => 'TEST_KKIAPAY_VISIT_' . uniqid(),
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'visite' => [
                        'client_id' => $client->id,
                        'property_id' => $property->id,
                        'target_agent_id' => $owner->id,
                        'status' => 'pending',
                        'is_fee_paid' => true,
                    ],
                    'paiement' => [
                        'amount' => '500.00',
                        'payment_type' => 'visit_fee',
                        'status' => 'successful',
                    ],
                ],
            ]);

        $this->assertDatabaseHas('visite_clients', [
            'client_id' => $client->id,
            'property_id' => $property->id,
            'is_fee_paid' => true,
            'status' => 'pending',
        ]);

        $this->assertDatabaseHas('paiements', [
            'user_id' => $client->id,
            'property_id' => $property->id,
            'amount' => 500,
            'payment_type' => 'visit_fee',
            'status' => 'successful',
        ]);
    }

    public function test_client_can_view_own_visits(): void
    {
        $owner = User::factory()->create([
            'telephone' => '+2290198000011',
        ]);
        $owner->assignRole('Agent mobilier');

        $property = Proprietes::create([
            'user_id' => $owner->id,
            'type' => 'parcelle',
            'transaction_type' => 'vente',
            'commune' => 'Allada',
            'arrondissement' => 'Avakpa',
            'quartier' => 'Centre',
            'location_details' => 'Parcelle 45 lot B.',
            'accessibilite' => 'Terre battue',
            'eau_courant' => 'Non',
            'surface' => 500,
            'nombres_chambres' => 0,
            'prix' => 8000000,
            'avance_mois' => 0,
            'status' => 'published',
        ]);

        $client = User::factory()->create([
            'telephone' => '+2290198000012',
        ]);
        $client->assignRole('Client');

        Visite_client::create([
            'client_id' => $client->id,
            'property_id' => $property->id,
            'target_agent_id' => $owner->id,
            'scheduled_date' => now()->addDays(1),
            'status' => 'pending',
            'is_fee_paid' => true,
        ]);

        $response = $this->actingAs($client, 'sanctum')->getJson('/api/mes-visites');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $data = $response->json('data.data');
        $this->assertNotEmpty($data);
        $this->assertEquals($client->id, $data[0]['client_id']);
    }
}
