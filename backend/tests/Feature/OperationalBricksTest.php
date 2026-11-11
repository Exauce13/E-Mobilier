<?php

namespace Tests\Feature;

use App\Models\Demande_client;
use App\Models\DocumentLegal;
use App\Models\Proprietes;
use App\Models\SignatureLegale;
use App\Models\User;
use App\Models\Visite_client;
use App\Models\Zone;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class OperationalBricksTest extends TestCase
{
    use DatabaseTransactions;

    protected User $justinOwner;
    protected User $techAdmin;
    protected User $secretaire;
    protected User $respZoneA;
    protected User $agentMobilier;
    protected User $client;
    protected Zone $zoneA;
    protected Zone $zoneB;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. Zones pilotes
        $this->zoneA = Zone::firstOrCreate(['code' => 'LIT-CTN-BRIQUE'], [
            'nom' => 'Littoral - Cotonou Centre',
            'departement' => 'Littoral',
            'commune' => 'Cotonou',
            'is_active' => true,
        ]);

        $this->zoneB = Zone::firstOrCreate(['code' => 'ATL-CAL-BRIQUE'], [
            'nom' => 'Atlantique - Calavi',
            'departement' => 'Atlantique',
            'commune' => 'Abomey-Calavi',
            'is_active' => true,
        ]);

        // Charte
        $charte = DocumentLegal::firstOrCreate(
            ['type' => 'charte_non_contournement', 'version' => '1.0'],
            [
                'titre' => 'Charte de Déontologie',
                'contenu' => 'Engagement de confidentialité et non-contournement.',
                'hash_contenu' => hash('sha256', 'Engagement de confidentialité et non-contournement.'),
                'est_active' => true,
                'published_at' => now(),
            ]
        );

        // 2. Justin MAGNIDE
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

        // 3. Super Admin Technique
        $this->techAdmin = User::firstOrCreate(
            ['email' => 'tech.briques@e-mobilier.bj'],
            [
                'name' => 'GNIKPO',
                'prenom' => 'Jean-Paul',
                'telephone' => '+22997000002',
                'password' => bcrypt('Secret123!'),
                'statut' => 'actif',
                'is_verifed' => true,
            ]
        );
        $this->techAdmin->syncRoles(['Super Admin Technique', 'Admin']);

        // 4. Secrétaire
        $this->secretaire = User::firstOrCreate(
            ['email' => 'secretaire.briques@e-mobilier.bj'],
            [
                'name' => 'Secrétaire',
                'prenom' => 'Briques',
                'telephone' => '+22997000003',
                'password' => bcrypt('Secret123!'),
                'statut' => 'actif',
                'is_verifed' => true,
            ]
        );
        $this->secretaire->syncRoles(['Secrétaire']);
        SignatureLegale::firstOrCreate([
            'user_id' => $this->secretaire->id,
            'document_legal_id' => $charte->id,
        ], [
            'hash_document' => $charte->hash_contenu,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'TestRunner',
            'signed_at' => now(),
        ]);

        // 5. Responsable de zone A
        $this->respZoneA = User::firstOrCreate(
            ['email' => 'resp.zonea.briques@e-mobilier.bj'],
            [
                'name' => 'Resp',
                'prenom' => 'ZoneA',
                'telephone' => '+22997000004',
                'password' => bcrypt('Secret123!'),
                'statut' => 'actif',
                'zone_id' => $this->zoneA->id,
                'is_verifed' => true,
            ]
        );
        $this->respZoneA->syncRoles(['Responsable de zone']);
        SignatureLegale::firstOrCreate([
            'user_id' => $this->respZoneA->id,
            'document_legal_id' => $charte->id,
        ], [
            'hash_document' => $charte->hash_contenu,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'TestRunner',
            'signed_at' => now(),
        ]);

        // 6. Agent Mobilier
        $this->agentMobilier = User::firstOrCreate(
            ['email' => 'agent.briques@e-mobilier.bj'],
            [
                'name' => 'Agent',
                'prenom' => 'Partenaire',
                'telephone' => '+22997000007',
                'password' => bcrypt('Secret123!'),
                'statut' => 'actif',
                'zone_id' => $this->zoneA->id,
                'is_verifed' => false, // Initialement non vérifié
            ]
        );
        $this->agentMobilier->syncRoles(['Agent mobilier']);

        // 7. Client
        $this->client = User::firstOrCreate(
            ['email' => 'client.briques@gmail.com'],
            [
                'name' => 'Client',
                'prenom' => 'Briques',
                'telephone' => '+22997000008',
                'password' => bcrypt('Secret123!'),
                'statut' => 'actif',
                'is_verifed' => true,
            ]
        );
        $this->client->syncRoles(['Client']);
    }

    /**
     * BRIQUE A : Modération du catalogue (validation et rejet avec motif).
     */
    public function test_secretaire_can_validate_and_reject_pending_properties(): void
    {
        // 1. Bien en attente à valider
        $bien1 = Proprietes::create([
            'user_id' => $this->agentMobilier->id,
            'zone_id' => $this->zoneA->id,
            'type' => 'maison',
            'transaction_type' => 'vente',
            'commune' => 'Cotonou',
            'arrondissement' => 'Cadjehoun',
            'quartier' => 'Haie Vive',
            'surface' => 450.0,
            'nombres_chambres' => 4,
            'avance_mois' => 0,
            'prix' => 85000000,
            'accessibilite' => 'Goudronné',
            'eau_courant' => 'Oui',
            'status' => 'pending',
        ]);

        $resValider = $this->actingAs($this->secretaire, 'sanctum')->postJson("/api/admin/proprietes/{$bien1->id}/valider");
        $resValider->assertStatus(200)
            ->assertJson(['success' => true]);

        $bien1->refresh();
        $this->assertEquals('published', $bien1->status);

        // 2. Bien en attente à rejeter avec motif
        $bien2 = Proprietes::create([
            'user_id' => $this->agentMobilier->id,
            'zone_id' => $this->zoneA->id,
            'type' => 'parcelle',
            'transaction_type' => 'vente',
            'commune' => 'Cotonou',
            'arrondissement' => 'Akpakpa',
            'quartier' => 'Dédokpo',
            'surface' => 350.0,
            'nombres_chambres' => 0,
            'avance_mois' => 0,
            'prix' => 18000000,
            'accessibilite' => 'Piste',
            'eau_courant' => 'Non',
            'status' => 'pending',
        ]);

        $resRejeter = $this->actingAs($this->secretaire, 'sanctum')->postJson("/api/admin/proprietes/{$bien2->id}/rejeter", [
            'motif' => 'Titre foncier manquant et photos floues non conformes.',
        ]);
        $resRejeter->assertStatus(200)
            ->assertJson(['success' => true]);

        $bien2->refresh();
        $this->assertEquals('rejected', $bien2->status);
        $this->assertEquals('Titre foncier manquant et photos floues non conformes.', $bien2->motif_rejet);
    }

    /**
     * BRIQUE A : Marquage conclu (vendu/loué) avec respect strict de la zone (Anti-IDOR).
     */
    public function test_responsable_zone_can_mark_property_as_concluded_in_his_zone_only(): void
    {
        $bienZoneA = Proprietes::create([
            'user_id' => $this->agentMobilier->id,
            'zone_id' => $this->zoneA->id,
            'type' => 'maison',
            'transaction_type' => 'vente',
            'commune' => 'Cotonou',
            'arrondissement' => 'Haie Vive',
            'quartier' => 'Cocotiers',
            'surface' => 500.0,
            'nombres_chambres' => 5,
            'avance_mois' => 0,
            'prix' => 120000000,
            'accessibilite' => 'Goudronné',
            'eau_courant' => 'Oui',
            'status' => 'published',
        ]);

        $bienZoneB = Proprietes::create([
            'user_id' => $this->agentMobilier->id,
            'zone_id' => $this->zoneB->id,
            'type' => 'parcelle',
            'transaction_type' => 'vente',
            'commune' => 'Abomey-Calavi',
            'arrondissement' => 'Godomey',
            'quartier' => 'Togoudo',
            'surface' => 400.0,
            'nombres_chambres' => 0,
            'avance_mois' => 0,
            'prix' => 15000000,
            'accessibilite' => 'Piste',
            'eau_courant' => 'Non',
            'status' => 'published',
        ]);

        // 1. Succès sur son secteur (Zone A)
        $resA = $this->actingAs($this->respZoneA, 'sanctum')->postJson("/api/admin/proprietes/{$bienZoneA->id}/marquer-conclu");
        $resA->assertStatus(200)
            ->assertJson(['success' => true]);

        $bienZoneA->refresh();
        $this->assertEquals('sold_rented', $bienZoneA->status);

        // 2. Échec Anti-IDOR sur le secteur voisin (Zone B)
        $resB = $this->actingAs($this->respZoneA, 'sanctum')->postJson("/api/admin/proprietes/{$bienZoneB->id}/marquer-conclu");
        $resB->assertStatus(403);
    }

    /**
     * BRIQUE B : Planification, compte-rendu terrain et escalade d'offre vers Justin.
     */
    public function test_operational_visit_planning_and_escalation_flow(): void
    {
        $bien = Proprietes::create([
            'user_id' => $this->agentMobilier->id,
            'zone_id' => $this->zoneA->id,
            'type' => 'maison',
            'transaction_type' => 'vente',
            'commune' => 'Cotonou',
            'arrondissement' => 'Cadjehoun',
            'quartier' => 'Patte d\'Oie',
            'surface' => 300.0,
            'nombres_chambres' => 3,
            'avance_mois' => 0,
            'prix' => 60000000,
            'accessibilite' => 'Goudronné',
            'eau_courant' => 'Oui',
            'status' => 'published',
        ]);

        $visite = Visite_client::create([
            'client_id' => $this->client->id,
            'property_id' => $bien->id,
            'zone_id' => $this->zoneA->id,
            'scheduled_date' => now()->addDay(),
            'status' => 'pending',
            'is_fee_paid' => true,
        ]);

        // 1. Planification par la Secrétaire
        $resPlan = $this->actingAs($this->secretaire, 'sanctum')->postJson("/api/admin/visites/{$visite->id}/planifier", [
            'scheduled_date' => now()->addDays(2)->format('Y-m-d H:i:s'),
            'instructions_itineraire' => 'Carrefour Patte d\'Oie, 2e ruelle à droite face pharmacie.',
        ]);
        $resPlan->assertStatus(200)
            ->assertJson(['success' => true]);

        // 2. Compte-rendu terrain par le Responsable de zone
        $resCR = $this->actingAs($this->respZoneA, 'sanctum')->postJson("/api/admin/visites/{$visite->id}/compte-rendu", [
            'compte_rendu' => 'Visite effectuée. Le client a adoré les volumes et la cour extérieure. Prêt à faire une offre formelle.',
        ]);
        $resCR->assertStatus(200)
            ->assertJson(['success' => true]);

        // 3. Escalade commerciale majeure vers Justin MAGNIDE
        $resEscalade = $this->actingAs($this->respZoneA, 'sanctum')->postJson("/api/admin/visites/{$visite->id}/escalader-offre", [
            'offre_montant' => 55000000,
            'commentaires' => 'Offre ferme avec promesse de paiement comptant sous 15 jours.',
        ]);
        $resEscalade->assertStatus(200)
            ->assertJson(['success' => true]);

        $visite->refresh();
        $this->assertTrue($visite->is_escalade_haute);
        $this->assertEquals(55000000, (float) $visite->offre_montant);
    }

    /**
     * BRIQUE C : Moteur de Rapprochement (Matching Engine) et association d'un bien.
     */
    public function test_search_request_matching_engine_computes_scores_and_links_property(): void
    {
        // 1. Création d'une demande de recherche
        $demande = Demande_client::create([
            'client_id' => $this->client->id,
            'zone_id' => $this->zoneB->id,
            'property_type' => 'maison',
            'transaction_type' => 'vente',
            'target_commune' => 'Abomey-Calavi',
            'budget_max' => 50000000,
            'status' => 'active',
            'is_paid' => true,
        ]);

        // 2. Prise en charge par le Responsable de zone
        $resTake = $this->actingAs($this->respZoneA, 'sanctum')->postJson("/api/admin/demandes-clients/{$demande->id}/prendre-en-charge");
        // Demande est en zone B, respZoneA est en zone A -> 403 Anti-IDOR
        $resTake->assertStatus(403);

        // Prise en charge par la Secrétaire (autorité globale)
        $resSec = $this->actingAs($this->secretaire, 'sanctum')->postJson("/api/admin/demandes-clients/{$demande->id}/prendre-en-charge");
        $resSec->assertStatus(200)
            ->assertJson(['success' => true]);

        // 3. Création de biens dans le catalogue
        $bienCompatible = Proprietes::create([
            'user_id' => $this->agentMobilier->id,
            'zone_id' => $this->zoneB->id,
            'type' => 'maison',
            'transaction_type' => 'vente',
            'commune' => 'Abomey-Calavi',
            'arrondissement' => 'Calavi Centre',
            'quartier' => 'Kpota',
            'surface' => 380.0,
            'nombres_chambres' => 3,
            'avance_mois' => 0,
            'prix' => 42000000, // < 50M -> Match parfait (100%)
            'accessibilite' => 'Pavé',
            'eau_courant' => 'Oui',
            'status' => 'published',
        ]);

        // 4. Exécution du Matching Engine
        $resMatch = $this->actingAs($this->secretaire, 'sanctum')->getJson("/api/admin/demandes-clients/{$demande->id}/matching-biens");
        $resMatch->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $biensSuggeres = $resMatch->json('biens_suggeres');
        $this->assertNotEmpty($biensSuggeres);
        $this->assertEquals(100, $biensSuggeres[0]['score_matching_pourcentage']);

        // 5. Association du bien retenu
        $resAssoc = $this->actingAs($this->secretaire, 'sanctum')->postJson("/api/admin/demandes-clients/{$demande->id}/associer-bien", [
            'propriete_id' => $bienCompatible->id,
        ]);
        $resAssoc->assertStatus(200)
            ->assertJson(['success' => true]);

        $demande->refresh();
        $this->assertEquals($bienCompatible->id, $demande->matched_propriete_id);
    }

    /**
     * BRIQUE D : Agrément KYC et suspension avec révocation en cascade des annonces.
     */
    public function test_agent_kyc_approval_and_cascading_suspension_of_properties(): void
    {
        // 1. Validation de l'agrément KYC
        $this->assertFalse($this->agentMobilier->is_verifed);

        $resKyc = $this->actingAs($this->secretaire, 'sanctum')->postJson("/api/admin/agents-mobiliers/{$this->agentMobilier->id}/approuver");
        $resKyc->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->agentMobilier->refresh();
        $this->assertTrue($this->agentMobilier->is_verifed);

        // 2. L'agent publie 2 annonces validées
        $prop1 = Proprietes::create([
            'user_id' => $this->agentMobilier->id,
            'zone_id' => $this->zoneA->id,
            'type' => 'parcelle',
            'transaction_type' => 'vente',
            'commune' => 'Cotonou',
            'arrondissement' => 'Fidjrossè',
            'quartier' => 'Plage',
            'surface' => 500.0,
            'nombres_chambres' => 0,
            'avance_mois' => 0,
            'prix' => 35000000,
            'accessibilite' => 'Piste',
            'eau_courant' => 'Non',
            'status' => 'published',
        ]);

        $prop2 = Proprietes::create([
            'user_id' => $this->agentMobilier->id,
            'zone_id' => $this->zoneA->id,
            'type' => 'maison',
            'transaction_type' => 'location',
            'commune' => 'Cotonou',
            'arrondissement' => 'Fidjrossè',
            'quartier' => 'Kpota',
            'surface' => 200.0,
            'nombres_chambres' => 2,
            'avance_mois' => 3,
            'prix' => 150000,
            'accessibilite' => 'Goudronné',
            'eau_courant' => 'Oui',
            'status' => 'published',
        ]);

        // 3. Révocation KYC & Suspension avec effet cascade
        $resSuspend = $this->actingAs($this->secretaire, 'sanctum')->postJson("/api/admin/agents-mobiliers/{$this->agentMobilier->id}/suspendre");
        $resSuspend->assertStatus(200)
            ->assertJson([
                'success' => true,
                'annonces_desactivees' => 2,
            ]);

        $this->agentMobilier->refresh();
        $this->assertEquals('suspendu', $this->agentMobilier->statut);
        $this->assertFalse($this->agentMobilier->is_verifed);

        // Vérification du gel atomique des annonces en ligne
        $prop1->refresh();
        $prop2->refresh();
        $this->assertEquals('pending', $prop1->status);
        $this->assertEquals('pending', $prop2->status);
    }

    /**
     * BRIQUE E : Tableaux de bord opérationnels et exclusion absolue de montants FCFA.
     */
    public function test_operational_metrics_dashboard_strictly_excludes_monetary_amounts(): void
    {
        $response = $this->actingAs($this->justinOwner, 'sanctum')->getJson('/api/admin/metriques/operations-globales');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'periode',
                'indicateurs_visites_terrain' => ['total_visites', 'visites_effectuees', 'taux_completion_pourcentage'],
                'indicateurs_demandes_recherche' => ['total_demandes', 'demandes_satisfaites', 'taux_transformation_pourcentage'],
                'catalogue_immobilier' => ['annonces_en_ligne', 'annonces_en_attente_moderation', 'biens_vendus_ou_loues_ce_mois'],
            ]);

        $json = $response->getContent();
        // Vérification d'étanchéité stricte : Zéro fuite de données financières
        $this->assertStringNotContainsString('chiffre_affaires', strtolower($json));
        $this->assertStringNotContainsString('solde', strtolower($json));
        $this->assertStringNotContainsString('commission', strtolower($json));
    }
}
