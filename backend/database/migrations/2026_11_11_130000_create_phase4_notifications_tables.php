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
        // 1. Table device_tokens (Push Web/Mobile)
        if (! Schema::hasTable('device_tokens')) {
            Schema::create('device_tokens', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
                $table->string('token', 500)->index();
                $table->string('platform', 30)->default('web'); // web, android, ios
                $table->string('device_name')->nullable();
                $table->boolean('is_active')->default(true)->index();
                $table->timestamp('last_used_at')->nullable();
                $table->timestamps();
            });
        }

        // 2. Table notifications_internes (Fil in-app hermétique)
        if (! Schema::hasTable('notifications_internes')) {
            Schema::create('notifications_internes', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
                $table->string('type', 50)->index(); // paiement, retrait, securite, visite, demasquage, etc.
                $table->string('titre');
                $table->text('message');
                $table->json('data')->nullable();
                $table->boolean('lu')->default(false)->index();
                $table->timestamp('lu_a')->nullable();
                $table->timestamps();
            });
        }

        // 3. Table notifications_audit_log (Journal d'audit exhaustif des envois externes)
        if (! Schema::hasTable('notifications_audit_log')) {
            Schema::create('notifications_audit_log', function (Blueprint $table) {
                $table->id();
                $table->string('reference_evenement')->nullable()->index();
                $table->string('file_priorite', 40)->default('notifications-paiement')->index(); // critique-securite, notifications-paiement, documents-emails
                $table->string('canal', 30)->index(); // whatsapp, sms, email, push
                $table->string('destinataire_type', 40)->index(); // justin, client, admin_secondaire, agent, tech
                $table->string('destinataire_identifiant')->nullable();
                $table->string('sujet');
                $table->text('contenu_public'); // Version purgée de montants et de contacts sensibles
                $table->text('contenu_confidentiel')->nullable(); // Contenu réservé exclusivement à Justin
                $table->decimal('montant', 14, 2)->nullable(); // Montant financier (si transaction)
                $table->string('statut', 30)->default('en_attente')->index(); // en_attente, envoye, echec, replie_sms
                $table->unsignedSmallInteger('tentatives')->default(0);
                $table->text('erreur_technique')->nullable();
                $table->unsignedInteger('latence_ms')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notifications_audit_log');
        Schema::dropIfExists('notifications_internes');
        Schema::dropIfExists('device_tokens');
    }
};

