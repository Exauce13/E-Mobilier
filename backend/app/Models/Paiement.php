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
        'payment_type',
        'related_entity_id',
        'amount',
        'payment_method',
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
            'amount' => 'decimal:2',
            'related_entity_id' => 'integer',
        ];
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
}
