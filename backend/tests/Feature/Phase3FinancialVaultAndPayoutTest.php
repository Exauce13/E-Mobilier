<?php

namespace Tests\Feature;

use App\Models\GrandLivre;
use App\Models\Paiement;
use App\Models\Retrait;
use App\Models\User;
use App\Services\FinancialLedgerService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class Phase3FinancialVaultAndPayoutTest extends TestCase
{
    use DatabaseTransactions;

    protected User $justinOwner;
    protected User $techAdmin;
    protected User $client;
    protected FinancialLedgerService $ledgerService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ledgerService = app(FinancialLedgerService::class);

        // 1. Super Admin Principal (Justin MAGNIDE)
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

        // 2. Super Admin Technique (Jean-Paul GNIKPO)
        $this->techAdmin = User::firstOrCreate(
            ['email' => 'tech.p3@e-mobilier.bj'],
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

        // 3. Client
        $this->client = User::firstOrCreate(
            ['email' => 'client.p3@gmail.com'],
            [
                'name' => 'Client',
                'prenom' => 'P3',
                'telephone' => '+22997000005',
                'password' => bcrypt('Secret123!'),
                'statut' => 'actif',
                'is_verifed' => true,
            ]
        );
        $this->client->syncRoles(['Client']);
    }

    public function test_client_can_initiate_payment_with_server_side_pricing_authority(): void
    {
        $response = $this->actingAs($this->client, 'sanctum')->postJson('/api/paiements/initier', [
            'type_operation' => 'visite',
            'cgu_acceptees' => true,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'montant_officiel' => 500, // Fixé par le serveur
                    'devise' => 'XOF',
                    'type_operation' => 'visite',
                ],
            ]);
    }

    public function test_payment_initiation_fails_if_cgu_not_accepted(): void
    {
        $response = $this->actingAs($this->client, 'sanctum')->postJson('/api/paiements/initier', [
            'type_operation' => 'visite',
            // Absence de cgu_acceptees
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['cgu_acceptees']);
    }

    public function test_webhook_reconciliation_credits_grand_livre_idempotently(): void
    {
        $txId = 'PAY-TEST-' . time();

        $soldeInitial = $this->ledgerService->getSoldeDisponible();

        // 1. Premier appel webhook
        $response1 = $this->postJson('/api/kkiapay/webhook', [
            'transactionId' => $txId,
            'amount' => 500,
            'event' => 'payment_success',
        ]);

        $response1->assertStatus(200)
            ->assertJson(['success' => true]);

        $soldeApresPremier = $this->ledgerService->getSoldeDisponible();
        $this->assertGreaterThan($soldeInitial, $soldeApresPremier);

        // 2. Deuxième appel webhook (Doublon / Rejeu)
        $response2 = $this->postJson('/api/kkiapay/webhook', [
            'transactionId' => $txId,
            'amount' => 500,
            'event' => 'payment_success',
        ]);

        $response2->assertStatus(200)
            ->assertJson(['message' => 'Paiement déjà validé et réconcilié (Doublon ignoré).']);

        // Vérification stricte d'idempotence : Le solde ne doit PAS avoir augmenté deux fois !
        $soldeApresDoublon = $this->ledgerService->getSoldeDisponible();
        $this->assertEquals($soldeApresPremier, $soldeApresDoublon);
    }

    public function test_financial_vault_is_strictly_forbidden_to_super_admin_technique(): void
    {
        // Le Super Admin Technique tente d'accéder au tableau de bord financier
        $responseDashboard = $this->actingAs($this->techAdmin, 'sanctum')->getJson('/api/finance/tableau-de-bord');
        $responseDashboard->assertStatus(403)
            ->assertJsonPath('code', 'FINANCIAL_VAULT_FORBIDDEN');

        // Il tente d'accéder aux écritures comptables
        $responseTransactions = $this->actingAs($this->techAdmin, 'sanctum')->getJson('/api/finance/transactions');
        $responseTransactions->assertStatus(403);

        // Il tente d'initier un retrait
        $responseRetrait = $this->actingAs($this->techAdmin, 'sanctum')->postJson('/api/finance/retraits/initier', [
            'montant' => 5000,
        ]);
        $responseRetrait->assertStatus(403);
    }

    public function test_financial_vault_accessible_exclusively_to_justin(): void
    {
        $response = $this->actingAs($this->justinOwner, 'sanctum')->getJson('/api/finance/tableau-de-bord');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'tresorerie' => ['solde_disponible', 'solde_en_cours_retrait', 'devise'],
                    'flux_globaux' => ['total_chiffre_affaires_brut', 'total_commissions_prelevees', 'total_net_encaisse'],
                    'compte_beneficiaire_officiel',
                ],
            ]);
    }

    public function test_payout_workflow_with_hardcoded_whitelist_and_otp_validation(): void
    {
        // 1. Créditer le Grand Livre de 10 000 FCFA pour tester le retrait
        $this->ledgerService->credit(
            10000.0,
            150.0,
            'encaissement_visite',
            'Crédit de test pour scénario de retrait',
            null,
            'TX-INIT-RETRAIT',
            $this->client->id
        );

        $soldeAvant = $this->ledgerService->getSoldeDisponible();
        $montantRetrait = 5000.0;

        // 2. Justin initie la demande de retrait
        $responseInit = $this->actingAs($this->justinOwner, 'sanctum')->postJson('/api/finance/retraits/initier', [
            'montant' => $montantRetrait,
            'type_compte' => 'mobile_money',
        ]);

        $responseInit->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'compte_destination' => config('emobilier.beneficiaire_officiel.mobile_money'),
                ],
            ]);

        $retraitId = $responseInit->json('data.retrait.id');
        $codeOtp = $responseInit->json('data.test_otp_code'); // Présent en test

        // 3. Justin confirme le retrait avec l'OTP
        $responseConfirm = $this->actingAs($this->justinOwner, 'sanctum')->postJson("/api/finance/retraits/{$retraitId}/confirmer-otp", [
            'code_otp' => $codeOtp,
        ]);

        $responseConfirm->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'retrait' => [
                        'statut' => 'execute',
                    ],
                ],
            ]);

        // 4. Vérifier la diminution exacte du solde
        $soldeApres = $this->ledgerService->getSoldeDisponible();
        $this->assertEquals($soldeAvant - $montantRetrait, $soldeApres);
    }

    public function test_payout_blocks_after_three_invalid_otp_attempts(): void
    {
        // Créditer le compte
        $this->ledgerService->credit(5000.0, 75.0, 'encaissement_visite', 'Crédit test anti-brute-force');

        // Initier le retrait
        $responseInit = $this->actingAs($this->justinOwner, 'sanctum')->postJson('/api/finance/retraits/initier', [
            'montant' => 2000.0,
        ]);
        $retraitId = $responseInit->json('data.retrait.id');

        // 1ère tentative erronée
        $this->actingAs($this->justinOwner, 'sanctum')->postJson("/api/finance/retraits/{$retraitId}/confirmer-otp", ['code_otp' => '000000']);
        // 2ème tentative erronée
        $this->actingAs($this->justinOwner, 'sanctum')->postJson("/api/finance/retraits/{$retraitId}/confirmer-otp", ['code_otp' => '111111']);
        // 3ème tentative erronée -> Blocage
        $res3 = $this->actingAs($this->justinOwner, 'sanctum')->postJson("/api/finance/retraits/{$retraitId}/confirmer-otp", ['code_otp' => '222222']);

        $res3->assertStatus(422);

        $retrait = Retrait::find($retraitId);
        $this->assertEquals('rejete', $retrait->statut);
    }

    public function test_tech_admin_can_view_webhook_health_without_any_financial_data(): void
    {
        $response = $this->actingAs($this->techAdmin, 'sanctum')->getJson('/api/tech/webhooks/health');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'passerelle_active',
                'statistiques_techniques' => [
                    'total_reçus',
                    'signatures_valides',
                    'reconciliations_reussies',
                ],
                'derniers_evenements',
            ]);

        $json = $response->getContent();
        // Vérifier l'exclusion des données financières
        $this->assertStringNotContainsString('montant_net', strtolower($json));
        $this->assertStringNotContainsString('solde', strtolower($json));
    }
}

