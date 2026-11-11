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
        Schema::create('documents_legaux', function (Blueprint $table) {
            $table->id();
            $table->string('type'); // 'cgu', 'charte_non_contournement'
            $table->string('titre');
            $table->string('version'); // 'v1.0', 'v1.1'
            $table->text('contenu');
            $table->string('hash_contenu', 64); // SHA-256
            $table->boolean('is_active')->default(true);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['type', 'is_active']);
            $table->unique(['type', 'version']);
        });

        Schema::create('signatures_legales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('document_legal_id')->constrained('documents_legaux')->cascadeOnDelete();
            $table->string('hash_document', 64);
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('signed_at')->useCurrent();

            $table->unique(['user_id', 'document_legal_id']);
            $table->index(['user_id', 'signed_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('signatures_legales');
        Schema::dropIfExists('documents_legaux');
    }
};

