<?php

namespace Tests\Feature;

use App\Models\Demande_client;
use App\Models\PropertyInquiry;
use App\Models\Proprietes;
use App\Models\User;
use App\Models\Visite_client;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ClientSpaceAndNavigationTest extends TestCase
{
    use DatabaseTransactions;

    protected User $clientA;
    protected User $clientB;
    protected User $agent;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'Client']);
        Role::firstOrCreate(['name' => 'Agent mobilier']);
        Role::firstOrCreate(['name' => 'Admin']);

        $this->clientA = User::factory()->create([
            'name' => 'Kouassi',
            'prenom' => 'Mireille',
            'email' => 'mireille.clienta.' . uniqid() . '@example.com',
            'telephone' => '+22901' . random_int(10000000, 99999999),
        ]);
        $this->clientA->assignRole('Client');

        $this->clientB = User::factory()->create([
            'name' => 'Soglo',
            'prenom' => 'Pascal',
            'email' => 'pascal.clientb.' . uniqid() . '@example.com',
            'telephone' => '+22901' . random_int(10000000, 99999999),
        ]);
        $this->clientB->assignRole('Client');

        $this->agent = User::factory()->create([
            'name' => 'Dossou',
            'prenom' => 'Gérard',
            'email' => 'gerard.agent.' . uniqid() . '@example.com',
            'telephone' => '+22901' . random_int(10000000, 99999999),
        ]);
        $this->agent->assignRole('Agent mobilier');
    }

    public function test_client_can_update_full_profile_including_phone_and_email_with_uniqueness_checks(): void
    {
        $newPhoneRaw = '0197' . random_int(100000, 999999);
        $newEmail = 'mireille.updated.' . uniqid() . '@example.com';

        $res = $this->actingAs($this->clientA, 'sanctum')->putJson('/api/profil', [
            'name' => 'Agbessi',
            'prenom' => 'Mireille-Claire',
            'telephone' => $newPhoneRaw,
            'email' => $newEmail,
        ]);

        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user.nom', 'Agbessi')
            ->assertJsonPath('data.user.prenom', 'Mireille-Claire')
            ->assertJsonPath('data.user.telephone', '+229' . $newPhoneRaw)
            ->assertJsonPath('data.user.email', strtolower($newEmail));

        $this->assertDatabaseHas('users', [
            'id' => $this->clientA->id,
            'name' => 'Agbessi',
            'prenom' => 'Mireille-Claire',
            'telephone' => '+229' . $newPhoneRaw,
            'email' => strtolower($newEmail),
        ]);

        // Un client ne peut pas prendre le numéro de téléphone ou l'email d'un autre utilisateur
        $duplicatePhone = $this->actingAs($this->clientA, 'sanctum')->putJson('/api/profil', [
            'telephone' => $this->clientB->telephone,
        ]);
        $duplicatePhone->assertStatus(422)->assertJsonValidationErrors(['telephone']);

        $duplicateEmail = $this->actingAs($this->clientA, 'sanctum')->putJson('/api/profil', [
            'email' => $this->clientB->email,
        ]);
        $duplicateEmail->assertStatus(422)->assertJsonValidationErrors(['email']);
    }

    public function test_search_request_supports_free_text_commune_and_separate_arrondissement_quartier(): void
    {
        // Création avec une commune saisie librement (absente des anciennes listes prédéfinies)
        $createRes = $this->actingAs($this->clientA, 'sanctum')->postJson('/api/demandes-recherche', [
            'property_type' => 'maison',
            'transaction_type' => 'location',
            'target_commune' => '  Savè Centre Libre  ',
            'target_arrondissement' => 'Plateau',
            'target_quartier' => 'Boni',
            'budget_max' => 125000,
            'criteria_details' => '3 chambres avec cour fermée.',
        ]);

        $createRes->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.target_commune', 'Savè Centre Libre')
            ->assertJsonPath('data.target_arrondissement', 'Plateau')
            ->assertJsonPath('data.target_quartier', 'Boni');

        $demandeId = $createRes->json('data.id');

        $this->assertDatabaseHas('demande_clients', [
            'id' => $demandeId,
            'client_id' => $this->clientA->id,
            'target_commune' => 'Savè Centre Libre',
            'target_arrondissement' => 'Plateau',
            'target_quartier' => 'Boni',
        ]);

        // Modification de la commune en texte libre + effacement propre d'un champ optionnel
        $updateRes = $this->actingAs($this->clientA, 'sanctum')->putJson("/api/demandes-recherche/{$demandeId}", [
            'target_commune' => 'Djougou Nord',
            'target_quartier' => '',
        ]);

        $updateRes->assertStatus(200)
            ->assertJsonPath('data.target_commune', 'Djougou Nord')
            ->assertJsonPath('data.target_arrondissement', 'Plateau')
            ->assertJsonPath('data.target_quartier', null);

        // Consultation filtrée par recherche libre
        $listRes = $this->actingAs($this->clientA, 'sanctum')->getJson('/api/mes-demandes-recherche?search=Djougou');
        $listRes->assertStatus(200)->assertJsonPath('data.total', 1);
        $this->assertEquals($demandeId, $listRes->json('data.data.0.id'));

        // Isolation stricte : Client B ne voit ni ne modifie ni ne supprime la demande de Client A
        $this->actingAs($this->clientB, 'sanctum')->getJson("/api/demandes-recherche/{$demandeId}")->assertStatus(403);
        $this->actingAs($this->clientB, 'sanctum')->putJson("/api/demandes-recherche/{$demandeId}", ['target_commune' => 'Piraté'])->assertStatus(403);
        $this->actingAs($this->clientB, 'sanctum')->deleteJson("/api/demandes-recherche/{$demandeId}")->assertStatus(403);

        // Agent mobilier interdit sur les demandes de recherche client (403)
        $this->actingAs($this->agent, 'sanctum')->postJson('/api/demandes-recherche', [
            'property_type' => 'maison',
            'transaction_type' => 'vente',
            'target_commune' => 'Kandi',
            'budget_max' => 10000000,
        ])->assertStatus(403);
    }

    public function test_client_form_inquiry_accepts_free_text_commune_and_enforces_user_isolation(): void
    {
        // Soumission formulaire_client avec commune libre et quartier distinct
        $res = $this->actingAs($this->clientA, 'sanctum')->postJson('/api/inquiries', [
            'type' => 'formulaire_client',
            'nom' => 'Kouassi',
            'prenom' => 'Mireille',
            'telephone' => '0197112233',
            'email' => $this->clientA->email,
            'sujet' => 'Acheter une parcelle titrée',
            'commune' => '  Malanville Est  ',
            'quartier' => 'Garou',
            'budget' => 9500000,
            'message' => 'Je cherche une parcelle avec titre foncier proche de la voie principale.',
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.commune', 'Malanville Est')
            ->assertJsonPath('data.quartier', 'Garou');

        $inquiryId = $res->json('data.id');

        $this->assertDatabaseHas('property_inquiries', [
            'id' => $inquiryId,
            'user_id' => $this->clientA->id,
            'commune' => 'Malanville Est',
            'quartier' => 'Garou',
        ]);

        // Commune obligatoire (min 2 chars) pour formulaire_client
        $this->actingAs($this->clientA, 'sanctum')->postJson('/api/inquiries', [
            'type' => 'formulaire_client',
            'nom' => 'Kouassi',
            'prenom' => 'Mireille',
            'telephone' => '0197112233',
            'email' => $this->clientA->email,
            'commune' => '',
            'message' => 'Test sans commune pour validation serveur.',
        ])->assertStatus(422)->assertJsonValidationErrors(['commune']);

        // Client A retrouve sa demande, Client B ne la voit pas
        $listA = $this->actingAs($this->clientA, 'sanctum')->getJson('/api/mes-inquiries');
        $listA->assertStatus(200);
        $this->assertContains($inquiryId, array_column($listA->json('data.data'), 'id'));

        $listB = $this->actingAs($this->clientB, 'sanctum')->getJson('/api/mes-inquiries');
        $listB->assertStatus(200);
        $this->assertNotContains($inquiryId, array_column($listB->json('data.data'), 'id'));

        // Client A peut annuler sa propre demande, Client B reçoit 403
        $this->actingAs($this->clientB, 'sanctum')
            ->patchJson("/api/inquiries/{$inquiryId}/statut", ['status' => 'annule'])
            ->assertStatus(403);

        $this->actingAs($this->clientA, 'sanctum')
            ->patchJson("/api/inquiries/{$inquiryId}/statut", ['status' => 'annule'])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'annule');
    }

    public function test_client_properties_visits_and_backend_payment_routes_stay_intact_and_isolated(): void
    {
        $propA = Proprietes::create([
            'user_id' => $this->clientA->id,
            'type' => 'maison',
            'transaction_type' => 'vente',
            'commune' => 'Bohicon',
            'arrondissement' => 'Bohicon 1',
            'quartier' => 'Zakpo',
            'accessibilite' => 'Pavé',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 300,
            'nombres_chambres' => 3,
            'avance_mois' => 0,
            'prix' => 28000000,
            'status' => 'published',
        ]);

        // Client A voit son annonce, Client B ne peut ni la modifier ni la supprimer
        $this->actingAs($this->clientA, 'sanctum')->getJson('/api/mes-proprietes')
            ->assertStatus(200)
            ->assertJsonPath('data.total', 1);

        $this->actingAs($this->clientB, 'sanctum')->putJson("/api/proprietes/{$propA->id}", ['prix' => 1000])
            ->assertStatus(403);
        $this->actingAs($this->clientB, 'sanctum')->deleteJson("/api/proprietes/{$propA->id}")
            ->assertStatus(403);

        // Client B réserve une visite sur le bien de Client A -> Client A n'en voit rien (monopole), Client B peut annuler la sienne
        $visite = Visite_client::create([
            'client_id' => $this->clientB->id,
            'property_id' => $propA->id,
            'target_agent_id' => null,
            'scheduled_date' => now()->addDays(2),
            'status' => 'pending',
            'is_fee_paid' => true,
        ]);

        $this->actingAs($this->clientA, 'sanctum')->getJson('/api/mes-visites')
            ->assertStatus(200)
            ->assertJsonPath('data.total', 0);

        $this->actingAs($this->clientB, 'sanctum')->getJson('/api/mes-visites')
            ->assertStatus(200)
            ->assertJsonPath('data.total', 1);

        // Client A ne peut pas annuler la visite de Client B
        $this->actingAs($this->clientA, 'sanctum')->postJson("/api/visites/{$visite->id}/annuler")
            ->assertStatus(403);

        // Client B annule sa propre visite
        $this->actingAs($this->clientB, 'sanctum')->postJson("/api/visites/{$visite->id}/annuler")
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'cancelled');

        // Les routes de paiement backend restent pleinement opérationnelles (non supprimées)
        $this->actingAs($this->clientA, 'sanctum')->getJson('/api/kkiapay/config')->assertStatus(200);
        $this->actingAs($this->clientA, 'sanctum')->getJson('/api/mes-paiements')->assertStatus(200);
    }
}
