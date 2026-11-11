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
        // 1. Table des retraits sécurisés (Payouts avec OTP)
        Schema::create('retraits', function (Blueprint $table) {
            $table->id();
            $table->string('reference_retrait')->unique();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('montant', 15, 2);
            $table->string('devise', 10)->default('XOF');
            $table->string('compte_beneficiaire');
            $table->string('type_compte')->default('mobile_money'); // 'mobile_money', 'virement_bancaire'
            $table->string('statut')->default('en_attente_otp'); // 'en_attente_otp', 'en_cours_agregateur', 'execute', 'rejete', 'annule'
            $table->string('otp_hash', 64)->nullable();
            $table->timestamp('otp_expires_at')->nullable();
            $table->integer('otp_tentatives')->default(0);
            $table->timestamp('otp_verifie_at')->nullable();
            $table->string('gateway', 50)->default('kkiapay');
            $table->string('gateway_payout_id')->nullable();
            $table->text('motif_annulation_rejet')->nullable();
            $table->timestamp('executed_at')->nullable();
            $table->timestamps();

            $table->index(['statut', 'created_at']);
            $table->index('user_id');
        });

        // 2. Grand Livre Comptable Immuable (Comptabilité en partie double E-Mobilier)
        Schema::create('grand_livre', function (Blueprint $table) {
            $table->id();
            $table->string('reference_unique')->unique();
            $table->string('type_mouvement'); // 'credit', 'debit'
            $table->string('categorie'); // 'encaissement_visite', 'encaissement_deblocage', 'encaissement_hebergement', 'retrait_payout', 'ajustement'
            $table->decimal('montant_brut', 15, 2);
            $table->decimal('frais_agregateur', 15, 2)->default(0);
            $table->decimal('montant_net', 15, 2);
            $table->string('devise', 10)->default('XOF');
            $table->decimal('solde_apres', 15, 2);
            $table->foreignId('paiement_id')->nullable()->constrained('paiements')->nullOnDelete();
            $table->foreignId('retrait_id')->nullable()->constrained('retraits')->nullOnDelete();
            $table->string('gateway', 50)->default('kkiapay');
            $table->string('gateway_transaction_id')->nullable();
            $table->foreignId('client_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('description');
            $table->json('metadata')->nullable();
            $table->string('signature_integrite', 64)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['created_at', 'type_mouvement']);
            $table->index(['gateway', 'gateway_transaction_id']);
            $table->index('client_id');
        });

        // 3. Journal d'audit des webhooks financiers (Diagnostic & Réconciliation)
        Schema::create('webhooks_log', function (Blueprint $table) {
            $table->id();
            $table->string('gateway', 50);
            $table->string('event_type')->nullable();
            $table->string('gateway_transaction_id')->nullable();
            $table->integer('status_http')->default(200);
            $table->boolean('is_signature_valid')->default(true);
            $table->string('reconciliation_status')->default('reconcilie'); // 'reconcilie', 'anomalie_montant', 'doublon_ignore', 'echec_verification'
            $table->decimal('montant', 15, 2)->nullable();
            $table->json('payload_brut');
            $table->json('headers')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['gateway', 'gateway_transaction_id']);
            $table->index(['reconciliation_status', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('webhooks_log');
        Schema::dropIfExists('grand_livre');
        Schema::dropIfExists('retraits');
    }
};

