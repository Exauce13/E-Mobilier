<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Demande_client;
use App\Models\DemandeDemasquage;
use App\Models\DocumentLegal;
use App\Models\NotificationInterne;
use App\Models\Proprietes;
use App\Models\Proprietes_media;
use App\Models\SignatureLegale;
use App\Models\User;
use App\Models\Visite_client;
use App\Models\Zone;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class VisitesDemandesAuditTest extends TestCase
{
    use DatabaseTransactions;

    protected User $superAdmin;
    protected User $secretaire;
    protected User $respZoneA;
    protected User $respZoneB;
    protected User $agent;
    protected User $client;
    protected Zone $zoneA;
    protected Zone $zoneB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->zoneA = Zone::firstOrCreate(['code' => 'TEST-VD-ZA'], [
            'nom' => 'Zone Audit Cotonou',
            'departement' => 'Littoral',
            'commune' => 'Cotonou',
            'is_active' => true,
        ]);

        $this->zoneB = Zone::firstOrCreate(['code' => 'TEST-VD-ZB'], [
            'nom' => 'Zone Audit Calavi',
            'departement' => 'Atlantique',
            'commune' => 'Abomey-Calavi',
            'is_active' => true,
        ]);

        $charte = DocumentLegal::firstOrCreate(
            ['type' => 'charte_non_contournement', 'version' => '1.0'],
            [
                'titre' => 'Charte de Déontologie',
                'contenu' => 'Charte audit.',
                'hash_contenu' => hash('sha256', 'Charte audit.'),
                'est_active' => true,
                'published_at' => now(),
            ]
        );

        $this->superAdmin = User::firstOrCreate(['email' => 'justin.magnide@e-mobilier.bj'], [
            'name' => 'MAGNIDE',
            'prenom' => 'Justin',
            'telephone' => '+22997000001',
            'password' => bcrypt('Secret123!'),
            'statut' => 'actif',
            'is_verifed' => true,
        ]);
        $this->superAdmin->syncRoles(['Super Admin Principal', 'Admin']);

        $this->secretaire = User::firstOrCreate(['email' => 'sec.audit.vd@e-mobilier.bj'], [
            'name' => 'DOSSOU',
            'prenom' => 'SecretaireAudit',
            'telephone' => '+22997010002',
            'password' => bcrypt('Secret123!'),
            'statut' => 'actif',
            'is_verifed' => true,
        ]);
        $this->secretaire->syncRoles(['Secrétaire']);

        $this->respZoneA = User::firstOrCreate(['email' => 'resp.za.vd@e-mobilier.bj'], [
            'name' => 'KOUDJO',
            'prenom' => 'RespA',
            'telephone' => '+22997010003',
            'password' => bcrypt('Secret123!'),
            'statut' => 'actif',
            'zone_id' => $this->zoneA->id,
            'is_verifed' => true,
        ]);
        $this->respZoneA->syncRoles(['Responsable de zone']);

        $this->respZoneB = User::firstOrCreate(['email' => 'resp.zb.vd@e-mobilier.bj'], [
            'name' => 'HOUNGBEDJI',
            'prenom' => 'RespB',
            'telephone' => '+22997010004',
            'password' => bcrypt('Secret123!'),
            'statut' => 'actif',
            'zone_id' => $this->zoneB->id,
            'is_verifed' => true,
        ]);
        $this->respZoneB->syncRoles(['Responsable de zone']);

        foreach ([$this->secretaire, $this->respZoneA, $this->respZoneB] as $staff) {
            SignatureLegale::firstOrCreate([
                'user_id' => $staff->id,
                'document_legal_id' => $charte->id,
            ], [
                'hash_document' => $charte->hash_contenu,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'PHPUnit',
                'signed_at' => now(),
            ]);
        }

        $this->agent = User::firstOrCreate(['email' => 'agent.vd@e-mobilier.bj'], [
            'name' => 'AGOSSOU',
            'prenom' => 'AgentVD',
            'telephone' => '+22997010005',
            'password' => bcrypt('Secret123!'),
            'statut' => 'actif',
            'zone_id' => $this->zoneA->id,
            'is_verifed' => true,
        ]);
        $this->agent->syncRoles(['Agent mobilier']);

        $this->client = User::firstOrCreate(['email' => 'client.vd@e-mobilier.bj'], [
            'name' => 'MENSAH',
            'prenom' => 'ClientVD',
            'telephone' => '+22997010006',
            'password' => bcrypt('Secret123!'),
            'statut' => 'actif',
            'is_verifed' => true,
        ]);
        $this->client->syncRoles(['Client']);
    }

    public function test_demande_take_charge_concurrency_and_super_admin_reassign(): void
    {
        $demande = Demande_client::create([
            'client_id' => $this->client->id,
            'zone_id' => $this->zoneA->id,
            'property_type' => 'maison',
            'transaction_type' => 'location',
            'target_commune' => 'Cotonou',
            'target_quartier' => 'Fidjrossè',
            'budget_max' => 150000,
            'status' => 'active',
        ]);

        // 1. Prise en charge par Resp Zone A
        $res1 = $this->actingAs($this->respZoneA, 'sanctum')
            ->postJson("/api/admin/demandes-clients/{$demande->id}/prendre-en-charge");
        $res1->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('demande.gestionnaire_id', $this->respZoneA->id)
            ->assertJsonPath('demande.workflow_status', 'en_cours');

        $demande->refresh();
        $this->assertEquals($this->respZoneA->id, $demande->gestionnaire_id);
        $this->assertNotNull($demande->prise_en_charge_at);

        // 2. Tentative de prise en charge concurrente par la Secrétaire -> 409 Conflict
        $res2 = $this->actingAs($this->secretaire, 'sanctum')
            ->postJson("/api/admin/demandes-clients/{$demande->id}/prendre-en-charge");
        $res2->assertStatus(409)->assertJsonPath('success', false);

        // 3. La Secrétaire ne peut pas clôturer la demande attribuée à Resp Zone A -> 403
        $resCloseForbidden = $this->actingAs($this->secretaire, 'sanctum')
            ->postJson("/api/admin/demandes-clients/{$demande->id}/cloturer", [
                'motif_cloture' => 'satisfaite',
            ]);
        $resCloseForbidden->assertStatus(403);

        // 4. Super Admin Principal peut réattribuer explicitement
        $resReassign = $this->actingAs($this->superAdmin, 'sanctum')
            ->postJson("/api/admin/demandes-clients/{$demande->id}/prendre-en-charge", [
                'gestionnaire_id' => $this->secretaire->id,
                'force_reassign' => true,
            ]);
        $resReassign->assertStatus(200)
            ->assertJsonPath('demande.gestionnaire_id', $this->secretaire->id);
    }

    public function test_matching_excludes_unavailable_and_supports_multi_property_association(): void
    {
        $demande = Demande_client::create([
            'client_id' => $this->client->id,
            'zone_id' => $this->zoneA->id,
            'property_type' => 'maison',
            'transaction_type' => 'location',
            'target_commune' => 'Cotonou',
            'target_quartier' => 'Haie Vive',
            'budget_max' => 200000,
            'status' => 'active',
            'gestionnaire_id' => $this->secretaire->id,
            'prise_en_charge_at' => now(),
        ]);

        $propOk1 = Proprietes::create([
            'user_id' => $this->agent->id,
            'zone_id' => $this->zoneA->id,
            'type' => 'maison',
            'transaction_type' => 'location',
            'commune' => 'Cotonou',
            'arrondissement' => '12e',
            'quartier' => 'Haie Vive',
            'prix' => 180000,
            'surface' => 120,
            'nombres_chambres' => 3,
            'avance_mois' => 3,
            'accessibilite' => 'Goudronné',
            'eau_courant' => 'Oui',
            'status' => 'published',
        ]);
        Proprietes_media::create([
            'propriete_id' => $propOk1->id,
            'media_url' => 'proprietes/test-photo.jpg',
            'media_type' => 'image',
        ]);

        $propOk2 = Proprietes::create([
            'user_id' => $this->agent->id,
            'zone_id' => $this->zoneA->id,
            'type' => 'maison',
            'transaction_type' => 'location',
            'commune' => 'Cotonou',
            'arrondissement' => '12e',
            'quartier' => 'Cadjehoun',
            'prix' => 195000,
            'surface' => 100,
            'nombres_chambres' => 2,
            'avance_mois' => 3,
            'accessibilite' => 'Pavé',
            'eau_courant' => 'Oui',
            'status' => 'published',
        ]);

        $propSold = Proprietes::create([
            'user_id' => $this->agent->id,
            'zone_id' => $this->zoneA->id,
            'type' => 'maison',
            'transaction_type' => 'location',
            'commune' => 'Cotonou',
            'arrondissement' => '12e',
            'quartier' => 'Haie Vive',
            'prix' => 150000,
            'surface' => 90,
            'nombres_chambres' => 2,
            'avance_mois' => 3,
            'accessibilite' => 'Goudronné',
            'eau_courant' => 'Oui',
            'status' => 'sold_rented',
        ]);

        // Matching ne doit retourner QUE les published
        $resMatch = $this->actingAs($this->secretaire, 'sanctum')
            ->getJson("/api/admin/demandes-clients/{$demande->id}/matching-biens");
        $resMatch->assertStatus(200)->assertJsonPath('success', true);

        $ids = collect($resMatch->json('biens_suggeres'))->pluck('propriete_id')->all();
        $this->assertContains($propOk1->id, $ids);
        $this->assertContains($propOk2->id, $ids);
        $this->assertNotContains($propSold->id, $ids);

        // Vérifier photo et score 100% pour propOk1
        $first = collect($resMatch->json('biens_suggeres'))->firstWhere('propriete_id', $propOk1->id);
        $this->assertEquals(100, $first['score_matching_pourcentage']);
        $this->assertEquals('proprietes/test-photo.jpg', $first['photo_url']);

        // Refus d'associer un bien indisponible -> 422
        $resBadAssoc = $this->actingAs($this->secretaire, 'sanctum')
            ->postJson("/api/admin/demandes-clients/{$demande->id}/associer-bien", [
                'propriete_ids' => [$propSold->id],
            ]);
        $resBadAssoc->assertStatus(422);

        // Association multi-biens -> 200 + persistance pivot + notification interne client
        $resAssoc = $this->actingAs($this->secretaire, 'sanctum')
            ->postJson("/api/admin/demandes-clients/{$demande->id}/associer-bien", [
                'propriete_ids' => [$propOk1->id, $propOk2->id],
                'note_agent' => 'Deux belles options à Cotonou.',
                'notifier_client' => true,
            ]);
        $resAssoc->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('demande.biens_associes_count', 2);

        $this->assertDatabaseHas('demande_client_proprietes', [
            'demande_client_id' => $demande->id,
            'propriete_id' => $propOk1->id,
            'note_agent' => 'Deux belles options à Cotonou.',
        ]);
        $this->assertDatabaseHas('demande_client_proprietes', [
            'demande_client_id' => $demande->id,
            'propriete_id' => $propOk2->id,
        ]);
        $this->assertTrue(
            NotificationInterne::where('user_id', $this->client->id)
                ->where('type', 'matching_bien')
                ->exists()
        );
    }

    public function test_demande_closure_satisfied_abandoned_and_expiration_rules(): void
    {
        // 1. Satisfaite
        $dem1 = Demande_client::create([
            'client_id' => $this->client->id,
            'zone_id' => $this->zoneA->id,
            'property_type' => 'chambre',
            'transaction_type' => 'location',
            'target_commune' => 'Cotonou',
            'budget_max' => 40000,
            'status' => 'active',
            'gestionnaire_id' => $this->respZoneA->id,
            'prise_en_charge_at' => now(),
        ]);

        // Blocage expiration manuelle arbitraire avant échéance (expires_at = +30j)
        $resArbitraryExp = $this->actingAs($this->superAdmin, 'sanctum')
            ->postJson("/api/admin/demandes-clients/{$dem1->id}/cloturer", [
                'motif_cloture' => 'delai_depasse',
            ]);
        $resArbitraryExp->assertStatus(422);

        // Passage à Satisfaite -> status = fulfilled + cloture_at + cloture_par_id
        $resSat = $this->actingAs($this->respZoneA, 'sanctum')
            ->postJson("/api/admin/demandes-clients/{$dem1->id}/cloturer", [
                'motif_cloture' => 'satisfaite',
                'motif_details' => 'Bail signé avec succès.',
            ]);
        $resSat->assertStatus(200)
            ->assertJsonPath('demande.status', 'fulfilled')
            ->assertJsonPath('demande.workflow_status', 'satisfaite');

        $dem1->refresh();
        $this->assertEquals('fulfilled', $dem1->status);
        $this->assertNotNull($dem1->cloture_at);
        $this->assertEquals($this->respZoneA->id, $dem1->cloture_par_id);

        // Double clôture interdite -> 422
        $resDouble = $this->actingAs($this->superAdmin, 'sanctum')
            ->postJson("/api/admin/demandes-clients/{$dem1->id}/cloturer", [
                'motif_cloture' => 'abandonnee_client',
            ]);
        $resDouble->assertStatus(422);

        // 2. Abandonnée avec motif
        $dem2 = Demande_client::create([
            'client_id' => $this->client->id,
            'zone_id' => $this->zoneA->id,
            'property_type' => 'parcelle',
            'transaction_type' => 'vente',
            'target_commune' => 'Cotonou',
            'budget_max' => 10000000,
            'status' => 'active',
            'gestionnaire_id' => $this->respZoneA->id,
        ]);

        $resAb = $this->actingAs($this->respZoneA, 'sanctum')
            ->postJson("/api/admin/demandes-clients/{$dem2->id}/cloturer", [
                'motif_cloture' => 'abandonnee_client',
                'motif_details' => 'Client parti à l’étranger.',
            ]);
        $resAb->assertStatus(200)
            ->assertJsonPath('demande.status', 'closed')
            ->assertJsonPath('demande.workflow_status', 'abandonnee')
            ->assertJsonPath('demande.motif_cloture_details', 'Client parti à l’étranger.');

        // 3. Expiration automatique via commande Artisan demandes:expirer
        $dem3 = Demande_client::create([
            'client_id' => $this->client->id,
            'zone_id' => $this->zoneA->id,
            'property_type' => 'maison',
            'transaction_type' => 'vente',
            'target_commune' => 'Cotonou',
            'budget_max' => 30000000,
            'status' => 'active',
            'expires_at' => now()->subHour(),
        ]);

        Artisan::call('demandes:expirer');
        $dem3->refresh();
        $this->assertEquals('closed', $dem3->status);
        $this->assertEquals('delai_depasse', $dem3->motif_cloture);
        $this->assertEquals('expiree', $dem3->workflow_status);
        $this->assertTrue(
            AuditLog::where('action', 'demande_recherche_expiree_auto')
                ->where('target_id', $dem3->id)
                ->exists()
        );

        // 4. Vérification historique d'audit de dem1
        $resHist = $this->actingAs($this->superAdmin, 'sanctum')
            ->getJson("/api/admin/demandes-clients/{$dem1->id}/historique");
        $resHist->assertStatus(200)->assertJsonPath('success', true);
        $this->assertNotEmpty($resHist->json('data'));
    }

    public function test_visite_lifecycle_blocks_inconsistent_transitions_and_logs_history(): void
    {
        $bien = Proprietes::create([
            'user_id' => $this->agent->id,
            'zone_id' => $this->zoneA->id,
            'type' => 'maison',
            'transaction_type' => 'vente',
            'commune' => 'Cotonou',
            'arrondissement' => '4e',
            'quartier' => 'Akpakpa',
            'prix' => 45000000,
            'surface' => 250,
            'nombres_chambres' => 4,
            'avance_mois' => 0,
            'accessibilite' => 'Goudronné',
            'eau_courant' => 'Oui',
            'status' => 'published',
        ]);

        $visite = Visite_client::create([
            'client_id' => $this->client->id,
            'property_id' => $bien->id,
            'zone_id' => $this->zoneA->id,
            'scheduled_date' => now()->addDays(2),
            'status' => 'pending',
            'is_fee_paid' => true,
        ]);

        // Compte-rendu sur une visite encore pending -> 422
        $resCrEarly = $this->actingAs($this->respZoneA, 'sanctum')
            ->postJson("/api/admin/visites/{$visite->id}/compte-rendu", [
                'compte_rendu' => 'Tentative avant planification confirmée.',
            ]);
        $resCrEarly->assertStatus(422);

        // Annulation d'une visite pending -> 200
        $resCancel = $this->actingAs($this->respZoneA, 'sanctum')
            ->patchJson("/api/admin/visites/{$visite->id}/statut", [
                'status' => 'cancelled',
                'motif' => 'Client indisponible.',
            ]);
        $resCancel->assertStatus(200)->assertJsonPath('data.status', 'cancelled');

        // Impossible de confirmer une visite déjà annulée -> 422
        $resReconfirm = $this->actingAs($this->superAdmin, 'sanctum')
            ->patchJson("/api/admin/visites/{$visite->id}/statut", [
                'status' => 'confirmed',
            ]);
        $resReconfirm->assertStatus(422);

        // Impossible de planifier une visite annulée -> 422
        $resReplan = $this->actingAs($this->superAdmin, 'sanctum')
            ->postJson("/api/admin/visites/{$visite->id}/planifier", [
                'scheduled_date' => now()->addDays(3)->format('Y-m-d H:i:s'),
            ]);
        $resReplan->assertStatus(422);

        // Historique d'audit de la visite
        $resHist = $this->actingAs($this->respZoneA, 'sanctum')
            ->getJson("/api/admin/visites/{$visite->id}/historique");
        $resHist->assertStatus(200)->assertJsonPath('success', true);
        $this->assertNotEmpty($resHist->json('data'));
    }

    public function test_coordonnees_permissions_and_stats_filters(): void
    {
        $demande = Demande_client::create([
            'client_id' => $this->client->id,
            'zone_id' => $this->zoneB->id,
            'property_type' => 'maison',
            'transaction_type' => 'location',
            'target_commune' => 'Abomey-Calavi',
            'budget_max' => 90000,
            'status' => 'active',
        ]);

        // Resp Zone A hors zone -> 403 Anti-IDOR
        $this->actingAs($this->respZoneA, 'sanctum')
            ->getJson("/api/admin/dossiers/demande_client/{$demande->id}/coordonnees")
            ->assertStatus(403);

        // Secrétaire sans TTL -> 403 avec demasquage_requis = true
        $this->actingAs($this->secretaire, 'sanctum')
            ->getJson("/api/admin/dossiers/demande_client/{$demande->id}/coordonnees")
            ->assertStatus(403)
            ->assertJsonPath('demasquage_requis', true);

        // Super Admin Principal -> 200 + trace audit
        $this->actingAs($this->superAdmin, 'sanctum')
            ->getJson("/api/admin/dossiers/demande_client/{$demande->id}/coordonnees")
            ->assertStatus(200)
            ->assertJsonPath('data.telephone', $this->client->telephone);

        // Vérification stats réelles, démasquage Super Admin et permissions serveur
        $resList = $this->actingAs($this->superAdmin, 'sanctum')
            ->getJson('/api/admin/demandes-clients?workflow_status=en_attente&search=Calavi');
        $resList->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'stats' => ['total_demandes', 'en_attente', 'en_cours', 'satisfaites', 'abandonnees', 'expirees'],
                'data' => ['data'],
            ]);

        $found = collect($resList->json('data.data'))->firstWhere('id', $demande->id);
        $this->assertNotNull($found);
        $this->assertFalse($found['donnees_masquees']);
        $this->assertTrue($found['permissions']['can_take_charge']);
        $this->assertTrue($found['permissions']['can_match']);
        $this->assertFalse($found['permissions']['can_mark_expired']);

        $resVis = $this->actingAs($this->superAdmin, 'sanctum')
            ->getJson('/api/admin/visites');
        $resVis->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'stats' => ['total_visites', 'en_attente', 'programmees', 'effectuees', 'annulees'],
                'data' => ['data'],
            ]);
    }
}
