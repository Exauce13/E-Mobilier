<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class InscriptionControllerTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'Client']);
        Role::firstOrCreate(['name' => 'Propritaires']);
        Role::firstOrCreate(['name' => 'Agent mobilier']);
        Role::firstOrCreate(['name' => 'Admin']);
    }

    public function test_user_can_register_with_frontend_payload(): void
    {
        $payload = [
            'fullName' => 'Koffi Mensah',
            'phone' => '97001122',
            'email' => 'koffi.mensah@gmail.com',
            'password' => 'secret123',
            'role' => 'client_proprietaire',
            'acceptedTerms' => true,
        ];

        $response = $this->postJson('/api/inscription', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Compte créé avec succès!Bienvenue dans la communauté E-Mobilier.',
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'user' => [
                        'id',
                        'name',
                        'prenom',
                        'fullName',
                        'phone',
                        'email',
                        'role',
                        'balanceFifa',
                    ],
                    'token',
                    'token_type',
                ],
            ]);

        $this->assertDatabaseHas('users', [
            'email' => 'koffi.mensah@gmail.com',
            'telephone' => '+22997001122',
        ]);
    }

    public function test_registration_validation_fails_for_invalid_input(): void
    {
        $response = $this->postJson('/api/inscription', [
            'fullName' => '',
            'phone' => '',
            'password' => '123', // less than 6 chars
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'errors',
            ]);
    }

    public function test_user_can_authenticate_with_phone_and_password(): void
    {
        // First register a user
        $this->postJson('/api/inscription', [
            'fullName' => 'Amina Bio',
            'phone' => '+22996112233',
            'email' => 'amina@gmail.com',
            'password' => 'password123',
            'role' => 'agent_immobilier',
        ])->assertStatus(201);

        // Login using phone format without prefix
        $loginResponse = $this->postJson('/api/authentification', [
            'phone' => '96112233',
            'password' => 'password123',
        ]);

        $loginResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Connexion réussie ! Bienvenue sur E-Mobilier.',
                'data' => [
                    'user' => [
                        'role' => 'agent_immobilier',
                    ],
                ],
            ])
            ->assertJsonStructure([
                'data' => [
                    'token',
                    'user',
                ],
            ]);
    }

    public function test_authentication_fails_with_wrong_password(): void
    {
        $this->postJson('/api/inscription', [
            'fullName' => 'Amina Bio',
            'phone' => '96112233',
            'password' => 'password123',
        ])->assertStatus(201);

        $response = $this->postJson('/api/authentification', [
            'phone' => '96112233',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'Numéro de téléphone ou mot de passe incorrect.',
            ]);
    }

    public function test_authenticated_user_can_access_profile_and_logout(): void
    {
        $registerRes = $this->postJson('/api/inscription', [
            'fullName' => 'Test User',
            'phone' => '95000001',
            'password' => 'password123',
        ]);

        $token = $registerRes->json('data.token');

        // Access profile
        $profileRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/profil');

        $profileRes->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        // Logout
        $logoutRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/deconnexion');

        $logoutRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Déconnexion réussie.',
            ]);
    }
}
