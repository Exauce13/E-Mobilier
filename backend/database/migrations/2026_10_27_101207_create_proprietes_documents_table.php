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
        Schema::create('proprietes_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('propriete_id')->constrained('proprietes')->onDelete('cascade');
            $table->enum('document_type', ['convention_vente', 'permis_habiter', 'attestation_recasement', 'titre_foncier', 'autre']);
            $table->string('document_url');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('proprietes_documents');
    }
};
