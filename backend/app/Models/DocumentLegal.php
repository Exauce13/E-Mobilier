<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DocumentLegal extends Model
{
    use HasFactory;

    protected $table = 'documents_legaux';

    protected $fillable = [
        'type',
        'titre',
        'version',
        'contenu',
        'hash_contenu',
        'is_active',
        'published_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'published_at' => 'datetime',
    ];

    /**
     * Signatures enregistrées pour ce document légal.
     */
    public function signatures(): HasMany
    {
        return $this->hasMany(SignatureLegale::class, 'document_legal_id');
    }

    /**
     * Récupère la version courante active d'un type de document.
     */
    public static function courante(string $type): ?self
    {
        return self::where('type', $type)
            ->where('is_active', true)
            ->latest('published_at')
            ->first();
    }
}

