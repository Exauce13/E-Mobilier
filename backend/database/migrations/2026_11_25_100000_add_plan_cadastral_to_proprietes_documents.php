<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Ajoute 'plan_cadastral' aux types de documents immobiliers autorisés.
     */
    public function up(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE proprietes_documents DROP CONSTRAINT IF EXISTS proprietes_documents_document_type_check');
            DB::statement("ALTER TABLE proprietes_documents ADD CONSTRAINT proprietes_documents_document_type_check CHECK (document_type IN ('convention_vente', 'permis_habiter', 'attestation_recasement', 'titre_foncier', 'plan_cadastral', 'autre'))");
        } elseif ($driver === 'mysql') {
            DB::statement("ALTER TABLE proprietes_documents MODIFY COLUMN document_type ENUM('convention_vente', 'permis_habiter', 'attestation_recasement', 'titre_foncier', 'plan_cadastral', 'autre') NOT NULL");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE proprietes_documents DROP CONSTRAINT IF EXISTS proprietes_documents_document_type_check');
            DB::statement("ALTER TABLE proprietes_documents ADD CONSTRAINT proprietes_documents_document_type_check CHECK (document_type IN ('convention_vente', 'permis_habiter', 'attestation_recasement', 'titre_foncier', 'autre'))");
        } elseif ($driver === 'mysql') {
            DB::statement("ALTER TABLE proprietes_documents MODIFY COLUMN document_type ENUM('convention_vente', 'permis_habiter', 'attestation_recasement', 'titre_foncier', 'autre') NOT NULL");
        }
    }
};
