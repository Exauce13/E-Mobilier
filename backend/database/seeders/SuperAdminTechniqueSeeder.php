<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SuperAdminTechniqueSeeder extends Seeder
{
    /**
     * Initialise / attribue le compte Super Administrateur Technique.
     */
    public function run(): void
    {
        // Vérification si le compte existant de Jean-Paul GNIKPO est déjà présent
        $techUser = User::where('email', 'jeanpaul@gmail.com')
            ->orWhere('email', 'jeanpaulgnikpo@gmail.com')
            ->first();

        if (! $techUser) {
            $techUser = User::firstOrCreate(
                ['email' => 'jeanpaulgnikpo@gmail.com'],
                [
                    'name' => 'GNIKPO',
                    'prenom' => 'Jean-Paul',
                    'telephone' => '+2290197000003',
                    'password' => Hash::make('TechAdmin@2026!'),
                    'is_verifed' => true,
                    'statut' => 'actif',
                ]
            );
        }

        $techUser->update(['statut' => 'actif', 'is_verifed' => true]);
        $techUser->syncRoles(['Super Admin Technique', 'Admin']);
    }
}
