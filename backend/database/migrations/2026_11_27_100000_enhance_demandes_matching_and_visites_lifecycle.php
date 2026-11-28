<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Enrichissement non destructif de demande_clients (prise en charge, échéance, clôture tracée)
        Schema::table('demande_clients', function (Blueprint $table) {
            if (! Schema::hasColumn('demande_clients', 'prise_en_charge_at')) {
                $table->timestamp('prise_en_charge_at')->nullable()->after('gestionnaire_id');
            }
            if (! Schema::hasColumn('demande_clients', 'expires_at')) {
                $table->timestamp('expires_at')->nullable()->index()->after('prise_en_charge_at');
            }
            if (! Schema::hasColumn('demande_clients', 'cloture_at')) {
                $table->timestamp('cloture_at')->nullable()->after('motif_cloture');
            }
            if (! Schema::hasColumn('demande_clients', 'cloture_par_id')) {
                $table->foreignId('cloture_par_id')->nullable()->after('cloture_at')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('demande_clients', 'motif_cloture_details')) {
                $table->text('motif_cloture_details')->nullable()->after('cloture_par_id');
            }
        });

        // 2. Table pivot pour l'association multi-biens sur une demande de recherche (Matching Phase 4)
        if (! Schema::hasTable('demande_client_proprietes')) {
            Schema::create('demande_client_proprietes', function (Blueprint $table) {
                $table->id();
                $table->foreignId('demande_client_id')->constrained('demande_clients')->onDelete('cascade');
                $table->foreignId('propriete_id')->constrained('proprietes')->onDelete('cascade');
                $table->foreignId('associe_par_id')->nullable()->constrained('users')->nullOnDelete();
                $table->unsignedTinyInteger('score_matching')->nullable();
                $table->string('note_agent', 500)->nullable();
                $table->boolean('client_notifie')->default(true);
                $table->timestamp('notifie_at')->nullable();
                $table->timestamps();

                $table->unique(['demande_client_id', 'propriete_id'], 'dcp_demande_prop_unique');
            });
        }

        // 3. Backfill sûr des demandes existantes sans écraser de données métier
        $demandes = DB::table('demande_clients')->select('id', 'gestionnaire_id', 'matched_propriete_id', 'status', 'motif_cloture', 'created_at', 'updated_at', 'prise_en_charge_at', 'expires_at', 'cloture_at')->get();
        foreach ($demandes as $d) {
            $updates = [];
            if ($d->expires_at === null && $d->created_at !== null) {
                $updates['expires_at'] = \Carbon\Carbon::parse($d->created_at)->addDays(30);
            }
            if ($d->gestionnaire_id !== null && $d->prise_en_charge_at === null) {
                $updates['prise_en_charge_at'] = $d->updated_at ?? $d->created_at;
            }
            if (in_array($d->status, ['fulfilled', 'closed'], true) && $d->cloture_at === null) {
                $updates['cloture_at'] = $d->updated_at ?? $d->created_at;
            }
            if (! empty($updates)) {
                DB::table('demande_clients')->where('id', $d->id)->update($updates);
            }
            if ($d->matched_propriete_id !== null) {
                DB::table('demande_client_proprietes')->insertOrIgnore([
                    'demande_client_id' => $d->id,
                    'propriete_id' => $d->matched_propriete_id,
                    'associe_par_id' => $d->gestionnaire_id,
                    'client_notifie' => true,
                    'notifie_at' => $d->updated_at ?? now(),
                    'created_at' => $d->updated_at ?? now(),
                    'updated_at' => $d->updated_at ?? now(),
                ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('demande_client_proprietes');

        Schema::table('demande_clients', function (Blueprint $table) {
            if (Schema::hasColumn('demande_clients', 'cloture_par_id')) {
                $table->dropConstrainedForeignId('cloture_par_id');
            }
            $dropCols = array_values(array_filter([
                Schema::hasColumn('demande_clients', 'prise_en_charge_at') ? 'prise_en_charge_at' : null,
                Schema::hasColumn('demande_clients', 'expires_at') ? 'expires_at' : null,
                Schema::hasColumn('demande_clients', 'cloture_at') ? 'cloture_at' : null,
                Schema::hasColumn('demande_clients', 'motif_cloture_details') ? 'motif_cloture_details' : null,
            ]));
            if (! empty($dropCols)) {
                $table->dropColumn($dropCols);
            }
        });
    }
};
