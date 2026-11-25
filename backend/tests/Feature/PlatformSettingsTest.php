<?php

namespace Tests\Feature;

use App\Models\PlatformSetting;
use App\Models\User;
use App\Services\PlatformSettingsService;
use Database\Seeders\PlatformSettingSeeder;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PlatformSettingsTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'Super Admin Principal']);
        Role::firstOrCreate(['name' => 'Super Admin Technique']);
        Role::firstOrCreate(['name' => 'Client']);
        Role::firstOrCreate(['name' => 'Agent mobilier']);

        $this->seed(PlatformSettingSeeder::class);
        app(PlatformSettingsService::class)->clearCache();
    }

    protected function getOrCreateFinancialOwner(): User
    {
        $email = config('emobilier.super_admin_principal_email', 'justin.magnide@e-mobilier.bj');
        $user = User::where('email', $email)->first();
        if (! $user) {
            $user = User::create([
                'name' => 'MAGNIDE',
                'prenom' => 'Justin',
                'telephone' => '+2290197999901',
                'email' => $email,
                'password' => Hash::make('StrongPass123!'),
                'statut' => 'actif',
                'is_verifed' => true,
            ]);
        }
        $user->assignRole('Super Admin Principal');

        return $user;
    }

    public function test_public_config_endpoint_returns_database_tarifs_and_contact(): void
    {
        $response = $this->getJson('/api/public/config');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'currency' => 'FCFA',
                    'tarifs' => [
                        'deblocage_coordonnees' => 50,
                        'visite' => 500,
                        'post_client' => 500,
                        'post_agent' => 100,
                    ],
                ],
            ])
            ->assertJsonStructure([
                'data' => [
                    'platform_name',
                    'platform_legal_name',
                    'currency',
                    'tarifs' => ['deblocage_coordonnees', 'visite', 'post_client', 'post_agent'],
                    'contact' => ['phone', 'email', 'office_address'],
                ],
            ]);
    }

    public function test_secondary_super_admin_cannot_view_finance_group_or_edit_tarifs(): void
    {
        $secondary = User::create([
            'name' => 'Second',
            'prenom' => 'Principal',
            'telephone' => '+2290197999902',
            'email' => 'second.principal.test@e-mobilier.bj',
            'password' => Hash::make('StrongPass123!'),
            'statut' => 'actif',
            'is_verifed' => true,
        ]);
        $secondary->assignRole('Super Admin Principal');

        // Lecture : le groupe finance doit être strictement masqué
        $indexRes = $this->actingAs($secondary, 'sanctum')->getJson('/api/admin/settings');
        $indexRes->assertStatus(200)
            ->assertJsonPath('data.can_edit_financial', false);

        $groupes = collect($indexRes->json('data.items'))->pluck('groupe')->unique()->values()->all();
        $this->assertNotContains('finance', $groupes);

        // Tentative de modification d'un tarif -> 403 FINANCIAL_VAULT_FORBIDDEN
        $updateTarifRes = $this->actingAs($secondary, 'sanctum')->patchJson('/api/admin/settings', [
            'settings' => [
                ['cle' => 'tarif_visite', 'valeur' => 750],
            ],
        ]);
        $updateTarifRes->assertStatus(403)
            ->assertJsonPath('code', 'FINANCIAL_VAULT_FORBIDDEN');

        // Mais un paramètre non financier (contact) peut être modifié par un Super Admin
        $updateContactRes = $this->actingAs($secondary, 'sanctum')->patchJson('/api/admin/settings', [
            'settings' => [
                ['cle' => 'office_address', 'valeur' => 'Ganhi, Cotonou'],
            ],
        ]);
        $updateContactRes->assertStatus(200);
        $this->assertEquals('Ganhi, Cotonou', PlatformSetting::where('cle', 'office_address')->value('valeur'));
    }

    public function test_financial_owner_can_update_tarifs_and_changes_propagate_to_payments(): void
    {
        $justin = $this->getOrCreateFinancialOwner();

        $indexRes = $this->actingAs($justin, 'sanctum')->getJson('/api/admin/settings');
        $indexRes->assertStatus(200)
            ->assertJsonPath('data.can_edit_financial', true);
        $groupes = collect($indexRes->json('data.items'))->pluck('groupe')->unique()->values()->all();
        $this->assertContains('finance', $groupes);

        // Mise à jour dynamique des tarifs
        $updateRes = $this->actingAs($justin, 'sanctum')->patchJson('/api/admin/settings', [
            'settings' => [
                ['cle' => 'tarif_deblocage_coordonnees', 'valeur' => 75],
                ['cle' => 'tarif_visite', 'valeur' => 600],
                ['cle' => 'tarif_post_agent', 'valeur' => 150],
            ],
        ]);
        $updateRes->assertStatus(200)
            ->assertJsonPath('data.public_config.tarifs.deblocage_coordonnees', 75)
            ->assertJsonPath('data.public_config.tarifs.visite', 600)
            ->assertJsonPath('data.public_config.tarifs.post_agent', 150);

        // Vérifier propagation sur /api/public/config
        $this->getJson('/api/public/config')
            ->assertStatus(200)
            ->assertJsonPath('data.tarifs.visite', 600)
            ->assertJsonPath('data.tarifs.deblocage_coordonnees', 75);

        // Vérifier propagation sur /api/paiements/initier (Server-Side Price Authority)
        $client = User::create([
            'name' => 'Client',
            'prenom' => 'TarifTest',
            'telephone' => '+2290197999903',
            'email' => 'client.tarif.test@e-mobilier.bj',
            'password' => Hash::make('StrongPass123!'),
            'statut' => 'actif',
            'is_verifed' => true,
        ]);
        $client->assignRole('Client');

        $payInitRes = $this->actingAs($client, 'sanctum')->postJson('/api/paiements/initier', [
            'type_operation' => 'visite',
            'cgu_acceptees' => true,
        ]);
        $payInitRes->assertStatus(201)
            ->assertJsonPath('data.montant_officiel', 600);
    }

    public function test_non_admin_user_cannot_access_admin_settings(): void
    {
        $client = User::create([
            'name' => 'Client',
            'prenom' => 'NoAdmin',
            'telephone' => '+2290197999904',
            'email' => 'client.noadmin@e-mobilier.bj',
            'password' => Hash::make('StrongPass123!'),
            'statut' => 'actif',
            'is_verifed' => true,
        ]);
        $client->assignRole('Client');

        $this->actingAs($client, 'sanctum')->getJson('/api/admin/settings')->assertStatus(403);
        $this->actingAs($client, 'sanctum')->patchJson('/api/admin/settings', [
            'settings' => [['cle' => 'support_phone', 'valeur' => '+2290100000000']],
        ])->assertStatus(403);
    }
}
