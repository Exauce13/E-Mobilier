<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SuperAdminPrincipalSeeder extends Seeder
{
    /**
     * Initialise les comptes Super Administrateurs Principaux.
     */
    public function run(): void
    {
        // 1. Super Administrateur Principal (MAGNIDE Justin - Compte existant)
        $ownerEmail = config('emobilier.super_admin_principal_email', 'justin.magnide@e-mobilier.bj');
        $justin = User::firstOrCreate(
            ['email' => $ownerEmail],
            [
                'name' => 'MAGNIDE',
                'prenom' => 'Justin',
                'telephone' => '+2290197000001',
                'password' => Hash::make('JustinOwner@2026!'),
                'is_verifed' => true,
                'statut' => 'actif',
            ]
        );
        if (in_array($justin->telephone, ['+229 97 00 00 01', '+229 01 97 00 00 01'], true)) {
            $justin->update(['telephone' => '+2290197000001']);
        }
        $justin->syncRoles(['Super Admin Principal', 'Admin']);

        // 2. Second Super Administrateur Principal (Compte existant)
        $secondaryEmail = config('emobilier.super_admin_principal_secondary_email', 'admin.principal2@e-mobilier.bj');
        $secondPrincipal = User::firstOrCreate(
            ['email' => $secondaryEmail],
            [
                'name' => 'PRINCIPAL',
                'prenom' => 'Super Admin 2',
                'telephone' => '+2290197000002',
                'password' => Hash::make('SuperAdmin2@2026!'),
                'is_verifed' => true,
                'statut' => 'actif',
            ]
        );
        $secondPrincipal->syncRoles(['Super Admin Principal', 'Admin']);
    }
}
