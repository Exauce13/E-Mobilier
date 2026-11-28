<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Visite_client extends Model
{
    use HasFactory;

    /**
     * Transitions de cycle de vie autorisées pour une visite physique.
     *
     * @var array<string, list<string>>
     */
    public const ALLOWED_TRANSITIONS = [
        'pending' => ['confirmed', 'cancelled'],
        'confirmed' => ['pending', 'completed', 'cancelled'],
        'completed' => [],
        'cancelled' => [],
    ];

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'visite_clients';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'client_id',
        'property_id',
        'zone_id',
        'target_agent_id',
        'scheduled_date',
        'status',
        'is_fee_paid',
        'instructions_itineraire',
        'compte_rendu',
        'issue_cloture',
        'is_escalade_haute',
        'offre_montant',
    ];

    /**
     * Vérifie si une transition de statut est valide selon le cycle de vie métier.
     */
    public function canTransitionTo(string $targetStatus): bool
    {
        if ($this->status === $targetStatus) {
            return true;
        }

        $allowed = self::ALLOWED_TRANSITIONS[$this->status] ?? [];

        return in_array($targetStatus, $allowed, true);
    }

    /**
     * Retourne la liste des statuts cibles autorisés depuis le statut courant.
     *
     * @return list<string>
     */
    public function allowedNextStatuses(): array
    {
        return self::ALLOWED_TRANSITIONS[$this->status] ?? [];
    }

    /**
     * Zone géographique rattachée à la visite.
     */
    public function zone(): BelongsTo
    {
        return $this->belongsTo(Zone::class, 'zone_id');
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'scheduled_date' => 'datetime',
            'is_fee_paid' => 'boolean',
            'is_escalade_haute' => 'boolean',
            'offre_montant' => 'decimal:2',
        ];
    }

    /**
     * Client demandeur de la visite.
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    /**
     * Propriété concernée par la visite.
     */
    public function propriete(): BelongsTo
    {
        return $this->belongsTo(Proprietes::class, 'property_id');
    }

    /**
     * Agent ou Responsable de zone assigné à la visite.
     */
    public function agentAssigne(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_agent_id');
    }

    /**
     * Alias anglais pour la propriété.
     */
    public function property(): BelongsTo
    {
        return $this->propriete();
    }

    /**
     * Agent immobilier assigné à la visite (si applicable).
     */
    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_agent_id');
    }
}
