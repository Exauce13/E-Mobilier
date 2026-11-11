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
        // 1. Table proprietes (Brique A)
        Schema::table('proprietes', function (Blueprint $table) {
            if (! Schema::hasColumn('proprietes', 'motif_rejet')) {
                $table->text('motif_rejet')->nullable()->after('status');
            }
        });

        // 2. Table visite_clients (Brique B)
        Schema::table('visite_clients', function (Blueprint $table) {
            if (! Schema::hasColumn('visite_clients', 'instructions_itineraire')) {
                $table->text('instructions_itineraire')->nullable();
            }
            if (! Schema::hasColumn('visite_clients', 'compte_rendu')) {
                $table->text('compte_rendu')->nullable();
            }
            if (! Schema::hasColumn('visite_clients', 'issue_cloture')) {
                $table->string('issue_cloture', 50)->nullable(); // succes_offre, sans_suite, client_absent
            }
            if (! Schema::hasColumn('visite_clients', 'is_escalade_haute')) {
                $table->boolean('is_escalade_haute')->default(false);
            }
            if (! Schema::hasColumn('visite_clients', 'offre_montant')) {
                $table->decimal('offre_montant', 15, 2)->nullable();
            }
        });

        // 3. Table demande_clients (Brique C)
        Schema::table('demande_clients', function (Blueprint $table) {
            if (! Schema::hasColumn('demande_clients', 'gestionnaire_id')) {
                $table->foreignId('gestionnaire_id')->nullable()->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('demande_clients', 'matched_propriete_id')) {
                $table->foreignId('matched_propriete_id')->nullable()->constrained('proprietes')->nullOnDelete();
            }
            if (! Schema::hasColumn('demande_clients', 'motif_cloture')) {
                $table->string('motif_cloture', 50)->nullable(); // satisfaite, abandonnee_client, delai_depasse
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('demande_clients', function (Blueprint $table) {
            $table->dropConstrainedForeignId('matched_propriete_id');
            $table->dropConstrainedForeignId('gestionnaire_id');
            $table->dropColumn('motif_cloture');
        });

        Schema::table('visite_clients', function (Blueprint $table) {
            $table->dropColumn([
                'instructions_itineraire',
                'compte_rendu',
                'issue_cloture',
                'is_escalade_haute',
                'offre_montant',
            ]);
        });

        Schema::table('proprietes', function (Blueprint $table) {
            $table->dropColumn('motif_rejet');
        });
    }
};

