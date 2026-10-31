<?php

namespace Tests\Feature;

use App\Models\Proprietes;
use App\Models\User;
use App\Models\Visite_client;
use App\Services\PushNotificationService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Log;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class MonopolyVisitAndPushTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'Client']);
        Role::firstOrCreate(['name' => 'Agent mobilier']);
        Role::firstOrCreate(['name' => 'Admin']);
    }

    public function test_user_can_register_device_token(): void
    {
        $user = User::factory()->create([
            'telephone' => '+2290197000101',
        ]);
        $user->assignRole('Client');

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/user/device-token', [
            'device_token' => 'ExponentPushToken[mock-expo-push-token-12345]',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'device_token' => 'ExponentPushToken[mock-expo-push-token-12345]',
        ]);
    }

    public function test_visit_on_client_property_keeps_client_owner_unaware_and_monopoly_intact(): void
    {
        // 1. Un client propriétaire publie son bien
        $clientOwner = User::factory()->create([
            'telephone' => '+2290197000102',
        ]);
        $clientOwner->assignRole('Client');

        $property = Proprietes::create([
            'user_id' => $clientOwner->id,
            'type' => 'maison',
            'transaction_type' => 'vente',
            'commune' => 'Cotonou',
            'arrondissement' => 'Haie Vive',
            'quartier' => 'Les Cocotiers',
            'location_details' => 'Villa privée 14.',
            'accessibilite' => 'Goudronné',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 400,
            'nombres_chambres' => 4,
            'prix' => 95000000,
            'avance_mois' => 0,
            'status' => 'published',
        ]);

        // 2. Un autre client demande une visite physique (paye 500 FCFA)
        $clientVisitor = User::factory()->create([
            'name' => 'Koffi',
            'prenom' => 'Armel',
            'telephone' => '+2290197000103',
            'email' => 'koffi.armel@test.bj',
        ]);
        $clientVisitor->assignRole('Client');

        $response = $this->actingAs($clientVisitor, 'sanctum')->postJson('/api/visites', [
            'property_id' => $property->id,
            'scheduled_date' => now()->addDays(2)->format('Y-m-d H:i:s'),
            'kkiapay_transaction_id' => 'TEST_VISIT_CLIENT_PROP_' . uniqid(),
        ]);

        $response->assertStatus(201);
        $visiteId = $response->json('data.visite.id');

        // La visite est enregistrée avec target_agent_id = null (E-Mobilier gère en direct)
        $this->assertDatabaseHas('visite_clients', [
            'id' => $visiteId,
            'client_id' => $clientVisitor->id,
            'property_id' => $property->id,
            'target_agent_id' => null,
            'is_fee_paid' => true,
        ]);

        // RÈGLE DE MONOPOLE : Le client propriétaire ne voit RIEN dans ses visites
        $responseOwner = $this->actingAs($clientOwner, 'sanctum')->getJson('/api/mes-visites');
        $responseOwner->assertStatus(200);
        $ownerVisits = $responseOwner->json('data.data');
        // Le propriétaire ne doit avoir AUCUNE visite dans sa liste
        $this->assertEmpty($ownerVisits);

        // Si le client propriétaire tente d'accéder au détail de la visite
        $responseOwnerShow = $this->actingAs($clientOwner, 'sanctum')->getJson("/api/visites/{$visiteId}");
        $responseOwnerShow->assertStatus(403);
    }

    public function test_agent_sees_visit_with_only_name_and_prenom_and_contacts_are_stripped(): void
    {
        // 1. Un agent immobilier publie un bien
        $agent = User::factory()->create([
            'name' => 'Dossou',
            'prenom' => 'Gérard',
            'telephone' => '+2290197000104',
        ]);
        $agent->assignRole('Agent mobilier');

        $property = Proprietes::create([
            'user_id' => $agent->id,
            'type' => 'maison',
            'transaction_type' => 'location',
            'commune' => 'Abomey-Calavi',
            'arrondissement' => 'Calavi centre',
            'quartier' => 'Kpota',
            'location_details' => 'Maison R+1.',
            'accessibilite' => 'Pavé',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 200,
            'nombres_chambres' => 3,
            'prix' => 120000,
            'avance_mois' => 3,
            'status' => 'published',
        ]);

        // 2. Un client demande une visite physique
        $clientVisitor = User::factory()->create([
            'name' => 'Mensah',
            'prenom' => 'Bénédicte',
            'telephone' => '+2290197000105',
            'email' => 'benedicte.mensah@gmail.com',
        ]);
        $clientVisitor->assignRole('Client');

        $response = $this->actingAs($clientVisitor, 'sanctum')->postJson('/api/visites', [
            'property_id' => $property->id,
            'scheduled_date' => now()->addDays(2)->format('Y-m-d H:i:s'),
            'kkiapay_transaction_id' => 'TEST_VISIT_AGENT_PROP_' . uniqid(),
        ]);
        $response->assertStatus(201);
        $visiteId = $response->json('data.visite.id');

        // 3. L'agent immobilier consulte la liste de ses visites
        $agentResponse = $this->actingAs($agent, 'sanctum')->getJson('/api/mes-visites');
        $agentResponse->assertStatus(200);

        $agentVisits = $agentResponse->json('data.data');
        $this->assertNotEmpty($agentVisits);

        $foundVisit = collect($agentVisits)->firstWhere('id', $visiteId);
        $this->assertNotNull($foundVisit);

        // VÉRIFICATION STRICTE DU MONOPOLE :
        // L'agent voit le nom et le prénom
        $this->assertEquals('Mensah', $foundVisit['client']['name']);
        $this->assertEquals('Bénédicte', $foundVisit['client']['prenom']);
        // Mais le numéro de téléphone et l'email sont STRICTEMENT masqués (null)
        $this->assertNull($foundVisit['client']['telephone']);
        $this->assertNull($foundVisit['client']['email']);

        // Vérification sur le endpoint de détail `show`
        $agentShowResponse = $this->actingAs($agent, 'sanctum')->getJson("/api/visites/{$visiteId}");
        $agentShowResponse->assertStatus(200);
        $showData = $agentShowResponse->json('data');
        $this->assertEquals('Mensah', $showData['client']['name']);
        $this->assertNull($showData['client']['telephone']);
        $this->assertNull($showData['client']['email']);
    }

    public function test_admin_sees_all_visits_with_complete_client_and_property_details(): void
    {
        $admin = User::factory()->create([
            'telephone' => '+2290197000106',
        ]);
        $admin->assignRole('Admin');

        $agent = User::factory()->create([
            'telephone' => '+2290197000107',
        ]);
        $agent->assignRole('Agent mobilier');

        $property = Proprietes::create([
            'user_id' => $agent->id,
            'type' => 'chambre',
            'transaction_type' => 'location',
            'commune' => 'Porto-Novo',
            'arrondissement' => 'Ouando',
            'quartier' => 'Attakè',
            'location_details' => 'Chambre 2B.',
            'accessibilite' => 'Goudronné',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 25,
            'nombres_chambres' => 1,
            'prix' => 20000,
            'avance_mois' => 3,
            'status' => 'published',
        ]);

        $clientVisitor = User::factory()->create([
            'name' => 'Akplogan',
            'prenom' => 'Thierry',
            'telephone' => '+2290197000108',
            'email' => 'thierry.akplogan@outlook.bj',
        ]);
        $clientVisitor->assignRole('Client');

        $visite = Visite_client::create([
            'client_id' => $clientVisitor->id,
            'property_id' => $property->id,
            'target_agent_id' => $agent->id,
            'scheduled_date' => now()->addDays(1),
            'status' => 'pending',
            'is_fee_paid' => true,
        ]);

        // L'Admin consulte les visites via /api/admin/visites
        $adminResponse = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/visites');
        $adminResponse->assertStatus(200);

        $adminVisits = $adminResponse->json('data.data');
        $this->assertNotEmpty($adminVisits);

        $foundVisit = collect($adminVisits)->firstWhere('id', $visite->id);
        $this->assertNotNull($foundVisit);

        // L'ADMIN A ACCÈS AUX DÉTAILS COMPLETS :
        $this->assertEquals('Akplogan', $foundVisit['client']['name']);
        $this->assertEquals('Thierry', $foundVisit['client']['prenom']);
        $this->assertEquals('+2290197000108', $foundVisit['client']['telephone']);
        $this->assertEquals('thierry.akplogan@outlook.bj', $foundVisit['client']['email']);
    }

    public function test_agent_can_request_visit_on_another_user_property(): void
    {
        $owner = User::factory()->create([
            'telephone' => '+2290197000109',
        ]);
        $owner->assignRole('Client');

        $property = Proprietes::create([
            'user_id' => $owner->id,
            'type' => 'maison',
            'transaction_type' => 'vente',
            'commune' => 'Ouidah',
            'arrondissement' => 'Pahou',
            'quartier' => 'Centre',
            'location_details' => 'Maison 10.',
            'accessibilite' => 'Pavé',
            'eau_courant' => 'SBEE',
            'surface' => 300,
            'nombres_chambres' => 3,
            'prix' => 35000000,
            'avance_mois' => 0,
            'status' => 'published',
        ]);

        $agentVisitor = User::factory()->create([
            'name' => 'Bio',
            'prenom' => 'Soule',
            'telephone' => '+2290197000110',
            'email' => 'bio.soule@agent.bj',
        ]);
        $agentVisitor->assignRole('Agent mobilier');

        // L'agent demande une visite sur le bien d'un autre utilisateur
        $response = $this->actingAs($agentVisitor, 'sanctum')->postJson('/api/visites', [
            'property_id' => $property->id,
            'scheduled_date' => now()->addDays(2)->format('Y-m-d H:i:s'),
            'kkiapay_transaction_id' => 'TEST_AGENT_VISIT_' . uniqid(),
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'visite' => [
                        'client_id' => $agentVisitor->id,
                        'property_id' => $property->id,
                        'is_fee_paid' => true,
                    ],
                ],
            ]);

        $this->assertDatabaseHas('visite_clients', [
            'client_id' => $agentVisitor->id,
            'property_id' => $property->id,
            'is_fee_paid' => true,
        ]);
    }

    public function test_agent_cannot_request_visit_on_his_own_property(): void
    {
        $agent = User::factory()->create([
            'telephone' => '+2290197000111',
        ]);
        $agent->assignRole('Agent mobilier');

        $property = Proprietes::create([
            'user_id' => $agent->id,
            'type' => 'maison',
            'transaction_type' => 'location',
            'commune' => 'Cotonou',
            'arrondissement' => 'Fidjrossè',
            'quartier' => 'Plage',
            'location_details' => 'Villa propre.',
            'accessibilite' => 'Goudronné',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 250,
            'nombres_chambres' => 3,
            'prix' => 200000,
            'avance_mois' => 3,
            'status' => 'published',
        ]);

        // Tentative de l'agent de réserver une visite sur son propre post
        $response = $this->actingAs($agent, 'sanctum')->postJson('/api/visites', [
            'property_id' => $property->id,
            'scheduled_date' => now()->addDays(2)->format('Y-m-d H:i:s'),
            'kkiapay_transaction_id' => 'TEST_OWN_VISIT_' . uniqid(),
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Vous ne pouvez pas demander de visite pour un bien dont vous êtes le propriétaire ou le gestionnaire.',
            ]);
    }
}

