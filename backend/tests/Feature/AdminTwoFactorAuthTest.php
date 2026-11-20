<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AdminTwoFactorAuthTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'Client']);
        Role::firstOrCreate(['name' => 'Agent mobilier']);
        Role::firstOrCreate(['name' => 'Admin']);
        Role::firstOrCreate(['name' => 'Super Admin Principal']);
        Role::firstOrCreate(['name' => 'Super Admin Technique']);
        Role::firstOrCreate(['name' => 'Secrétaire']);
        Role::firstOrCreate(['name' => 'Responsable de zone']);
    }

    /**
     * Un utilisateur standard (Client ou Agent) se connecte directement sans 2FA.
     */
    public function test_standard_client_logs_in_directly_without_2fa(): void
    {
        $client = User::create([
            'name' => 'Client',
            'prenom' => 'Standard',
            'telephone' => '+2290196990011',
            'email' => 'client.test@e-mobilier.bj',
            'password' => Hash::make('SecretPass123!'),
            'statut' => 'actif',
            'is_verifed' => true,
        ]);
        $client->assignRole('Client');

        $response = $this->postJson('/api/authentification', [
            'phone' => '0196990011',
            'password' => 'SecretPass123!',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Connexion réussie ! Bienvenue sur E-Mobilier.',
            ])
            ->assertJsonStructure([
                'data' => [
                    'token',
                    'token_type',
                    'user' => ['id', 'role'],
                ],
            ]);

        $this->assertNull($response->json('data.requires_two_factor'));
        $this->assertNotEmpty($response->json('data.token'));
    }

    /**
     * Tous les rôles administrateurs déclenchent obligatoirement la double authentification par OTP.
     */
    public function test_admin_roles_trigger_two_factor_authentication(): void
    {
        $adminRoles = [
            'Super Admin Principal',
            'Super Admin Technique',
            'Secrétaire',
            'Responsable de zone',
            'Admin',
        ];

        foreach ($adminRoles as $index => $roleName) {
            $phone = '+22901970001' . str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT);
            $email = "admin_{$index}@e-mobilier.bj";

            $admin = User::create([
                'name' => 'AdminTest',
                'prenom' => $roleName,
                'telephone' => $phone,
                'email' => $email,
                'password' => Hash::make('AdminPass2026!'),
                'statut' => 'actif',
                'is_verifed' => true,
            ]);
            $admin->assignRole($roleName);

            $response = $this->postJson('/api/authentification', [
                'telephone' => $phone,
                'password' => 'AdminPass2026!',
            ]);

            $response->assertStatus(200)
                ->assertJson([
                    'success' => true,
                    'requires_two_factor' => true,
                    'message' => 'Double authentification requise. Un code de sécurité OTP a été envoyé.',
                ])
                ->assertJsonStructure([
                    'success',
                    'requires_two_factor',
                    'message',
                    'data' => [
                        'requires_two_factor',
                        'two_factor_token',
                        'role',
                        'destination_masquee',
                        'expires_in',
                    ],
                ]);

            // Aucun token Sanctum ne doit être émis à cette étape
            $this->assertNull($response->json('data.token'));

            // Le token de session 2FA et le hash OTP doivent être enregistrés en base
            $admin->refresh();
            $this->assertNotNull($admin->two_factor_token);
            $this->assertNotNull($admin->two_factor_otp_hash);
            $this->assertNotNull($admin->two_factor_otp_expires_at);
            $this->assertEquals(0, $admin->two_factor_otp_tentatives);
        }
    }

    /**
     * Un administrateur valide son code OTP et reçoit son token d'accès Sanctum.
     */
    public function test_admin_can_verify_otp_and_authenticate(): void
    {
        $admin = User::create([
            'name' => 'Magnide',
            'prenom' => 'Justin',
            'telephone' => '+2290197880099',
            'email' => 'justin.test2fa@e-mobilier.bj',
            'password' => Hash::make('JustinPass2026!'),
            'statut' => 'actif',
            'is_verifed' => true,
        ]);
        $admin->assignRole('Super Admin Principal');

        // Étape 1 : Connexion initiale
        $loginRes = $this->postJson('/api/authentification', [
            'telephone' => '0197880099',
            'password' => 'JustinPass2026!',
        ]);

        $loginRes->assertStatus(200);
        $twoFactorToken = $loginRes->json('data.two_factor_token');
        $codeOtp = $loginRes->json('data.test_otp_code');

        $this->assertNotNull($twoFactorToken);
        $this->assertNotNull($codeOtp);

        // Étape 2 : Validation du code OTP
        $verifyRes = $this->postJson('/api/authentification/verifier-otp', [
            'two_factor_token' => $twoFactorToken,
            'code_otp' => $codeOtp,
        ]);

        $verifyRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Double authentification réussie ! Bienvenue sur E-Mobilier.',
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'token',
                    'token_type',
                    'user' => ['id', 'email', 'roles'],
                ],
            ]);

        $token = $verifyRes->json('data.token');
        $this->assertNotEmpty($token);

        // Les colonnes 2FA doivent avoir été purgées
        $admin->refresh();
        $this->assertNull($admin->two_factor_token);
        $this->assertNull($admin->two_factor_otp_hash);
        $this->assertNull($admin->two_factor_otp_expires_at);

        // Le token émis permet d'accéder au profil protégé
        $profileRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/profil');

        $profileRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'user' => [
                        'email' => 'justin.test2fa@e-mobilier.bj',
                    ],
                ],
            ]);
    }

    /**
     * Échec en cas de code OTP erroné avec décompte des tentatives restantes.
     */
    public function test_admin_2fa_fails_with_invalid_otp(): void
    {
        $admin = User::create([
            'name' => 'Secrétaire',
            'prenom' => 'Test',
            'telephone' => '+2290197334455',
            'email' => 'secretaire.test@e-mobilier.bj',
            'password' => Hash::make('SecPass2026!'),
            'statut' => 'actif',
            'is_verifed' => true,
        ]);
        $admin->assignRole('Secrétaire');

        $loginRes = $this->postJson('/api/authentification', [
            'telephone' => '0197334455',
            'password' => 'SecPass2026!',
        ]);

        $twoFactorToken = $loginRes->json('data.two_factor_token');

        $verifyRes = $this->postJson('/api/authentification/verifier-otp', [
            'two_factor_token' => $twoFactorToken,
            'code_otp' => '000000',
        ]);

        $verifyRes->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);

        $this->assertStringContainsString('Code OTP invalide', $verifyRes->json('message'));
        $this->assertEquals(2, $verifyRes->json('data.tentatives_restantes'));

        $admin->refresh();
        $this->assertEquals(1, $admin->two_factor_otp_tentatives);
    }

    /**
     * Verrouillage anti-brute-force après 3 tentatives OTP consécutives erronées.
     */
    public function test_admin_2fa_locks_out_after_max_attempts(): void
    {
        $admin = User::create([
            'name' => 'Zone',
            'prenom' => 'Responsable',
            'telephone' => '+2290197445566',
            'email' => 'resp.zone@e-mobilier.bj',
            'password' => Hash::make('RespPass2026!'),
            'statut' => 'actif',
            'is_verifed' => true,
        ]);
        $admin->assignRole('Responsable de zone');

        $loginRes = $this->postJson('/api/authentification', [
            'telephone' => '0197445566',
            'password' => 'RespPass2026!',
        ]);

        $twoFactorToken = $loginRes->json('data.two_factor_token');

        // Tentative 1
        $this->postJson('/api/authentification/verifier-otp', [
            'two_factor_token' => $twoFactorToken,
            'code_otp' => '111111',
        ])->assertStatus(422);

        // Tentative 2
        $this->postJson('/api/authentification/verifier-otp', [
            'two_factor_token' => $twoFactorToken,
            'code_otp' => '222222',
        ])->assertStatus(422);

        // Tentative 3 : Verrouillage immédiat
        $res3 = $this->postJson('/api/authentification/verifier-otp', [
            'two_factor_token' => $twoFactorToken,
            'code_otp' => '333333',
        ]);

        $res3->assertStatus(429);
        $this->assertStringContainsString('bloqué', $res3->json('message'));

        // La session 2FA a été révoquée
        $admin->refresh();
        $this->assertNull($admin->two_factor_token);
        $this->assertNull($admin->two_factor_otp_hash);

        // Une alerte de sécurité a été consignée
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'SECURITY_ALERT:BRUTE_FORCE_2FA_OTP',
        ]);
    }

    /**
     * Échec si le code OTP a expiré (TTL dépassé).
     */
    public function test_admin_2fa_fails_when_otp_expired(): void
    {
        $admin = User::create([
            'name' => 'AdminTech',
            'prenom' => 'Expired',
            'telephone' => '+2290197556677',
            'email' => 'admin.expired@e-mobilier.bj',
            'password' => Hash::make('PassExpired!'),
            'statut' => 'actif',
            'is_verifed' => true,
        ]);
        $admin->assignRole('Super Admin Technique');

        $loginRes = $this->postJson('/api/authentification', [
            'telephone' => '0197556677',
            'password' => 'PassExpired!',
        ]);

        $twoFactorToken = $loginRes->json('data.two_factor_token');
        $codeOtp = $loginRes->json('data.test_otp_code');

        // Simuler l'expiration temporelle
        $admin->refresh();
        $admin->update(['two_factor_otp_expires_at' => now()->subMinutes(10)]);

        $verifyRes = $this->postJson('/api/authentification/verifier-otp', [
            'two_factor_token' => $twoFactorToken,
            'code_otp' => $codeOtp,
        ]);

        $verifyRes->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);

        $this->assertStringContainsString('expiré', $verifyRes->json('message'));
    }

    /**
     * Un administrateur peut demander le renvoi d'un nouveau code OTP.
     */
    public function test_admin_can_resend_otp(): void
    {
        $admin = User::create([
            'name' => 'AdminLegacy',
            'prenom' => 'Resend',
            'telephone' => '+2290197667788',
            'email' => 'admin.resend@e-mobilier.bj',
            'password' => Hash::make('PassResend!'),
            'statut' => 'actif',
            'is_verifed' => true,
        ]);
        $admin->assignRole('Admin');

        $loginRes = $this->postJson('/api/authentification', [
            'telephone' => '0197667788',
            'password' => 'PassResend!',
        ]);

        $twoFactorToken = $loginRes->json('data.two_factor_token');
        $initialOtp = $loginRes->json('data.test_otp_code');

        // Demande de renvoi
        $resendRes = $this->postJson('/api/authentification/renvoyer-otp', [
            'two_factor_token' => $twoFactorToken,
        ]);

        $resendRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Un nouveau code OTP a été expédié avec succès.',
            ]);

        $newOtp = $resendRes->json('data.test_otp_code');
        $this->assertNotEmpty($newOtp);

        // Validation avec le nouveau code
        $verifyRes = $this->postJson('/api/authentification/verifier-otp', [
            'two_factor_token' => $twoFactorToken,
            'code_otp' => $newOtp,
        ]);

        $verifyRes->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertNotEmpty($verifyRes->json('data.token'));
    }

    /**
     * Un administrateur suspendu ne peut pas déclencher d'authentification.
     */
    public function test_suspended_admin_cannot_authenticate(): void
    {
        $admin = User::create([
            'name' => 'Suspended',
            'prenom' => 'Admin',
            'telephone' => '+2290197778899',
            'email' => 'suspended.admin@e-mobilier.bj',
            'password' => Hash::make('SuspendedPass!'),
            'statut' => 'suspendu',
            'is_verifed' => true,
        ]);
        $admin->assignRole('Super Admin Technique');

        $loginRes = $this->postJson('/api/authentification', [
            'telephone' => '0197778899',
            'password' => 'SuspendedPass!',
        ]);

        $loginRes->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Ce compte a été suspendu par l\'administration.',
            ]);
    }
}
