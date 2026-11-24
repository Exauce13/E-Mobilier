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
        Schema::create('property_inquiries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('property_id')->nullable()->constrained('proprietes')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('recipient_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type', 40)->default('contact'); // demande_visite, rendez_vous, contact, formulaire_client
            $table->string('nom', 120);
            $table->string('prenom', 120);
            $table->string('telephone', 40);
            $table->string('email', 180);
            $table->dateTime('scheduled_date')->nullable();
            $table->string('meeting_mode', 40)->nullable(); // sur_place, appel, agence
            $table->string('sujet', 180)->nullable();
            $table->string('commune', 120)->nullable();
            $table->string('quartier', 120)->nullable();
            $table->decimal('budget', 14, 2)->nullable();
            $table->text('message')->nullable();
            $table->string('status', 30)->default('nouveau'); // nouveau, en_cours, confirme, traite, annule
            $table->timestamps();

            $table->index(['property_id', 'type']);
            $table->index(['recipient_id', 'status']);
            $table->index(['user_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('property_inquiries');
    }
};
