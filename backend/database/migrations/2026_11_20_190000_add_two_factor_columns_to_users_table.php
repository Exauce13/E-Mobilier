<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'two_factor_token')) {
                $table->string('two_factor_token', 80)->nullable()->index();
            }
            if (! Schema::hasColumn('users', 'two_factor_otp_hash')) {
                $table->string('two_factor_otp_hash', 64)->nullable();
            }
            if (! Schema::hasColumn('users', 'two_factor_otp_expires_at')) {
                $table->timestamp('two_factor_otp_expires_at')->nullable();
            }
            if (! Schema::hasColumn('users', 'two_factor_otp_tentatives')) {
                $table->unsignedTinyInteger('two_factor_otp_tentatives')->default(0);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $columnsToDrop = [];
            foreach (['two_factor_token', 'two_factor_otp_hash', 'two_factor_otp_expires_at', 'two_factor_otp_tentatives'] as $col) {
                if (Schema::hasColumn('users', $col)) {
                    $columnsToDrop[] = $col;
                }
            }
            if (! empty($columnsToDrop)) {
                $table->dropColumn($columnsToDrop);
            }
        });
    }
};
