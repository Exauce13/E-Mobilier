<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Paiement extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'paiements';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'property_id',
        'transaction_reference',
        'gateway_transaction_id',
        'payment_type',
        'related_entity_id',
        'amount',
        'currency',
        'gateway_fees',
        'payment_method',
        'status',
        'gateway_status',
        'verified_at',
        'expires_at',
        'failure_reason',
        'gateway_payload',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'gateway_fees' => 'decimal:2',
            'related_entity_id' => 'integer',
            'verified_at' => 'datetime',
            'expires_at' => 'datetime',
            'gateway_payload' => 'array',
        ];
    }

    public function getNormalizedStatusAttribute(): string
    {
        return $this->status === 'successful' ? 'success' : (string) $this->status;
    }

    public function isConsumed(): bool
    {
        if (in_array($this->payment_type, ['agent_post', 'owner_post_submission'], true)) {
            return $this->property_id !== null || $this->related_entity_id !== null;
        }

        return $this->related_entity_id !== null;
    }

    /**
     * Utilisateur ayant effectué le paiement.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Propriété associée (optionnelle selon le type de paiement).
     */
    public function propriete(): BelongsTo
    {
        return $this->belongsTo(Proprietes::class, 'property_id');
    }

    /**
     * Alias anglais pour la propriété.
     */
    public function property(): BelongsTo
    {
        return $this->propriete();
    }

    /**
     * Alias client pour l'utilisateur payeur.
     */
    public function client(): BelongsTo
    {
        return $this->user();
    }
}
