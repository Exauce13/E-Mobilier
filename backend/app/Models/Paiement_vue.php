<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Paiement_vue extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'paiement_vues';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'client_id',
        'property_id',
        'amount_paid',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount_paid' => 'decimal:2',
        ];
    }

    /**
     * Client ayant débloqué la vue.
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    /**
     * Propriété concernée.
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
