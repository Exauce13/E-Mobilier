<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Zone;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AgentMobilierSeeder extends Seeder
{
    /**
     * Initialise les comptes Agents Mobiliers agréés.
     */
    public function run(): void
    {
        $zoneCotonou = Zone::where('code', 'ZON-LIT-COT-01')->first();

        $agent = User::firstOrCreate(
            ['email' => 'agent@e-mobilier.bj'],
            [
                'name' => 'AGOSSOU',
                'prenom' => 'Serge',
                'telephone' => '+2290197000007',
                'password' => Hash::make('Agent@2026!'),
                'zone_id' => $zoneCotonou?->id,
                'is_verifed' => true,
                'statut' => 'actif',
            ]
        );
        if ($zoneCotonou && ! $agent->zone_id) {
            $agent->update(['zone_id' => $zoneCotonou->id]);
        }
        $agent->syncRoles(['Agent mobilier']);
    }
}
