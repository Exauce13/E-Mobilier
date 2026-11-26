<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::connection()->getDriverName();
        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement('ALTER TABLE proprietes MODIFY COLUMN surface DECIMAL(10, 2) NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE proprietes ALTER COLUMN surface DROP NOT NULL');
        }
    }

    public function down(): void
    {
        DB::table('proprietes')->whereNull('surface')->update(['surface' => 0]);

        $driver = DB::connection()->getDriverName();
        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement('ALTER TABLE proprietes MODIFY COLUMN surface DECIMAL(10, 2) NOT NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE proprietes ALTER COLUMN surface SET NOT NULL');
        }
    }
};
