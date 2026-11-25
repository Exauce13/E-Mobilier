<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SecretaireSeeder extends Seeder
{
    /**
     * Initialise le compte Secrétaire.
     */
    public function run(): void
    {
        $secretaire = User::firstOrCreate(
            ['email' => 'secretaire@e-mobilier.bj'],
            [
                'name' => 'DOSSOU',
                'prenom' => 'Nadège',
                'telephone' => '+2290197000004',
                'password' => Hash::make('Secretaire@2026!'),
                'is_verifed' => true,
                'statut' => 'actif',
            ]
        );

        $secretaire->syncRoles(['Secrétaire']);
    }
}
