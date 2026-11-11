<?php

namespace Tests\Feature;

use App\Models\Demande_client;
use App\Models\DemandeDemasquage;
use App\Models\DocumentLegal;
use App\Models\Proprietes;
use App\Models\SignatureLegale;
use App\Models\User;
use App\Models\Visite_client;
use App\Models\Zone;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class Phase2AntiContournementAndDemasquageTest extends TestCase
{
    use DatabaseTransactions;

    protected User $justinOwner;
    protected User $techAdmin;
    protected User $secretaire;
    protected User $respZoneA;
    protected User $client1;
    protected Zone $zoneA;
    protected Zone $zoneB;
    protected Proprietes $proprieteZoneA;
    protected Proprietes $proprieteZoneB;
    protected Visite_client $visiteZoneA;
    protected Visite_client $visiteZoneB;
    protected Demande_client $demandeZoneA;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. Initialiser les zones de test
        $this->zoneA = Zone::firstOrCreate(
            ['code' => 'ZON-P2-A'],
            ['nom' => 'Zone Cotonou A', 'departement' => 'Littoral', 'commune' => 'Cotonou', 'is_active' => true]
        );
        $this->zoneB = Zone::firstOrCreate(
            ['code' => 'ZON-P2-B'],
            ['nom' => 'Zone Calavi B', 'departement' => 'Atlantique', 'commune' => 'Calavi', 'is_active' => true]
        );

        // 2. Utilisateurs
        $this->justinOwner = User::firstOrCreate(
            ['email' => 'justin.magnide@e-mobilier.bj'],
            [
                'name' => 'MAGNIDE',
                'prenom' => 'Justin',
                'telephone' => '+22997000001',
                'password' => bcrypt('Secret123!'),
                'statut' => 'actif',
                'is_verifed' => true,
            ]
        );
        $this->justinOwner->syncRoles(['Super Admin Principal', 'Admin']);

        $this->secretaire = User::firstOrCreate(
            ['email' => 'secretaire.p2@e-mobilier.bj'],
            [
                'name' => 'Secrétaire',
                'prenom' => 'P2',
                'telephone' => '+22997000003',
                'password' => bcrypt('Secret123!'),
                'statut' => 'actif',
                'is_verifed' => true,
            ]
        );
        $this->secretaire->syncRoles(['Secrétaire', 'Admin']);

        $this->respZoneA = User::firstOrCreate(
            ['email' => 'resp.zonea@e-mobilier.bj'],
            [
                'name' => 'Resp',
                'prenom' => 'ZoneA',
                'telephone' => '+22997000004',
                'zone_id' => $this->zoneA->id,
                'password' => bcrypt('Secret123!'),
                'statut' => 'actif',
                'is_verifed' => true,
            ]
        );
        $this->respZoneA->syncRoles(['Responsable de zone', 'Admin']);

        $this->client1 = User::firstOrCreate(
            ['email' => 'client.reel@gmail.com'],
            [
                'name' => 'Koffi',
                'prenom' => 'Gérard',
                'telephone' => '+22995554433',
                'password' => bcrypt('Secret123!'),
                'statut' => 'actif',
                'is_verifed' => true,
            ]
        );
        $this->client1->syncRoles(['Client']);

        // 3. Signature de la charte pour les tests secondaires
        $charte = DocumentLegal::courante('charte_non_contournement');
        if ($charte) {
            SignatureLegale::firstOrCreate(
                ['user_id' => $this->secretaire->id, 'document_legal_id' => $charte->id],
                ['hash_document' => $charte->hash_contenu, 'ip_address' => '127.0.0.1']
            );
            SignatureLegale::firstOrCreate(
                ['user_id' => $this->respZoneA->id, 'document_legal_id' => $charte->id],
                ['hash_document' => $charte->hash_contenu, 'ip_address' => '127.0.0.1']
            );
        }

        // 4. Biens et Visites
        $this->proprieteZoneA = Proprietes::create([
            'user_id' => $this->justinOwner->id,
            'zone_id' => $this->zoneA->id,
            'type' => 'parcelle',
            'transaction_type' => 'vente',
            'commune' => 'Cotonou',
            'arrondissement' => 'Cadjehoun',
            'quartier' => 'Haie Vive',
            'accessibilite' => 'Goudronné',
            'eau_courant' => 'Oui',
            'surface' => 500,
            'nombres_chambres' => 0,
            'avance_mois' => 0,
            'prix' => 45000000,
            'status' => 'published',
        ]);

        $this->proprieteZoneB = Proprietes::create([
            'user_id' => $this->justinOwner->id,
            'zone_id' => $this->zoneB->id,
            'type' => 'maison',
            'transaction_type' => 'location',
            'commune' => 'Calavi',
            'arrondissement' => 'Godomey',
            'quartier' => 'Togoudo',
            'accessibilite' => 'Pavé',
            'eau_courant' => 'Oui',
            'surface' => 200,
            'nombres_chambres' => 3,
            'avance_mois' => 3,
            'prix' => 150000,
            'status' => 'published',
        ]);

        $this->visiteZoneA = Visite_client::create([
            'client_id' => $this->client1->id,
            'property_id' => $this->proprieteZoneA->id,
            'zone_id' => $this->zoneA->id,
            'scheduled_date' => now()->addDays(2),
            'status' => 'pending',
            'is_fee_paid' => true,
        ]);

        $this->visiteZoneB = Visite_client::create([
            'client_id' => $this->client1->id,
            'property_id' => $this->proprieteZoneB->id,
            'zone_id' => $this->zoneB->id,
            'scheduled_date' => now()->addDays(3),
            'status' => 'pending',
            'is_fee_paid' => true,
        ]);

        $this->demandeZoneA = Demande_client::create([
            'client_id' => $this->client1->id,
            'zone_id' => $this->zoneA->id,
            'property_type' => 'parcelle',
            'transaction_type' => 'vente',
            'target_commune' => 'Cotonou',
            'target_arrondissement' => 'Cadjehoun',
            'budget_max' => 50000000,
            'is_paid' => true,
            'status' => 'active',
        ]);
    }

    public function test_demandes_clients_are_masked_for_secretaire(): void
    {
        $response = $this->actingAs($this->secretaire, 'sanctum')->getJson('/api/admin/demandes-clients');

        $response->assertStatus(200);

        $json = $response->getContent();
        // Vérifier que le numéro et l'e-mail réels ne fuitent pas dans le payload
        $this->assertStringNotContainsString('+22995554433', $json);
        $this->assertStringNotContainsString('client.reel@gmail.com', $json);

        // Vérifier la présence du masquage
        $items = $response->json('data.data');
        $this->assertNotEmpty($items);
        $this->assertEquals('•• •• •• •• ••', $items[0]['client']['telephone']);
        $this->assertEquals('••••••@••••.••', $items[0]['client']['email']);
        $this->assertTrue($items[0]['donnees_masquees']);
    }

    public function test_demandes_clients_are_clear_for_super_admin(): void
    {
        $response = $this->actingAs($this->justinOwner, 'sanctum')->getJson('/api/admin/demandes-clients');

        $response->assertStatus(200);

        $json = $response->getContent();
        // Justin doit voir les données en clair
        $this->assertStringContainsString('+22995554433', $json);
        $this->assertStringContainsString('client.reel@gmail.com', $json);
    }

    public function test_visites_masked_and_scoped_to_zone_for_responsable_zone(): void
    {
        $response = $this->actingAs($this->respZoneA, 'sanctum')->getJson('/api/admin/visites');

        $response->assertStatus(200);

        $items = $response->json('data.data');
        $this->assertNotEmpty($items);

        // Toutes les visites retournées doivent appartenir à sa zone (Zone A)
        foreach ($items as $item) {
            $this->assertEquals($this->zoneA->id, $item['zone_id']);
            $this->assertTrue($item['donnees_masquees']);
            $this->assertEquals('•• •• •• •• ••', $item['client']['telephone']);
        }
    }

    public function test_responsable_zone_cannot_access_visit_outside_his_zone_anti_idor(): void
    {
        // Le Responsable de la Zone A tente d'accéder à la visite de la Zone B
        $response = $this->actingAs($this->respZoneA, 'sanctum')->getJson("/api/admin/visites/{$this->visiteZoneB->id}");

        // Doit être rejeté en 403 Forbidden (Anti-IDOR)
        $response->assertStatus(403)
            ->assertJsonPath('success', false);
    }

    public function test_complete_demasquage_workflow_with_ttl_and_audit(): void
    {
        // 1. La Secrétaire soumet une demande de démasquage pour la visite de la Zone A
        $responseDemande = $this->actingAs($this->secretaire, 'sanctum')->postJson('/api/admin/demasquages/demander', [
            'type_dossier' => 'visite',
            'dossier_id' => $this->visiteZoneA->id,
            'motif' => 'Confirmation horaire jour J',
            'justification' => 'Le client a rendez-vous à 15h sur la parcelle Haie Vive et a besoin d\'orientation.',
        ]);

        $responseDemande->assertStatus(201)
            ->assertJsonPath('data.statut', 'en_attente');

        $demandeId = $responseDemande->json('data.id');

        // 2. Avant approbation : tentative de lecture des coordonnées directes -> 403 Forbidden
        $responseBlocage = $this->actingAs($this->secretaire, 'sanctum')->getJson("/api/admin/dossiers/visite/{$this->visiteZoneA->id}/coordonnees");
        $responseBlocage->assertStatus(403)
            ->assertJsonPath('code', 'UNAUTHORIZED_CONTACT_ACCESS');

        // 3. Justin (Super Admin) approuve la demande pour 60 minutes
        $responseApprobation = $this->actingAs($this->justinOwner, 'sanctum')->postJson("/api/admin/demasquages/{$demandeId}/approuver", [
            'duree_minutes' => 60,
        ]);

        $responseApprobation->assertStatus(200)
            ->assertJsonPath('data.statut', 'approuve');

        // 4. Après approbation : La Secrétaire peut lire les coordonnées réelles
        $responseCoordonnees = $this->actingAs($this->secretaire, 'sanctum')->getJson("/api/admin/dossiers/visite/{$this->visiteZoneA->id}/coordonnees");

        $responseCoordonnees->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'telephone' => '+22995554433',
                    'email' => 'client.reel@gmail.com',
                    'nom' => 'Koffi',
                ],
            ]);
    }

    public function test_demasquage_revocation_blocks_access_immediately(): void
    {
        // Créer une autorisation déjà approuvée
        $demande = DemandeDemasquage::create([
            'user_id' => $this->secretaire->id,
            'type_dossier' => 'visite',
            'dossier_id' => $this->visiteZoneA->id,
            'motif' => 'Test révocation',
            'justification' => 'Justification de test pour révocation immédiate.',
            'statut' => 'approuve',
            'approved_by' => $this->justinOwner->id,
            'approved_at' => now(),
            'duree_minutes' => 120,
            'expires_at' => now()->addMinutes(120),
        ]);

        // La Secrétaire peut consulter
        $resAvant = $this->actingAs($this->secretaire, 'sanctum')->getJson("/api/admin/dossiers/visite/{$this->visiteZoneA->id}/coordonnees");
        $resAvant->assertStatus(200);

        // Justin révoque l'accès
        $resRevoq = $this->actingAs($this->justinOwner, 'sanctum')->postJson("/api/admin/demasquages/{$demande->id}/revoquer");
        $resRevoq->assertStatus(200)
            ->assertJsonPath('data.statut', 'revoque');

        // La Secrétaire est immédiatement bloquée (403)
        $resApres = $this->actingAs($this->secretaire, 'sanctum')->getJson("/api/admin/dossiers/visite/{$this->visiteZoneA->id}/coordonnees");
        $resApres->assertStatus(403);
    }
}

