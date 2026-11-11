<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DemandeDemasquage extends Model
{
    use HasFactory;

    protected $table = 'demandes_demasquage';

    protected $fillable = [
        'user_id',
        'type_dossier',
        'dossier_id',
        'motif',
        'justification',
        'statut',
        'approved_by',
        'duree_minutes',
        'expires_at',
        'approved_at',
        'refused_at',
        'motif_refus',
        'revoque_at',
        'revoque_by',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'approved_at' => 'datetime',
        'refused_at' => 'datetime',
        'revoque_at' => 'datetime',
        'duree_minutes' => 'integer',
    ];

    /**
     * Administrateur secondaire ayant soumis la demande.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Super Administrateur ayant approuvé la demande.
     */
    public function approbateur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * Super Administrateur ayant révoqué l'accès.
     */
    public function revoqueur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'revoque_by');
    }

    /**
     * Vérifie si le démasquage est actuellement actif et non expiré.
     */
    public function isActif(): bool
    {
        return $this->statut === 'approuve'
            && $this->expires_at !== null
            && now()->lt($this->expires_at);
    }

    /**
     * Vérifie si un utilisateur dispose d'une autorisation active pour un dossier précis.
     */
    public static function hasActiveAccess(int $userId, string $typeDossier, int $dossierId): bool
    {
        return self::where('user_id', $userId)
            ->where('type_dossier', $typeDossier)
            ->where('dossier_id', $dossierId)
            ->where('statut', 'approuve')
            ->where('expires_at', '>', now())
            ->exists();
    }
}

