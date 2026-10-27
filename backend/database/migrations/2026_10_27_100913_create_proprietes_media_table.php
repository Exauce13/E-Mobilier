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
        Schema::create('proprietes_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('propriete_id')->constrained('proprietes')->onDelete('cascade');
            $table->string('media_url');
            $table->enum('media_type', ['image', 'video']);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('proprietes_media');
    }
};
