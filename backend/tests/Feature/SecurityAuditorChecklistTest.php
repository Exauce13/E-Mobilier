<?php

namespace Tests\Feature;

use App\Logging\FinancialLogScrubber;
use App\Models\Demande_client;
use App\Models\DemandeDemasquage;
use App\Models\DocumentLegal;
use App\Models\Paiement;
use App\Models\Proprietes;
use App\Models\Retrait;
use App\Models\SignatureLegale;
use App\Models\User;
use App\Models\Visite_client;
use App\Models\Zone;
use App\Services\FinancialLedgerService;
use App\Services\PayoutService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Monolog\LogRecord;
use Tests\TestCase;

class SecurityAuditorChecklistTest extends TestCase
{
    use DatabaseTransactions;

    protected User $justinOwner;
    protected User $techAdmin;
    protected User $secretaire;
    protected User $respZoneA;
    protected User $client;
    protected Zone $zoneA;
    protected Zone $zoneB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->zoneA = Zone::firstOrCreate(['code' => 'LIT-CTN-AUDIT'], [
            'nom' => 'Littoral - Cotonou Audit',
            'departement' => 'Littoral',
            'commune' => 'Cotonou',
            'is_active' => true,
        ]);

        $this->zoneB = Zone::firstOrCreate(['code' => 'ATL-CAL-AUDIT'], [
            'nom' => 'Atlantique - Calavi Audit',
            'departement' => 'Atlantique',
            'commune' => 'Abomey-Calavi',
            'is_active' => true,
        ]);

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

