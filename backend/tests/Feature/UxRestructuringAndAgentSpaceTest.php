<?php

namespace Tests\Feature;

use App\Models\Proprietes;
use App\Models\User;
use App\Models\Visite_client;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class UxRestructuringAndAgentSpaceTest extends TestCase
{
    use DatabaseTransactions;

    protected User $agentA;
    protected User $agentB;
    protected User $client;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');

        Role::firstOrCreate(['name' => 'Client']);
        Role::firstOrCreate(['name' => 'Agent mobilier']);
        Role::firstOrCreate(['name' => 'Admin']);

        Config::set('services.kkiapay.sandbox', true);
        Config::set('services.kkiapay.base_url', 'https://api-sandbox.kkiapay.me');
        Config::set('services.kkiapay.public_key', 'pk_test_ux');
        Config::set('services.kkiapay.private_key', 'tpk_test_ux');
        Config::set('services.kkiapay.secret_key', 'tsk_test_ux');
        Config::set('services.kkiapay.webhook_secret', 'wh_secret_ux');

        $this->agentA = User::factory()->create(['telephone' => '+22901' . random_int(10000000, 99999999)]);
        $this->agentA->assignRole('Agent mobilier');

        $this->agentB = User::factory()->create(['telephone' => '+22901' . random_int(10000000, 99999999)]);
        $this->agentB->assignRole('Agent mobilier');

        $this->client = User::factory()->create(['telephone' => '+22901' . random_int(10000000, 99999999)]);
        $this->client->assignRole('Client');
    }

    protected function confirmPaymentForUser(User $user, string $operation, int $amount): array
    {
        $init = $this->actingAs($user, 'sanctum')->postJson('/api/paiements/initier', [
            'type_operation' => $operation,
            'cgu_acceptees' => true,
        ])->assertStatus(201)->json('data');

        $txId = 'KK_UX_' . uniqid();
        Http::fake([
            'https://api-sandbox.kkiapay.me/api/v1/transactions/status' => Http::response([
                'status' => 'SUCCESS',
                'transactionId' => $txId,
                'amount' => $amount,
                'fees' => 2,
                'currency' => 'XOF',
                'state' => $init['reference'],
            ], 200),
        ]);

        $this->actingAs($user, 'sanctum')->postJson('/api/paiements/verifier', [
            'transactionId' => $txId,
            'reference' => $init['reference'],
        ])->assertStatus(200);

        return ['reference' => $init['reference'], 'transactionId' => $txId];
    }

    public function test_feed_returns_only_published_properties_with_real_backend_pagination(): void
    {
        // Créer 3 biens publiés + 1 bien pending (qui NE DOIT PAS apparaître dans le feed)
        for ($i = 1; $i <= 3; $i++) {
            Proprietes::create([
                'user_id' => $this->agentA->id,
                'type' => 'maison',
                'transaction_type' => 'location',
                'commune' => 'CommuneFeedTest',
                'arrondissement' => 'Arr ' . $i,
                'quartier' => 'Quartier ' . $i,
                'accessibilite' => 'Pavé',
                'eau_courant' => 'SBEE & SONEB',
                'surface' => 150 + $i * 10,
                'nombres_chambres' => 3,
                'avance_mois' => 3,
                'prix' => 100000 + $i * 10000,
                'status' => 'published',
            ]);
        }

        $pending = Proprietes::create([
            'user_id' => $this->agentA->id,
            'type' => 'maison',
            'transaction_type' => 'location',
            'commune' => 'CommuneFeedTest',
            'arrondissement' => 'Arr Hidden',
            'quartier' => 'Hidden',
            'accessibilite' => 'Pavé',
            'eau_courant' => 'SBEE',
            'surface' => 200,
            'nombres_chambres' => 3,
            'avance_mois' => 3,
            'prix' => 95000,
            'status' => 'pending',
        ]);

        // Page 1 (per_page=2)
        $p1 = $this->actingAs($this->client, 'sanctum')
            ->getJson('/api/proprietes?commune=CommuneFeedTest&page=1&per_page=2');
        $p1->assertStatus(200)
            ->assertJsonPath('data.current_page', 1)
            ->assertJsonPath('data.last_page', 2)
            ->assertJsonPath('data.total', 3);
        $this->assertCount(2, $p1->json('data.data'));

        // Page 2 (per_page=2) -> 1 élément restant, jamais le pending
        $p2 = $this->actingAs($this->client, 'sanctum')
            ->getJson('/api/proprietes?commune=CommuneFeedTest&page=2&per_page=2');
        $p2->assertStatus(200)
            ->assertJsonPath('data.current_page', 2)
            ->assertJsonPath('data.total', 3);
        $this->assertCount(1, $p2->json('data.data'));

        $allIds = array_merge(
            array_column($p1->json('data.data'), 'id'),
            array_column($p2->json('data.data'), 'id')
        );
        $this->assertNotContains($pending->id, $allIds);
    }

    public function test_commune_accepts_free_text_and_chambre_location_does_not_require_surface(): void
    {
        $pay = $this->confirmPaymentForUser($this->agentA, 'publication_agent', 100);

        $res = $this->actingAs($this->agentA, 'sanctum')->postJson('/api/proprietes', [
            'type' => 'chambre',
            'transaction_type' => 'location',
            'commune' => 'Djougou Centre Libre', // Saisie libre hors liste prédéfinie
            'arrondissement' => '1er Arrondissement',
            'quartier' => 'Zongo',
            'accessibilite' => 'Voie bitumée',
            'eau_courant' => 'SBEE & SONEB',
            // AUCUNE superficie renseignée !
            'nombres_chambres' => 1,
            'avance_mois' => 3,
            'prix' => 25000,
            'payment_reference' => $pay['reference'],
            'kkiapay_transaction_id' => $pay['transactionId'],
            'photo' => UploadedFile::fake()->create('chambre.jpg', 100, 'image/jpeg'),
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.propriete.commune', 'Djougou Centre Libre')
            ->assertJsonPath('data.propriete.surface', null);

        $this->assertDatabaseHas('proprietes', [
            'user_id' => $this->agentA->id,
            'type' => 'chambre',
            'transaction_type' => 'location',
            'commune' => 'Djougou Centre Libre',
            'surface' => null,
        ]);
    }

    public function test_surface_remains_required_for_maison_and_parcelle_and_chambre_vente(): void
    {
        // Maison en location sans superficie -> 422
        $resMaison = $this->actingAs($this->agentA, 'sanctum')->postJson('/api/proprietes', [
            'type' => 'maison',
            'transaction_type' => 'location',
            'commune' => 'Malanville',
            'arrondissement' => 'Centre',
            'quartier' => 'Marché',
            'accessibilite' => 'Goudron',
            'eau_courant' => 'SBEE',
            'nombres_chambres' => 3,
            'avance_mois' => 3,
            'prix' => 120000,
            'photo' => UploadedFile::fake()->create('maison.jpg', 100, 'image/jpeg'),
        ]);
        $resMaison->assertStatus(422)->assertJsonValidationErrors(['surface']);

        // Parcelle en vente sans superficie -> 422
        $resParcelle = $this->actingAs($this->agentA, 'sanctum')->postJson('/api/proprietes', [
            'type' => 'parcelle',
            'transaction_type' => 'vente',
            'commune' => 'Kandi',
            'arrondissement' => 'Kandi 1',
            'quartier' => 'Gansosso',
            'accessibilite' => 'Terre battue',
            'eau_courant' => 'Proche SBEE',
            'prix' => 8000000,
            'titre_foncier' => UploadedFile::fake()->create('tf.pdf', 200, 'application/pdf'),
            'photo' => UploadedFile::fake()->create('parcelle.jpg', 100, 'image/jpeg'),
        ]);
        $resParcelle->assertStatus(422)->assertJsonValidationErrors(['surface']);

        // Chambre en vente sans superficie -> 422
        $resChambreVente = $this->actingAs($this->agentA, 'sanctum')->postJson('/api/proprietes', [
            'type' => 'chambre',
            'transaction_type' => 'vente',
            'commune' => 'Bohicon',
            'arrondissement' => 'Bohicon 1',
            'quartier' => 'Zakpo',
            'accessibilite' => 'Pavé',
            'eau_courant' => 'SBEE',
            'prix' => 3500000,
            'photo' => UploadedFile::fake()->create('ch.jpg', 100, 'image/jpeg'),
        ]);
        $resChambreVente->assertStatus(422)->assertJsonValidationErrors(['surface']);
    }

    public function test_agent_space_strict_isolation_pagination_and_visit_privacy(): void
    {
        $propA1 = Proprietes::create([
            'user_id' => $this->agentA->id,
            'type' => 'chambre',
            'transaction_type' => 'location',
            'commune' => 'Natitingou',
            'arrondissement' => 'Arr 1',
            'quartier' => 'Centre',
            'accessibilite' => 'Pavé',
            'eau_courant' => 'SBEE',
            'surface' => null,
            'nombres_chambres' => 1,
            'avance_mois' => 3,
            'prix' => 30000,
            'status' => 'published',
        ]);
        $propA2 = Proprietes::create([
            'user_id' => $this->agentA->id,
            'type' => 'maison',
            'transaction_type' => 'vente',
            'commune' => 'Parakou',
            'arrondissement' => 'Arr 2',
            'quartier' => 'Albarika',
            'accessibilite' => 'Goudron',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 320,
            'nombres_chambres' => 4,
            'avance_mois' => 0,
            'prix' => 45000000,
            'status' => 'pending',
        ]);
        $propBPrivate = Proprietes::create([
            'user_id' => $this->agentB->id,
            'type' => 'maison',
            'transaction_type' => 'vente',
            'commune' => 'Ouidah',
            'arrondissement' => 'Pahou',
            'quartier' => 'Ahozon',
            'accessibilite' => 'Pavé',
            'eau_courant' => 'SBEE',
            'surface' => 400,
            'nombres_chambres' => 4,
            'avance_mois' => 0,
            'prix' => 55000000,
            'status' => 'pending',
        ]);

        // 1. Agent A voit uniquement ses biens avec pagination réelle + recherche
        $myPropsPage1 = $this->actingAs($this->agentA, 'sanctum')
            ->getJson('/api/mes-proprietes?page=1&per_page=1');
        $myPropsPage1->assertStatus(200)
            ->assertJsonPath('data.total', 2)
            ->assertJsonPath('data.last_page', 2);

        $searchNat = $this->actingAs($this->agentA, 'sanctum')
            ->getJson('/api/mes-proprietes?search=Natitingou');
        $searchNat->assertStatus(200)->assertJsonPath('data.total', 1);
        $this->assertEquals($propA1->id, $searchNat->json('data.data.0.id'));

        // 2. Agent A NE PEUT PAS voir, modifier ni supprimer le bien privé de Agent B
        $this->actingAs($this->agentA, 'sanctum')->getJson("/api/proprietes/{$propBPrivate->id}")->assertStatus(403);
        $this->actingAs($this->agentA, 'sanctum')->putJson("/api/proprietes/{$propBPrivate->id}", ['prix' => 1000])->assertStatus(403);
        $this->actingAs($this->agentA, 'sanctum')->deleteJson("/api/proprietes/{$propBPrivate->id}")->assertStatus(403);

        // 3. Visite sur bien de Agent A : Agent A voit uniquement prénom + nom du client (zéro téléphone/email)
        Visite_client::create([
            'client_id' => $this->client->id,
            'property_id' => $propA1->id,
            'target_agent_id' => $this->agentA->id,
            'scheduled_date' => now()->addDays(2),
            'status' => 'pending',
            'is_fee_paid' => true,
        ]);

        $dashA = $this->actingAs($this->agentA, 'sanctum')->getJson('/api/agent/dashboard');
        $dashA->assertStatus(200);
        $visitData = $dashA->json('data.visites.0');
        $this->assertEquals($this->client->name, $visitData['client']['name']);
        $this->assertEquals($this->client->prenom, $visitData['client']['prenom']);
        $this->assertNull($visitData['client']['telephone']);
        $this->assertNull($visitData['client']['email']);

        // 4. Client bloqué sur /api/agent/dashboard (403)
        $this->actingAs($this->client, 'sanctum')->getJson('/api/agent/dashboard')->assertStatus(403);

        // 5. Agent peut mettre à jour son propre profil depuis Espace Agent
        $this->actingAs($this->agentA, 'sanctum')
            ->putJson('/api/profil', ['name' => 'DOSSOU', 'prenom' => 'Marc'])
            ->assertStatus(200);
        $this->assertDatabaseHas('users', ['id' => $this->agentA->id, 'name' => 'DOSSOU', 'prenom' => 'Marc']);
    }
}
