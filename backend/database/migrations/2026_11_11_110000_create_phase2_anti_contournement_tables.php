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
        // 1. Ajout de zone_id sur visite_clients si non présent
        Schema::table('visite_clients', function (Blueprint $table) {
            $table->foreignId('zone_id')->nullable()->after('property_id')->constrained('zones')->nullOnDelete();
            $table->index('zone_id');
        });

        // 2. Ajout de zone_id sur demande_clients si non présent
        Schema::table('demande_clients', function (Blueprint $table) {
            $table->foreignId('zone_id')->nullable()->after('target_quartier')->constrained('zones')->nullOnDelete();
            $table->index('zone_id');
        });

        // 3. Table des demandes formelles de démasquage temporaire (TTL)
        Schema::create('demandes_demasquage', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('type_dossier'); // 'visite', 'demande_client'
            $table->unsignedBigInteger('dossier_id');
            $table->string('motif'); // motif standardisé
            $table->text('justification');
            $table->string('statut')->default('en_attente'); // 'en_attente', 'approuve', 'refuse', 'revoque'
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->integer('duree_minutes')->default(120);
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('refused_at')->nullable();
            $table->text('motif_refus')->nullable();
            $table->timestamp('revoque_at')->nullable();
            $table->foreignId('revoque_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['user_id', 'type_dossier', 'dossier_id', 'statut']);
            $table->index(['statut', 'expires_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('demandes_demasquage');

        Schema::table('demande_clients', function (Blueprint $table) {
            $table->dropForeign(['zone_id']);
            $table->dropColumn('zone_id');
        });

        Schema::table('visite_clients', function (Blueprint $table) {
            $table->dropForeign(['zone_id']);
            $table->dropColumn('zone_id');
        });
    }
};

