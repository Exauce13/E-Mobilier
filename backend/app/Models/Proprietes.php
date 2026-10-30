<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Proprietes extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'proprietes';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'type',
        'transaction_type',
        'commune',
        'arrondissement',
        'quartier',
        'location_details',
        'accessibilite',
        'eau_courant',
        'surface',
        'nombres_chambres',
        'avance_mois',
        'prix',
        'is_negotiable',
        'description',
        'status',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'surface' => 'decimal:2',
            'nombres_chambres' => 'integer',
            'avance_mois' => 'integer',
            'prix' => 'decimal:2',
            'is_negotiable' => 'boolean',
        ];
    }

    /**
     * Relation avec l'utilisateur (propriétaire ou agent ayant publié).
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Médias associés (photos / vidéos).
     */
    public function media(): HasMany
    {
        return $this->hasMany(Proprietes_media::class, 'propriete_id');
    }

    /**
     * Documents légaux associés (titre foncier, convention de vente, etc.).
     */
    public function documents(): HasMany
    {
        return $this->hasMany(Proprietes_document::class, 'propriete_id');
    }

    /**
     * Demandes de visite programmées pour cette propriété.
     */
    public function visites(): HasMany
    {
        return $this->hasMany(Visite_client::class, 'property_id');
    }

    /**
     * Paiements associés à cette propriété.
     */
    public function paiements(): HasMany
    {
        return $this->hasMany(Paiement::class, 'property_id');
    }

    /**
     * Déblocages de coordonnées (paiements de vue).
     */
    public function paiementVues(): HasMany
    {
        return $this->hasMany(Paiement_vue::class, 'property_id');
    }

    /**
     * Scope pour les propriétés publiées.
     */
    public function scopePublished($query)
    {
        return $query->where('status', 'published');
    }

    /**
     * Scope pour les propriétés en attente.
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }
}
