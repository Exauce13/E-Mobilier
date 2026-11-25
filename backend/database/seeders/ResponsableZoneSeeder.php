<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Zone;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class ResponsableZoneSeeder extends Seeder
{
    /**
     * Initialise les comptes Responsables de zone rattachés aux zones pilotes.
     */
    public function run(): void
    {
        $zoneCotonou = Zone::where('code', 'ZON-LIT-COT-01')->first();
        $zoneCalavi = Zone::where('code', 'ZON-ATL-CAL-01')->first();

        $respCotonou = User::firstOrCreate(
            ['email' => 'resp.cotonou@e-mobilier.bj'],
            [
                'name' => 'KOUDJO',
                'prenom' => 'Arnaud',
                'telephone' => '+2290197000005',
                'password' => Hash::make('RespZone@2026!'),
                'zone_id' => $zoneCotonou?->id,
                'is_verifed' => true,
                'statut' => 'actif',
            ]
        );
        if ($zoneCotonou && ! $respCotonou->zone_id) {
            $respCotonou->update(['zone_id' => $zoneCotonou->id]);
        }
        $respCotonou->syncRoles(['Responsable de zone']);

        $respCalavi = User::firstOrCreate(
            ['email' => 'resp.calavi@e-mobilier.bj'],
            [
                'name' => 'HOUNGBEDJI',
                'prenom' => 'Brice',
                'telephone' => '+2290197000006',
                'password' => Hash::make('RespZone@2026!'),
                'zone_id' => $zoneCalavi?->id,
                'is_verifed' => true,
                'statut' => 'actif',
            ]
        );
        if ($zoneCalavi && ! $respCalavi->zone_id) {
            $respCalavi->update(['zone_id' => $zoneCalavi->id]);
        }
        $respCalavi->syncRoles(['Responsable de zone']);
    }
}
