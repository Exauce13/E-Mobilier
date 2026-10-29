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
            $table->string('email')->nullable()->change();

            if (! Schema::hasColumn('users', 'prenom')) {
                $table->string('prenom')->nullable();
            }
            if (! Schema::hasColumn('users', 'telephone')) {
                $table->string('telephone')->nullable()->unique();
            }
            if (! Schema::hasColumn('users', 'is_verifed')) {
                $table->boolean('is_verifed')->default(false);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'is_verifed')) {
                $table->dropColumn('is_verifed');
            }
            if (Schema::hasColumn('users', 'telephone')) {
                $table->dropColumn('telephone');
            }
            if (Schema::hasColumn('users', 'prenom')) {
                $table->dropColumn('prenom');
            }
        });
    }
};
