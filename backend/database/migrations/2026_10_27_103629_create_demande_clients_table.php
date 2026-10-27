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
        Schema::create('demande_clients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained('users')->onDelete('cascade');
            $table->enum('property_type', ['parcelle', 'maison', 'chambre']);
            $table->enum('transaction_type', ['location', 'vente']);
            $table->string('target_commune');
            $table->string('target_arrondissement')->nullable();
            $table->string('target_quartier')->nullable();
            $table->decimal('budget_max', 12, 2);
            $table->text('criteria_details')->nullable();
            $table->boolean('is_paid')->default(false);
            $table->enum('status', ['active', 'fulfilled', 'closed'])->default('active');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('demande_clients');
    }
};
