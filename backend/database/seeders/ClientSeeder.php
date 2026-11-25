<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class ClientSeeder extends Seeder
{
    /**
     * Initialise les comptes Clients (incluant le compte test@example.com existant).
     */
    public function run(): void
    {
        // 1. Compte existant test@example.com
        $testUser = User::where('email', 'test@example.com')->first();
        if (! $testUser) {
            $testUser = User::firstOrCreate(
                ['email' => 'test@example.com'],
                [
                    'name' => 'Test User',
                    'prenom' => 'Utilisateur',
                    'telephone' => '0197497661',
                    'password' => Hash::make('password'),
                    'is_verifed' => true,
                    'statut' => 'actif',
                ]
            );
        }
        $testUser->syncRoles(['Client']);

        // 2. Compte Client standard E-Mobilier
        $client = User::firstOrCreate(
            ['email' => 'client@e-mobilier.bj'],
            [
                'name' => 'MENSAH',
                'prenom' => 'Koffi',
                'telephone' => '+2290197000008',
                'password' => Hash::make('Client@2026!'),
                'is_verifed' => true,
                'statut' => 'actif',
            ]
        );
        $client->syncRoles(['Client']);
    }
}