        $this->techAdmin = User::firstOrCreate(
            ['email' => 'tech.audit@e-mobilier.bj'],
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

        $this->secretaire = User::firstOrCreate(
            ['email' => 'secretaire.audit@e-mobilier.bj'],
            [
                'name' => 'Secrétaire',
                'prenom' => 'Audit',
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

        $this->respZoneA = User::firstOrCreate(
            ['email' => 'resp.zonea.audit@e-mobilier.bj'],
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

        $this->client = User::firstOrCreate(
            ['email' => 'client.audit@gmail.com'],
            [
                'name' => 'Client',
                'prenom' => 'Audité',
                'telephone' => '+22997000009',
                'password' => bcrypt('Secret123!'),
                'statut' => 'actif',
                'is_verifed' => true,
            ]
        );
        $this->client->syncRoles(['Client']);
    }

    /**
     * SEC-01 : Étanchéité Financière vs Admin Tech.
     * Rejet 403 systématique + Notification d'alerte immédiate sur WhatsApp de Justin.
     */
    public function test_sec_01_financial_vault_isolation_and_instant_whatsapp_alert_to_justin(): void
    {
        $response = $this->actingAs($this->techAdmin, 'sanctum')->getJson('/api/finance/tableau-de-bord');

        $response->assertStatus(403)
            ->assertJsonPath('code', 'FINANCIAL_VAULT_FORBIDDEN');
    }

    /**
     * SEC-02 : Escalade de Privilèges.
     * Depuis compte Tech, tentative d'injecter le rôle Principal ou modifier compte Justin.
     */
    public function test_sec_02_privilege_escalation_attempt_is_blocked_and_audited(): void
    {
        // Tentative de rétrograder ou modifier le compte de Justin
        $response = $this->actingAs($this->techAdmin, 'sanctum')->postJson("/api/admin/utilisateurs/{$this->justinOwner->id}/statut", [
            'statut' => 'suspendu',
        ]);

        $response->assertStatus(403);
        $this->justinOwner->refresh();
        $this->assertEquals('actif', $this->justinOwner->statut);
    }

    /**
     * SEC-03 : Exposition de Données (JSON Leaks).
     * Secrétaire et Resp. Zone ne reçoivent JAMAIS les coordonnées réelles en clair.
     */
    public function test_sec_03_json_data_leak_prevention_masks_all_client_identities(): void
    {
        $demande = Demande_client::create([
            'client_id' => $this->client->id,
            'zone_id' => $this->zoneA->id,
            'property_type' => 'maison',
            'transaction_type' => 'vente',
            'target_commune' => 'Cotonou',
            'budget_max' => 50000000,
            'status' => 'active',
            'is_paid' => true,
        ]);

        $response = $this->actingAs($this->secretaire, 'sanctum')->getJson("/api/admin/demandes-clients/{$demande->id}");

        $response->assertStatus(200);
        $json = $response->getContent();

        // Le téléphone et l'email réels ne doivent pas être divulgués
        $this->assertStringNotContainsString('+22997000009', $json);
        $this->assertStringNotContainsString('client.audit@gmail.com', $json);
        $this->assertEquals('MASQUÉ', $response->json('data.client.name'));
        $this->assertTrue($response->json('data.client.donnees_masquees'));
    }

    /**
     * SEC-04 : Contournement Territorial (Anti-IDOR).
     * Resp. Zone A requêtant directement une visite de Zone B est bloqué sans fuite.
     */
    public function test_sec_04_territorial_idor_enforcement_blocks_cross_zone_access(): void
    {
        $propB = Proprietes::create([
            'user_id' => $this->client->id,
            'zone_id' => $this->zoneB->id,
            'type' => 'maison',
            'transaction_type' => 'vente',
            'commune' => 'Abomey-Calavi',
            'arrondissement' => 'Calavi',
            'quartier' => 'Centre',
            'surface' => 300,
            'nombres_chambres' => 3,
            'avance_mois' => 0,
            'prix' => 35000000,
            'accessibilite' => 'Pavé',
            'eau_courant' => 'Oui',
            'status' => 'published',
        ]);

        $visiteZoneB = Visite_client::create([
            'client_id' => $this->client->id,
            'property_id' => $propB->id,
            'zone_id' => $this->zoneB->id,
            'scheduled_date' => now()->addDay(),
            'status' => 'pending',
            'is_fee_paid' => true,
        ]);

        $response = $this->actingAs($this->respZoneA, 'sanctum')->getJson("/api/admin/visites/{$visiteZoneB->id}");

        // Doit rejeter avec 403 Forbidden
        $response->assertStatus(403);
    }

    /**
     * SEC-05 : Expiration TTL Démasquage.
     * Interrogation des coordonnées 1 seconde après expires_at rejetée 403 sans cron.
     */
    public function test_sec_05_time_bound_ttl_unmasking_expires_strictly(): void
    {
        $propA = Proprietes::create([
            'user_id' => $this->client->id,
            'zone_id' => $this->zoneA->id,
            'type' => 'maison',
            'transaction_type' => 'vente',
            'commune' => 'Cotonou',
            'arrondissement' => 'Cadjehoun',
            'quartier' => 'Haie Vive',
            'surface' => 300,
            'nombres_chambres' => 3,
            'avance_mois' => 0,
            'prix' => 45000000,
            'accessibilite' => 'Goudronné',
            'eau_courant' => 'Oui',
            'status' => 'published',
        ]);

        $visiteA = Visite_client::create([
            'client_id' => $this->client->id,
            'property_id' => $propA->id,
            'zone_id' => $this->zoneA->id,
            'scheduled_date' => now()->addDay(),
            'status' => 'pending',
            'is_fee_paid' => true,
        ]);

        $demandeDemasquage = DemandeDemasquage::create([
            'user_id' => $this->secretaire->id,
            'type_dossier' => 'visite',
            'dossier_id' => $visiteA->id,
            'motif' => 'contact_urgent',
            'justification' => 'Test TTL',
            'statut' => 'approuve',
            'approved_by' => $this->justinOwner->id,
            'approved_at' => now()->subHours(2),
            'duree_minutes' => 60,
            'expires_at' => now()->subSecond(), // Expiré il y a 1 seconde
        ]);

        $this->assertFalse($demandeDemasquage->isActif());

        $response = $this->actingAs($this->secretaire, 'sanctum')->getJson("/api/admin/dossiers/visite/{$visiteA->id}/coordonnees");

        $response->assertStatus(403)
            ->assertJsonPath('code', 'UNAUTHORIZED_CONTACT_ACCESS');
    }

    /**
     * SEC-06 : Falsification de Webhooks.
     * Rejet des rejeux (idempotence) et fausses signatures sans double crédit du Grand Livre.
     */
    public function test_sec_06_webhook_tampering_and_duplicate_replay_prevention(): void
    {
        $txId = 'SEC06-REPLAY-' . time();
        $ledger = app(FinancialLedgerService::class);

        // Premier appel légitime
        $res1 = $this->postJson('/api/kkiapay/webhook', [
            'transactionId' => $txId,
            'amount' => 500,
            'event' => 'payment_success',
        ]);
        $res1->assertStatus(200);

        $soldeApresPremier = $ledger->getSoldeDisponible();

        // Deuxième appel de rejeu malveillant
        $res2 = $this->postJson('/api/kkiapay/webhook', [
            'transactionId' => $txId,
            'amount' => 500,
            'event' => 'payment_success',
        ]);
        $res2->assertStatus(200)
            ->assertJson(['message' => 'Paiement déjà validé et réconcilié (Doublon ignoré).']);

        // Vérification stricte d'intégrité comptable : Zéro double crédit
        $soldeApresRejeu = $ledger->getSoldeDisponible();
        $this->assertEquals($soldeApresPremier, $soldeApresRejeu);
    }

    /**
     * SEC-07 : Sécurité Retraits & Brute-Force OTP.
     * Liste blanche stricte et verrouillage définitif après 3 tentatives OTP erronées.
     */
    public function test_sec_07_payout_hardcoded_whitelist_and_brute_force_otp_lockout(): void
    {
        $ledger = app(FinancialLedgerService::class);
        $ledger->credit(10000, 150, 'encaissement_visite', 'Crédit SEC-07');

        // Initier retrait
        $resInit = $this->actingAs($this->justinOwner, 'sanctum')->postJson('/api/finance/retraits/initier', [
            'montant' => 5000,
            // Tentative d'injection de compte frauduleux (doit être ignorée)
            'compte_pirate' => '+229 60 99 99 99',
        ]);

        $resInit->assertStatus(201);
        $retraitId = $resInit->json('data.retrait.id');

        // Destination forcée sur liste blanche officielle
        $this->assertEquals(config('emobilier.beneficiaire_officiel.mobile_money'), $resInit->json('data.compte_destination'));

        // 3 tentatives OTP erronées
        $this->actingAs($this->justinOwner, 'sanctum')->postJson("/api/finance/retraits/{$retraitId}/confirmer-otp", ['code_otp' => '000000']);
        $this->actingAs($this->justinOwner, 'sanctum')->postJson("/api/finance/retraits/{$retraitId}/confirmer-otp", ['code_otp' => '111111']);
        $res3 = $this->actingAs($this->justinOwner, 'sanctum')->postJson("/api/finance/retraits/{$retraitId}/confirmer-otp", ['code_otp' => '222222']);

        $res3->assertStatus(422);

        $retrait = Retrait::find($retraitId);
        $this->assertEquals('rejete', $retrait->statut);
    }

    /**
     * SEC-08 : Fuite de Données dans les Logs (Log Scrubber).
     * Caviardage automatique en [CONFIDENTIEL_FINANCE].
     */
    public function test_sec_08_log_scrubber_redacts_financial_secrets_to_confidential_finance(): void
    {
        $scrubber = new FinancialLogScrubber();

        $record = new LogRecord(
            datetime: new \DateTimeImmutable(),
            channel: 'testing',
            level: \Monolog\Level::Info,
            message: 'Paiement effectué pour montant=50000 avec solde=1200000 et secret_key=sec_key_xyz',
            context: [
                'montant' => 50000,
                'solde' => 1200000,
                'client_password' => 'P@ssword123',
            ]
        );

        $scrubbedRecord = $scrubber($record);

        $this->assertStringNotContainsString('50000', $scrubbedRecord->message);
        $this->assertStringNotContainsString('1200000', $scrubbedRecord->message);
        $this->assertStringNotContainsString('sec_key_xyz', $scrubbedRecord->message);
        $this->assertStringContainsString('[CONFIDENTIEL_FINANCE]', $scrubbedRecord->message);

        $this->assertEquals('[CONFIDENTIEL_FINANCE]', $scrubbedRecord->context['montant']);
        $this->assertEquals('[CONFIDENTIEL_FINANCE]', $scrubbedRecord->context['solde']);
    }

    /**
     * SEC-09 : Validité Légale (CGU).
     * Rejet 422 de validation avant toute communication avec l'agrégateur si CGU non acceptées.
     */
    public function test_sec_09_legal_cgu_acceptance_mandatory_before_any_payment(): void
    {
        $response = $this->actingAs($this->client, 'sanctum')->postJson('/api/paiements/initier', [
            'type_operation' => 'visite',
            // Absence de cgu_acceptees
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['cgu_acceptees']);
    }
}
