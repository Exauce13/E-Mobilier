<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Élargir status pour supporter pending, successful, failed, cancelled, expired (compatible MySQL & PostgreSQL)
        $driver = DB::connection()->getDriverName();
        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement("ALTER TABLE paiements MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'pending'");
        } elseif ($driver === 'pgsql') {
            DB::statement("ALTER TABLE paiements DROP CONSTRAINT IF EXISTS paiements_status_check");
            DB::statement("ALTER TABLE paiements ALTER COLUMN status TYPE VARCHAR(30)");
            DB::statement("ALTER TABLE paiements ALTER COLUMN status SET DEFAULT 'pending'");
        }

        Schema::table('paiements', function (Blueprint $table) {
            if (! Schema::hasColumn('paiements', 'gateway_transaction_id')) {
                $table->string('gateway_transaction_id', 120)->nullable()->unique()->after('transaction_reference');
            }
            if (! Schema::hasColumn('paiements', 'currency')) {
                $table->string('currency', 10)->default('XOF')->after('amount');
            }
            if (! Schema::hasColumn('paiements', 'gateway_fees')) {
                $table->decimal('gateway_fees', 10, 2)->default(0)->after('currency');
            }
            if (! Schema::hasColumn('paiements', 'gateway_status')) {
                $table->string('gateway_status', 40)->nullable()->after('status');
            }
            if (! Schema::hasColumn('paiements', 'verified_at')) {
                $table->timestamp('verified_at')->nullable()->after('gateway_status');
            }
            if (! Schema::hasColumn('paiements', 'expires_at')) {
                $table->timestamp('expires_at')->nullable()->after('verified_at');
            }
            if (! Schema::hasColumn('paiements', 'failure_reason')) {
                $table->string('failure_reason', 255)->nullable()->after('expires_at');
            }
            if (! Schema::hasColumn('paiements', 'gateway_payload')) {
                $table->json('gateway_payload')->nullable()->after('failure_reason');
            }
        });
    }

    public function down(): void
    {
        Schema::table('paiements', function (Blueprint $table) {
            $cols = [
                'gateway_transaction_id',
                'currency',
                'gateway_fees',
                'gateway_status',
                'verified_at',
                'expires_at',
                'failure_reason',
                'gateway_payload',
            ];
            foreach ($cols as $col) {
                if (Schema::hasColumn('paiements', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
