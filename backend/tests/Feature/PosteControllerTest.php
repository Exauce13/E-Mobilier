<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PosteControllerTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');

        Role::firstOrCreate(['name' => 'Client']);
        Role::firstOrCreate(['name' => 'Agent mobilier']);
        Role::firstOrCreate(['name' => 'Admin']);
    }

    public function test_parcelle_cannot_be_rented(): void
    {
        $client = User::factory()->create([
            'telephone' => '+2290197000001',
        ]);
        $client->assignRole('Client');

        $response = $this->actingAs($client, 'sanctum')->postJson('/api/proprietes', [
            'type' => 'parcelle',
            'transaction_type' => 'location',
            'commune' => 'Abomey-Calavi',
            'arrondissement' => 'Godomey',
            'quartier' => 'Togoudo',
            'accessibilite' => 'Pavé',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 450,
            'prix' => 50000,
            'avance_mois' => 3,
            'photo' => UploadedFile::fake()->create('terrain.jpg', 100, 'image/jpeg'),
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_sale_of_house_or_land_requires_documents(): void
    {
        $client = User::factory()->create([
            'telephone' => '+2290197000002',
        ]);
        $client->assignRole('Client');

        // Tentative de vente sans document justificatif
        $response = $this->actingAs($client, 'sanctum')->postJson('/api/proprietes', [
            'type' => 'parcelle',
            'transaction_type' => 'vente',
            'commune' => 'Ouidah',
            'arrondissement' => 'Pahou',
            'quartier' => 'Ahozon',
            'accessibilite' => 'Terre battue',
            'eau_courant' => 'Puits & SBEE',
            'surface' => 500,
            'prix' => 15000000,
            'photo' => UploadedFile::fake()->create('parcelle.jpg', 100, 'image/jpeg'),
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_client_subscription_is_500_fcfa_on_sale(): void
    {
        $client = User::factory()->create([
            'telephone' => '+2290197000003',
        ]);
        $client->assignRole('Client');

        $document = UploadedFile::fake()->create('titre_foncier.pdf', 500, 'application/pdf');
        $photo = UploadedFile::fake()->create('maison.jpg', 100, 'image/jpeg');

        $response = $this->actingAs($client, 'sanctum')->postJson('/api/proprietes', [
            'type' => 'maison',
            'transaction_type' => 'vente',
            'commune' => 'Cotonou',
            'arrondissement' => 'Fidjrossè',
            'quartier' => 'Calvaire',
            'accessibilite' => 'Goudronné',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 350,
            'nombres_chambres' => 4,
            'prix' => 85000000,
            'avance_mois' => 6, // Devra être ramené à 0 car vente
            'titre_foncier' => $document,
            'photo' => $photo,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'propriete' => [
                        'type' => 'maison',
                        'transaction_type' => 'vente',
                        'avance_mois' => 0, // Vérification que avance_mois n'existe pas en vente
                    ],
                    'souscription' => [
                        'montant' => 500,
                        'type' => 'owner_post_submission',
                    ],
                ],
            ]);

        $this->assertDatabaseHas('proprietes', [
            'user_id' => $client->id,
            'type' => 'maison',
            'transaction_type' => 'vente',
            'avance_mois' => 0,
        ]);

        $this->assertDatabaseHas('paiements', [
            'user_id' => $client->id,
            'amount' => 500,
            'payment_method' => 'kkiapay',
            'payment_type' => 'owner_post_submission',
            'status' => 'successful',
        ]);
    }

    public function test_agent_subscription_is_100_fcfa_on_rental_without_documents(): void
    {
        $agent = User::factory()->create([
            'telephone' => '+2290197000004',
        ]);
        $agent->assignRole('Agent mobilier');

        $photo = UploadedFile::fake()->create('chambre.jpg', 100, 'image/jpeg');

        // Location d'une chambre sans documents (documents non requis pour la location)
        $response = $this->actingAs($agent, 'sanctum')->postJson('/api/proprietes', [
            'type' => 'chambre',
            'transaction_type' => 'location',
            'commune' => 'Cotonou',
            'arrondissement' => 'Akpakpa',
            'quartier' => 'Dédokpo',
            'accessibilite' => 'Pavé',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 25,
            'nombres_chambres' => 1,
            'avance_mois' => 3,
            'prix' => 35000,
            'photo' => $photo,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'propriete' => [
                        'type' => 'chambre',
                        'transaction_type' => 'location',
                        'avance_mois' => 3,
                    ],
                    'souscription' => [
                        'montant' => 100,
                        'passerelle' => 'kkiapay',
                        'type' => 'agent_post',
                    ],
                ],
            ]);

        $this->assertDatabaseHas('paiements', [
            'user_id' => $agent->id,
            'amount' => 100,
            'payment_method' => 'kkiapay',
            'payment_type' => 'agent_post',
            'status' => 'successful',
        ]);
    }

    public function test_cannot_reuse_same_kkiapay_transaction_id(): void
    {
        $client = User::factory()->create([
            'telephone' => '+2290197000005',
        ]);
        $client->assignRole('Client');

        $photo = UploadedFile::fake()->create('chambre.jpg', 100, 'image/jpeg');
        $transactionId = 'TEST_KKIAPAY_UNIQUE_123';

        // Premier poste avec cette transaction Kkiapay
        $this->actingAs($client, 'sanctum')->postJson('/api/proprietes', [
            'type' => 'chambre',
            'transaction_type' => 'location',
            'commune' => 'Cotonou',
            'arrondissement' => 'Akpakpa',
            'quartier' => 'Dédokpo',
            'accessibilite' => 'Pavé',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 25,
            'nombres_chambres' => 1,
            'avance_mois' => 3,
            'prix' => 35000,
            'kkiapay_transaction_id' => $transactionId,
            'photo' => $photo,
        ])->assertStatus(201);

        // Deuxième poste avec la même transaction Kkiapay -> Rejet 422
        $secondPhoto = UploadedFile::fake()->create('chambre2.jpg', 100, 'image/jpeg');
        $secondRes = $this->actingAs($client, 'sanctum')->postJson('/api/proprietes', [
            'type' => 'chambre',
            'transaction_type' => 'location',
            'commune' => 'Cotonou',
            'arrondissement' => 'Akpakpa',
            'quartier' => 'Dédokpo',
            'accessibilite' => 'Pavé',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 25,
            'nombres_chambres' => 1,
            'avance_mois' => 3,
            'prix' => 35000,
            'kkiapay_transaction_id' => $transactionId,
            'photo' => $secondPhoto,
        ]);

        $secondRes->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_kkiapay_config_endpoint_returns_widget_settings(): void
    {
        $client = User::factory()->create([
            'telephone' => '+2290197000006',
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
                ],
            ]);
    }

    public function test_user_can_view_only_own_posts(): void
    {
        $user1 = User::factory()->create(['telephone' => '+2290197000012']);
        $user1->assignRole('Client');

        $user2 = User::factory()->create(['telephone' => '+2290197000013']);
        $user2->assignRole('Client');

        // Créer un poste pour user1
        $post1 = \App\Models\Proprietes::create([
            'user_id' => $user1->id,
            'type' => 'maison',
            'transaction_type' => 'vente',
            'commune' => 'Cotonou',
            'arrondissement' => 'Fidjrossè',
            'quartier' => 'Calvaire',
            'accessibilite' => 'Goudronné',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 200,
            'nombres_chambres' => 3,
            'avance_mois' => 0,
            'prix' => 45000000,
            'status' => 'published',
        ]);

        // Créer un poste pour user2
        $post2 = \App\Models\Proprietes::create([
            'user_id' => $user2->id,
            'type' => 'chambre',
            'transaction_type' => 'location',
            'commune' => 'Parakou',
            'arrondissement' => '1er',
            'quartier' => 'Albarika',
            'accessibilite' => 'Pavé',
            'eau_courant' => 'SBEE',
            'surface' => 20,
            'nombres_chambres' => 1,
            'avance_mois' => 3,
            'prix' => 25000,
            'status' => 'published',
        ]);

        // Requête de user1 pour voir ses postes
        $response = $this->actingAs($user1, 'sanctum')->getJson('/api/mes-proprietes');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $ids = collect($response->json('data.data'))->pluck('id')->toArray();
        $this->assertContains($post1->id, $ids);
        $this->assertNotContains($post2->id, $ids);
    }

    public function test_user_can_update_own_post(): void
    {
        $user = User::factory()->create(['telephone' => '+2290197000014']);
        $user->assignRole('Client');

        $post = \App\Models\Proprietes::create([
            'user_id' => $user->id,
            'type' => 'chambre',
            'transaction_type' => 'location',
            'commune' => 'Cotonou',
            'arrondissement' => 'Cadjehoun',
            'quartier' => 'Haie Vive',
            'accessibilite' => 'Goudronné',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 30,
            'nombres_chambres' => 1,
            'avance_mois' => 3,
            'prix' => 40000,
            'status' => 'pending',
        ]);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/proprietes/{$post->id}", [
            'prix' => 45000,
            'description' => 'Chambre rénovée et climatisée.',
            'is_negotiable' => true,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $post->id,
                    'prix' => '45000.00',
                    'description' => 'Chambre rénovée et climatisée.',
                    'is_negotiable' => true,
                ],
            ]);

        $this->assertDatabaseHas('proprietes', [
            'id' => $post->id,
            'prix' => 45000,
            'description' => 'Chambre rénovée et climatisée.',
        ]);
    }

    public function test_user_cannot_update_others_post(): void
    {
        $owner = User::factory()->create(['telephone' => '+2290197000015']);
        $otherUser = User::factory()->create(['telephone' => '+2290197000016']);

        $post = \App\Models\Proprietes::create([
            'user_id' => $owner->id,
            'type' => 'chambre',
            'transaction_type' => 'location',
            'commune' => 'Cotonou',
            'arrondissement' => 'Cadjehoun',
            'quartier' => 'Haie Vive',
            'accessibilite' => 'Goudronné',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 30,
            'nombres_chambres' => 1,
            'avance_mois' => 3,
            'prix' => 40000,
            'status' => 'pending',
        ]);

        $response = $this->actingAs($otherUser, 'sanctum')->putJson("/api/proprietes/{$post->id}", [
            'prix' => 50000,
        ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_user_can_delete_own_post(): void
    {
        $user = User::factory()->create(['telephone' => '+2290197000017']);
        $user->assignRole('Client');

        $post = \App\Models\Proprietes::create([
            'user_id' => $user->id,
            'type' => 'chambre',
            'transaction_type' => 'location',
            'commune' => 'Cotonou',
            'arrondissement' => 'Cadjehoun',
            'quartier' => 'Haie Vive',
            'accessibilite' => 'Goudronné',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 30,
            'nombres_chambres' => 1,
            'avance_mois' => 3,
            'prix' => 40000,
            'status' => 'pending',
        ]);

        $response = $this->actingAs($user, 'sanctum')->deleteJson("/api/proprietes/{$post->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertDatabaseMissing('proprietes', [
            'id' => $post->id,
        ]);
    }
}
