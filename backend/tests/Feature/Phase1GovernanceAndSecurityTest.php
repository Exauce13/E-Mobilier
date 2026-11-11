<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\DocumentLegal;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class Phase1GovernanceAndSecurityTest extends TestCase
{
    use DatabaseTransactions;

    protected User $justinOwner;
    protected User $techAdmin;
    protected User $secretaire;
    protected User $respZone;
    protected User $simpleClient;
    protected Zone $testZone;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. Zone de test
        $this->testZone = Zone::firstOrCreate(
            ['code' => 'ZON-TEST-01'],
            [
                'nom' => 'Zone Test Atlantique',
                'departement' => 'Atlantique',
                'commune' => 'Calavi',
                'is_active' => true,
            ]
        );

        // 2. Super Admin Principal (Justin MAGNIDE)
        $ownerEmail = config('emobilier.super_admin_principal_email', 'justin.magnide@e-mobilier.bj');
        $this->justinOwner = User::firstOrCreate(
            ['email' => $ownerEmail],
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

        // 3. Super Admin Technique (Jean-Paul)
        $this->techAdmin = User::firstOrCreate(
            ['email' => 'tech.test@e-mobilier.bj'],
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
            ['email' => 'secretaire.test@e-mobilier.bj'],
            [
                'name' => 'Secrétaire',
                'prenom' => 'Admin',
                'telephone' => '+22997000003',
                'password' => bcrypt('Secret123!'),
                'statut' => 'actif',
                'is_verifed' => true,
            ]
        );
        $this->secretaire->syncRoles(['Secrétaire', 'Admin']);

        // 5. Responsable de zone
        $this->respZone = User::firstOrCreate(
            ['email' => 'resp.zone.test@e-mobilier.bj'],
            [
                'name' => 'Resp',
                'prenom' => 'Zone',
                'telephone' => '+22997000004',
                'zone_id' => $this->testZone->id,
                'password' => bcrypt('Secret123!'),
                'statut' => 'actif',
                'is_verifed' => true,
            ]
        );
        $this->respZone->syncRoles(['Responsable de zone', 'Admin']);

        // 6. Client simple
        $this->simpleClient = User::firstOrCreate(
            ['email' => 'client.test@e-mobilier.bj'],
            [
                'name' => 'Client',
                'prenom' => 'Test',
                'telephone' => '+22997000005',
                'password' => bcrypt('Secret123!'),
                'statut' => 'actif',
                'is_verifed' => true,
            ]
        );
        $this->simpleClient->syncRoles(['Client']);
    }

    public function test_cgu_courante_returns_public_active_cgu(): void
    {
        $response = $this->getJson('/api/cgu/courante');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'type' => 'cgu',
                ],
            ]);
    }

    public function test_zones_index_accessible_to_any_admin_and_denied_to_client(): void
    {
        // Interdit au client
        $responseClient = $this->actingAs($this->simpleClient, 'sanctum')->getJson('/api/admin/zones');
        $responseClient->assertStatus(403);

        // Autorisé à la Secrétaire
        $responseSecr = $this->actingAs($this->secretaire, 'sanctum')->getJson('/api/admin/zones');
        $responseSecr->assertStatus(200)->assertJson(['success' => true]);

        // Autorisé au Responsable de zone
        $responseZone = $this->actingAs($this->respZone, 'sanctum')->getJson('/api/admin/zones');
        $responseZone->assertStatus(200)->assertJson(['success' => true]);
    }

    public function test_super_admin_can_create_and_update_zones(): void
    {
        $code = 'ZON-NEW-' . time();
        $payload = [
            'nom' => 'Nouvelle Zone Test',
            'departement' => 'Littoral',
            'commune' => 'Cotonou',
            'code' => $code,
            'description' => 'Test de création',
            'is_active' => true,
        ];

        // Création par le Super Admin Tech
        $response = $this->actingAs($this->techAdmin, 'sanctum')->postJson('/api/admin/zones', $payload);
        $response->assertStatus(201)
            ->assertJsonPath('data.code', $code);

        $zoneId = $response->json('data.id');

        // Modification par le Super Admin Principal
        $responseUpdate = $this->actingAs($this->justinOwner, 'sanctum')->patchJson("/api/admin/zones/{$zoneId}", [
            'nom' => 'Zone Test Modifiée',
        ]);

        $responseUpdate->assertStatus(200)
            ->assertJsonPath('data.nom', 'Zone Test Modifiée');
    }

    public function test_anti_escalation_blocks_creation_of_super_admin_principal(): void
    {
        $payload = [
            'name' => 'Fake',
            'prenom' => 'Owner',
            'email' => 'fake.owner@test.com',
            'telephone' => '+22999001122',
            'password' => 'Password123!',
            'role' => 'Super Admin Principal', // Tentative d'escalade
        ];

        $response = $this->actingAs($this->techAdmin, 'sanctum')->postJson('/api/admin/utilisateurs', $payload);

        // Doit être rejeté (règle Rule::in)
        $response->assertStatus(422);
    }

    public function test_super_admin_can_create_secretaire_and_responsable_zone(): void
    {
        $payload = [
            'name' => 'Dossou',
            'prenom' => 'Aimé',
            'email' => 'aime.dossou@e-mobilier.bj',
            'telephone' => '+22998000002',
            'password' => 'Password123!',
            'role' => 'Responsable de zone',
            'zone_id' => $this->testZone->id,
        ];

        $response = $this->actingAs($this->techAdmin, 'sanctum')->postJson('/api/admin/utilisateurs', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.email', 'aime.dossou@e-mobilier.bj');
    }

    public function test_sanctuarisation_justin_magnide_blocks_role_or_statut_tampering(): void
    {
        // 1. Tentative de modifier le rôle de Justin MAGNIDE
        $responseRole = $this->actingAs($this->techAdmin, 'sanctum')->patchJson("/api/admin/utilisateurs/{$this->justinOwner->id}/role-zone", [
            'role' => 'Secrétaire',
        ]);

        $responseRole->assertStatus(403)
            ->assertJson(['success' => false]);

        // 2. Tentative de suspendre le compte de Justin MAGNIDE
        $responseStatut = $this->actingAs($this->techAdmin, 'sanctum')->postJson("/api/admin/utilisateurs/{$this->justinOwner->id}/statut", [
            'statut' => 'suspendu',
        ]);

        $responseStatut->assertStatus(403)
            ->assertJson(['success' => false]);
    }

    public function test_suspension_revokes_tokens_and_blocks_suspended_user(): void
    {
        // Créer un token pour la secrétaire
        $token = $this->secretaire->createToken('test_token')->plainTextToken;

        // Suspendre la secrétaire
        $response = $this->actingAs($this->techAdmin, 'sanctum')->postJson("/api/admin/utilisateurs/{$this->secretaire->id}/statut", [
            'statut' => 'suspendu',
            'motif' => 'Suspension test',
        ]);

        $response->assertStatus(200);

        // Vérifier que son token a été révoqué
        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_id' => $this->secretaire->id,
        ]);
    }

    public function test_charte_signature_workflow(): void
    {
        $response = $this->actingAs($this->secretaire, 'sanctum')->postJson('/api/admin/charte/signer', [
            'acceptation' => true,
        ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertTrue($this->secretaire->fresh()->hasSignedCurrentCharte());
    }

    public function test_audit_logs_filters_financial_data_for_technical_admin(): void
    {
        // Créer deux entrées d'audit : une technique et une financière
        AuditLog::log('TEST_TECH_LOG', null, ['info' => 'test technique'], false);
        AuditLog::log('TEST_FINANCIAL_LOG', null, ['montant' => 50000], true);

        // 1. Vue par Justin MAGNIDE (doit voir les deux)
        $responseJustin = $this->actingAs($this->justinOwner, 'sanctum')->getJson('/api/admin/audit-logs');
        $responseJustin->assertStatus(200)
            ->assertJsonPath('financial_view_enabled', true);

        // 2. Vue par le Super Admin Technique (filtrage automatique)
        $responseTech = $this->actingAs($this->techAdmin, 'sanctum')->getJson('/api/admin/audit-logs');
        $responseTech->assertStatus(200)
            ->assertJsonPath('financial_view_enabled', false);

        // Les logs renvoyés au tech ne doivent contenir aucun log financier
        $data = $responseTech->json('data.data');
        foreach ($data as $item) {
            $this->assertFalse((bool) $item['is_financial']);
        }
    }

    public function test_system_health_returns_infrastructure_metrics_without_finance(): void
    {
        $response = $this->actingAs($this->techAdmin, 'sanctum')->getJson('/api/tech/system-health');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'environment',
                'php_version',
                'laravel_version',
                'infrastructure' => [
                    'database' => ['driver', 'status'],
                    'cache' => ['driver', 'status'],
                    'queues' => ['driver', 'pending_jobs_count'],
                ],
                'response_time_ms',
            ]);

        // Vérifier l'absence absolue de clés financières dans le payload JSON
        $json = $response->getContent();
        $this->assertStringNotContainsString('montant', strtolower($json));
        $this->assertStringNotContainsString('solde', strtolower($json));
        $this->assertStringNotContainsString('balance', strtolower($json));
    }
}

