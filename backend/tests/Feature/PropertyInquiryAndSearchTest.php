<?php

namespace Tests\Feature;

use App\Models\Proprietes;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PropertyInquiryAndSearchTest extends TestCase
{
    use DatabaseTransactions;

    public function test_public_visitor_can_submit_property_inquiry_with_full_contact_info(): void
    {
        Role::firstOrCreate(['name' => 'Agent mobilier']);
        $agent = User::factory()->create([
            'prenom' => 'Koffi',
            'telephone' => '+2290197005544',
        ]);
        $agent->assignRole('Agent mobilier');

        $propriete = Proprietes::create([
            'user_id' => $agent->id,
            'type' => 'maison',
            'transaction_type' => 'location',
            'commune' => 'Cotonou',
            'arrondissement' => '12ème Arrondissement',
            'quartier' => 'Fidjrossè',
            'accessibilite' => 'Voie pavée',
            'eau_courant' => 'SONEB + SBEE',
            'surface' => 250,
            'nombres_chambres' => 3,
            'avance_mois' => 3,
            'prix' => 250000,
            'is_negotiable' => true,
            'status' => 'published',
        ]);

        // Public property detail must be readable without auth
        $showRes = $this->getJson("/api/proprietes/{$propriete->id}");
        $showRes->assertStatus(200)->assertJsonPath('success', true);

        // Submit rendez-vous inquiry with Nom, Prénom, Téléphone, E-mail
        $res = $this->postJson("/api/proprietes/{$propriete->id}/inquiries", [
            'type' => 'rendez_vous',
            'nom' => 'Hounsou',
            'prenom' => 'Aline',
            'telephone' => '0197123456',
            'email' => 'aline.hounsou@example.com',
            'scheduled_date' => now()->addDays(2)->format('Y-m-d H:i:s'),
            'meeting_mode' => 'sur_place',
            'message' => 'Je souhaite visiter cette maison en fin de matinée.',
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.nom', 'Hounsou')
            ->assertJsonPath('data.prenom', 'Aline')
            ->assertJsonPath('data.telephone', '+2290197123456')
            ->assertJsonPath('data.email', 'aline.hounsou@example.com');

        // Agent dashboard lists received inquiry and client lead
        $dashRes = $this->actingAs($agent, 'sanctum')->getJson('/api/agent/dashboard');
        $dashRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.kpis.total_biens', 1)
            ->assertJsonPath('data.kpis.total_demandes', 1)
            ->assertJsonPath('data.kpis.total_clients', 1);
    }

    public function test_advanced_search_filters_work(): void
    {
        $owner = User::factory()->create([
            'prenom' => 'Jean',
            'telephone' => '+2290197006677',
        ]);

        Proprietes::create([
            'user_id' => $owner->id,
            'type' => 'maison',
            'transaction_type' => 'vente',
            'commune' => 'Abomey-Calavi',
            'arrondissement' => 'Godomey',
            'quartier' => 'Togoudo',
            'accessibilite' => 'Goudronnée',
            'eau_courant' => 'SONEB + SBEE',
            'surface' => 420,
            'nombres_chambres' => 4,
            'avance_mois' => 0,
            'prix' => 45000000,
            'is_negotiable' => true,
            'status' => 'published',
        ]);

        $res = $this->getJson('/api/proprietes?type=maison&transaction_type=vente&commune=Abomey-Calavi&surface_min=300&is_negotiable=1&sort=prix_asc');
        $res->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertGreaterThanOrEqual(1, count($res->json('data.data')));
    }
}
