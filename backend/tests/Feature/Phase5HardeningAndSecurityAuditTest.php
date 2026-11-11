<?php

namespace Tests\Feature;

use App\Models\DemandeDemasquage;
use App\Models\GrandLivre;
use App\Models\User;
use App\Services\FinancialLedgerService;
use App\Services\SecurityAuditHardeningService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class Phase5HardeningAndSecurityAuditTest extends TestCase
{
    use DatabaseTransactions;

    protected User $justinOwner;
    protected User $techAdmin;
    protected FinancialLedgerService $ledgerService;
    protected SecurityAuditHardeningService $securityService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ledgerService = app(FinancialLedgerService::class);
        $this->securityService = app(SecurityAuditHardeningService::class);

        // Débloquer tout gel résiduel éventuel
        $this->securityService->degelerRetraits();

        // 1. Justin MAGNIDE (Super Admin Principal & Owner)
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

        // 2. Jean-Paul GNIKPO (Super Admin Technique)
        $this->techAdmin = User::firstOrCreate(
            ['email' => 'tech.p5@e-mobilier.bj'],
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
    }

    public function test_grand_livre_cryptographic_integrity_verification_certifies_unaltered_chain(): void
    {
        // 1. Ajouter deux écritures authentiques
        $this->ledgerService->credit(500, 7.5, 'encaissement_visite', 'Écriture 1 test scellement');
        $this->ledgerService->credit(500, 7.5, 'encaissement_visite', 'Écriture 2 test scellement');

        // 2. Justin vérifie l'intégrité de la chaîne
        $response = $this->actingAs($this->justinOwner, 'sanctum')->postJson('/api/finance/securite/verifier-integrite');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'chaine_intacte' => true,
                    'anomalies' => [],
                ],
            ]);
    }

    public function test_direct_sql_tampering_breaks_cryptographic_chain_and_is_detected(): void
    {
        // 1. Ajouter une écriture
        $ecriture = $this->ledgerService->credit(1000, 15, 'encaissement_visite', 'Écriture cible altération');

        // 2. Simulation d'une altération manuelle directe en base (Falsification malveillante de montant)
        DB::table('grand_livre')->where('id', $ecriture->id)->update([
            'montant_net' => 99999.00, // Altéré sans recalculer le hash HMAC !
        ]);

        // 3. Justin lance la vérification cryptographique
        $response = $this->actingAs($this->justinOwner, 'sanctum')->postJson('/api/finance/securite/verifier-integrite');

        // Doit retourner 409 Conflict et lister l'anomalie
        $response->assertStatus(409)
            ->assertJson([
                'success' => true,
                'data' => [
                    'chaine_intacte' => false,
                ],
            ]);

        $this->assertNotEmpty($response->json('data.anomalies'));
    }

    public function test_kill_switch_freezes_and_unfreezes_payouts(): void
    {
        // 1. Activer le Kill-Switch des retraits
        $resFreeze = $this->actingAs($this->justinOwner, 'sanctum')->postJson('/api/finance/securite/geler-retraits', [
            'motif' => 'Suspicion de compromission de compte bancaire',
        ]);

        $resFreeze->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertTrue($this->securityService->isRetraitsGeles());

        // 2. Tenter d'initier un retrait pendant le gel -> Rejet immédiat
        $this->ledgerService->credit(5000, 75, 'encaissement_visite', 'Crédit pour test gel');

        $resRetrait = $this->actingAs($this->justinOwner, 'sanctum')->postJson('/api/finance/retraits/initier', [
            'montant' => 2000,
        ]);

        $resRetrait->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);
        $this->assertStringContainsString('Kill-Switch', $resRetrait->json('message'));

        // 3. Dégeler les retraits
        $resUnfreeze = $this->actingAs($this->justinOwner, 'sanctum')->postJson('/api/finance/securite/degeler-retraits');
        $resUnfreeze->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertFalse($this->securityService->isRetraitsGeles());
    }

    public function test_emergency_kill_switch_revokes_all_active_unmaskings_immediately(): void
    {
        // 1. Créer une demande de démasquage active (TTL valide 2h)
        $demande = DemandeDemasquage::create([
            'user_id' => $this->techAdmin->id,
            'type_dossier' => 'visite',
            'dossier_id' => 1,
            'motif' => 'contact_urgent',
            'justification' => 'Vérification logistique d\'urgence',
            'statut' => 'approuve',
            'approved_by' => $this->justinOwner->id,
            'approved_at' => now(),
            'duree_minutes' => 120,
            'expires_at' => now()->addMinutes(120),
        ]);

        $this->assertTrue($demande->isActif());

        // 2. Le Super Admin déclenche la révocation massive d'urgence
        $response = $this->actingAs($this->techAdmin, 'sanctum')->postJson('/api/admin/securite/revoquer-tous-demasquages', [
            'motif' => 'Alerte fuite de données préventive',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $demande->refresh();
        $this->assertEquals('revoque', $demande->statut);
        $this->assertFalse($demande->isActif());
    }

    public function test_super_admin_technique_cannot_access_financial_security_endpoints(): void
    {
        // Le Tech Admin tente de vérifier le scellement financier
        $resVerif = $this->actingAs($this->techAdmin, 'sanctum')->postJson('/api/finance/securite/verifier-integrite');
        $resVerif->assertStatus(403);

        // Le Tech Admin tente de geler les retraits
        $resGel = $this->actingAs($this->techAdmin, 'sanctum')->postJson('/api/finance/securite/geler-retraits', [
            'motif' => 'Intrusion non autorisée',
        ]);
        $resGel->assertStatus(403);
    }
}
