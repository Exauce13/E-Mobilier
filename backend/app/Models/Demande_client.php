<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Demande_client extends Model
{
    use HasFactory;

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
        'matched_propriete_id',
        'motif_cloture',
    ];

    /**
     * Administrateur opérationnel prenant en charge la demande.
     */
    public function gestionnaire(): BelongsTo
    {
        return $this->belongsTo(User::class, 'gestionnaire_id');
    }

    /**
     * Propriété associée retenue pour le rapprochement.
     */
    public function matchedPropriete(): BelongsTo
    {
        return $this->belongsTo(Proprietes::class, 'matched_propriete_id');
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
