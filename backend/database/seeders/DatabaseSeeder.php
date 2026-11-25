<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            PlatformSettingSeeder::class,
            SuperAdminPrincipalSeeder::class,
            SuperAdminTechniqueSeeder::class,
            SecretaireSeeder::class,
            ResponsableZoneSeeder::class,
            AgentMobilierSeeder::class,
            ClientSeeder::class,
        ]);
    }
}
