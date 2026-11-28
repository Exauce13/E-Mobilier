<?php

namespace Tests\Feature;

use App\Models\Demande_client;
use App\Models\DemandeDemasquage;
use App\Models\Proprietes;
use App\Models\User;
use App\Models\Visite_client;
use App\Models\Zone;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Config;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class SuperAdminDashboardTest extends TestCase
{
    use DatabaseTransactions;

    protected User $superAdmin;
    protected User $superAdminNonFinancial;
    protected User $techAdmin;
    protected User $client;
    protected User $agent;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['Super Admin Principal', 'Super Admin Technique', 'Secrétaire', 'Agent mobilier', 'Client'] as $r) {
            Role::firstOrCreate(['name' => $r]);
        }

        $ownerEmail = 'justin.dashboard.' . uniqid() . '@e-mobilier.bj';
        Config::set('emobilier.super_admin_principal_email', $ownerEmail);

        $this->superAdmin = User::factory()->create([
            'name' => 'MAGNIDE',
            'prenom' => 'Justin',
            'email' => $ownerEmail,
            'telephone' => '+22901' . random_int(10000000, 99999999),
        ]);
        $this->superAdmin->assignRole('Super Admin Principal');
        Config::set('emobilier.super_admin_principal_id', $this->superAdmin->id);

        $this->superAdminNonFinancial = User::factory()->create([
            'name' => 'Delegate',
            'prenom' => 'Admin',
            'email' => 'delegate.' . uniqid() . '@e-mobilier.bj',
            'telephone' => '+22901' . random_int(10000000, 99999999),
        ]);
        $this->superAdminNonFinancial->assignRole('Super Admin Principal');

        $this->techAdmin = User::factory()->create([
            'telephone' => '+22901' . random_int(10000000, 99999999),
        ]);
        $this->techAdmin->assignRole('Super Admin Technique');

        $this->client = User::factory()->create([
            'telephone' => '+22901' . random_int(10000000, 99999999),
        ]);
        $this->client->assignRole('Client');

        $this->agent = User::factory()->create([
            'telephone' => '+22901' . random_int(10000000, 99999999),
            'is_verifed' => false,
        ]);
        $this->agent->assignRole('Agent mobilier');
    }

    public function test_only_super_admin_principal_can_access_dashboard_overview(): void
    {
        $this->actingAs($this->client, 'sanctum')
            ->getJson('/api/admin/dashboard/super-admin')
            ->assertStatus(403);

        $this->actingAs($this->agent, 'sanctum')
            ->getJson('/api/admin/dashboard/super-admin')
            ->assertStatus(403);

        $this->actingAs($this->techAdmin, 'sanctum')
            ->getJson('/api/admin/dashboard/super-admin')
            ->assertStatus(403);
    }

    public function test_super_admin_principal_receives_accurate_real_kpis_charts_zones_and_activities(): void
    {
        $zone = Zone::create([
            'code' => 'ZON-TEST-' . random_int(100, 999),
            'nom' => 'Zone Test Supervision',
            'departement' => 'Atlantique',
            'commune' => 'CalaviTestZone',
            'is_active' => true,
        ]);

        $propPub = Proprietes::create([
            'user_id' => $this->agent->id,
            'zone_id' => $zone->id,
            'type' => 'maison',
            'transaction_type' => 'location',
            'commune' => 'CalaviTestZone',
            'arrondissement' => 'Centre',
            'quartier' => 'Arconville',
            'accessibilite' => 'Pavé',
            'eau_courant' => 'SBEE & SONEB',
            'surface' => 220,
            'nombres_chambres' => 3,
            'avance_mois' => 3,
            'prix' => 120000,
            'status' => 'published',
        ]);

        Proprietes::create([
            'user_id' => $this->client->id,
            'zone_id' => $zone->id,
            'type' => 'parcelle',
            'transaction_type' => 'vente',
            'commune' => 'CalaviTestZone',
            'arrondissement' => 'Godomey',
            'quartier' => 'Togoudo',
            'accessibilite' => 'Goudron',
            'eau_courant' => 'Proche SBEE',
            'surface' => 450,
            'nombres_chambres' => 0,
            'avance_mois' => 0,
            'prix' => 15000000,
            'status' => 'pending',
        ]);

        $demande = Demande_client::create([
            'client_id' => $this->client->id,
            'zone_id' => $zone->id,
            'property_type' => 'maison',
            'transaction_type' => 'location',
            'target_commune' => 'CalaviTestZone',
            'budget_max' => 150000,
            'status' => 'active',
        ]);

        Visite_client::create([
            'client_id' => $this->client->id,
            'property_id' => $propPub->id,
            'zone_id' => $zone->id,
            'scheduled_date' => now()->addDays(2),
            'status' => 'pending',
            'is_fee_paid' => true,
        ]);

        Visite_client::create([
            'client_id' => $this->client->id,
            'property_id' => $propPub->id,
            'zone_id' => $zone->id,
            'scheduled_date' => now()->subDay(),
            'status' => 'completed',
            'is_fee_paid' => true,
        ]);

        DemandeDemasquage::create([
            'user_id' => $this->techAdmin->id,
            'type_dossier' => 'demande_client',
            'dossier_id' => $demande->id,
            'motif' => 'Coordination urgente',
            'justification' => 'Besoin de contacter le client pour validation de visite.',
            'statut' => 'en_attente',
            'duree_minutes' => 120,
        ]);

        $res = $this->actingAs($this->superAdmin, 'sanctum')
            ->getJson('/api/admin/dashboard/super-admin?period=month&activity_page=1&activity_per_page=5');

        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('financial_access', true)
            ->assertJsonPath('periode.key', 'month')
            ->assertJsonPath('system_health.status', 'operational')
            ->assertJsonStructure([
                'kpis' => [
                    'utilisateurs' => ['total', 'clients', 'agents', 'periode_count', 'evolution_pct'],
                    'publications' => ['total', 'publiees', 'en_attente', 'rejetees', 'conclues'],
                    'demandes_recherche' => ['total', 'actives', 'satisfaites', 'cloturees'],
                    'visites_terrain' => ['total', 'en_attente', 'programmees', 'effectuees', 'taux_completion_pct'],
                    'demasquages_ttl' => ['total', 'en_attente', 'approuves', 'actifs_maintenant'],
                    'tresorerie' => ['solde_disponible', 'total_retraits_executes', 'retraits_en_attente_count'],
                ],
                'charts' => [
                    'evolution_activites',
                    'repartition_demandes',
                    'repartition_publications',
                    'repartition_visites',
                    'performance_zones',
                ],
                'actions_en_attente',
                'sidebar_badges' => ['moderation', 'visites', 'demasquages', 'equipe', 'finance'],
                'activites_recentes' => ['data', 'current_page', 'last_page', 'per_page', 'total'],
            ]);

        // Vérifier que la zone de test est bien remontée sans double comptage
        $zoneRow = collect($res->json('charts.performance_zones'))->firstWhere('id', $zone->id);
        $this->assertNotNull($zoneRow);
        $this->assertEquals(1, $zoneRow['biens_actifs']);
        $this->assertEquals(2, $zoneRow['visites_total']);
        $this->assertEquals(1, $zoneRow['visites_effectuees']);
        $this->assertEquals(1, $zoneRow['demandes_total']);

        // Vérifier les filtres temporels (today, week, year, custom)
        foreach (['today', 'week', 'year'] as $p) {
            $pRes = $this->actingAs($this->superAdmin, 'sanctum')
                ->getJson("/api/admin/dashboard/super-admin?period={$p}");
            $pRes->assertStatus(200)->assertJsonPath('periode.key', $p);
            $this->assertNotEmpty($pRes->json('charts.evolution_activites'));
        }

        $customRes = $this->actingAs($this->superAdmin, 'sanctum')
            ->getJson('/api/admin/dashboard/super-admin?period=custom&date_debut=2026-11-01&date_fin=2026-11-27');
        $customRes->assertStatus(200)->assertJsonPath('periode.key', 'custom');
    }

    public function test_non_financial_owner_super_admin_cannot_see_treasury_data(): void
    {
        $res = $this->actingAs($this->superAdminNonFinancial, 'sanctum')
            ->getJson('/api/admin/dashboard/super-admin');

        $res->assertStatus(200)
            ->assertJsonPath('financial_access', false)
            ->assertJsonPath('kpis.tresorerie', null)
            ->assertJsonPath('sidebar_badges.finance', 0);
    }
}
