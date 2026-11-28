<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Demande_client extends Model
{
    use HasFactory;

    public const DEFAULT_VALIDITY_DAYS = 30;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'demande_clients';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'client_id',
        'zone_id',
        'property_type',
        'transaction_type',
        'target_commune',
        'target_arrondissement',
        'target_quartier',
        'budget_max',
        'criteria_details',
        'is_paid',
        'status',
        'gestionnaire_id',
        'prise_en_charge_at',
        'expires_at',
        'matched_propriete_id',
        'motif_cloture',
        'cloture_at',
        'cloture_par_id',
        'motif_cloture_details',
    ];

    protected static function booted(): void
    {
        static::creating(function (Demande_client $demande): void {
            if ($demande->expires_at === null) {
                $demande->expires_at = now()->addDays(self::DEFAULT_VALIDITY_DAYS);
            }

            if ($demande->zone_id === null && ! empty($demande->target_commune)) {
                $communeLower = mb_strtolower(trim((string) $demande->target_commune));
                $zone = Zone::where('is_active', true)->get()->first(function (Zone $z) use ($communeLower) {
                    $zCommune = mb_strtolower(trim((string) $z->commune));
                    return $zCommune !== '' && (str_contains($zCommune, $communeLower) || str_contains($communeLower, $zCommune));
                });
                if ($zone) {
                    $demande->zone_id = $zone->id;
                }
            }
        });
    }

    /**
     * Statut métier unifié pour l'interface et la supervision.
     */
    public function getWorkflowStatusAttribute(): string
    {
        if ($this->status === 'fulfilled' || $this->motif_cloture === 'satisfaite') {
            return 'satisfaite';
        }
        if ($this->status === 'closed') {
            if ($this->motif_cloture === 'delai_depasse') {
                return 'expiree';
            }
            return 'abandonnee';
        }

        return $this->gestionnaire_id ? 'en_cours' : 'en_attente';
    }

    public function isCloturee(): bool
    {
        return in_array($this->status, ['fulfilled', 'closed'], true);
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && now()->greaterThanOrEqualTo($this->expires_at);
    }

    /**
     * Administrateur opérationnel prenant en charge la demande.
     */
    public function gestionnaire(): BelongsTo
    {
        return $this->belongsTo(User::class, 'gestionnaire_id');
    }

    /**
     * Agent ou administrateur ayant clôturé la demande.
     */
    public function cloturePar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cloture_par_id');
    }

    /**
     * Propriété associée retenue pour le rapprochement (compatibilité principale).
     */
    public function matchedPropriete(): BelongsTo
    {
        return $this->belongsTo(Proprietes::class, 'matched_propriete_id');
    }

    /**
     * Liste des biens associés/proposés pour cette demande (relation N-N).
     */
    public function proprietesAssociees(): BelongsToMany
    {
        return $this->belongsToMany(Proprietes::class, 'demande_client_proprietes', 'demande_client_id', 'propriete_id')
            ->withPivot(['associe_par_id', 'score_matching', 'note_agent', 'client_notifie', 'notifie_at'])
            ->withTimestamps()
            ->orderByPivot('created_at', 'desc');
    }

    /**
     * Zone géographique de la demande.
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
            'budget_max' => 'decimal:2',
            'is_paid' => 'boolean',
            'prise_en_charge_at' => 'datetime',
            'expires_at' => 'datetime',
            'cloture_at' => 'datetime',
        ];
    }

    /**
     * Client à l'origine de la demande.
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    /**
     * Alias pour la relation client.
     */
    public function user(): BelongsTo
    {
        return $this->client();
    }
}
