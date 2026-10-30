<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Visite_client extends Model
{
    use HasFactory;

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
        'target_agent_id',
        'scheduled_date',
        'status',
        'is_fee_paid',
    ];

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
