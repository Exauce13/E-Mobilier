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
        Schema::create('proprietes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->enum('type', ['parcelle', 'maison', 'chambre']);
            $table->enum('transaction_type',['vente', 'location']);
            $table->string('commune');
            $table->string('arrondissement');
            $table->string('quartier');
            $table->text('location_details')->nullable();
            $table->string('accessibilite');
            $table->string('eau_courant');
            $table->decimal('surface',10,2);
            $table->integer('nombres_chambres');
            $table->integer('avance_mois');
            $table->decimal('prix', 15, 2);
            $table->boolean('is_negotiable')->default(false);
            $table->text('description')->nullable();
            $table->enum('status', ['pending_payment', 'pending', 'published', 'sold_rented', 'rejected'])->default('pending_payment');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('proprietes');
    }
};
