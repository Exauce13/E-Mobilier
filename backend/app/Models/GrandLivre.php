<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GrandLivre extends Model
{
    use HasFactory;

    protected $table = 'grand_livre';

    public $timestamps = false;

    protected $fillable = [
        'reference_unique',
        'type_mouvement',
        'categorie',
        'montant_brut',
        'frais_agregateur',
        'montant_net',
        'devise',
        'solde_apres',
        'paiement_id',
        'retrait_id',
        'gateway',
        'gateway_transaction_id',
        'client_id',
        'description',
        'metadata',
        'signature_integrite',
        'created_at',
    ];

    protected $casts = [
        'montant_brut' => 'decimal:2',
        'frais_agregateur' => 'decimal:2',
        'montant_net' => 'decimal:2',
        'solde_apres' => 'decimal:2',
        'metadata' => 'array',
        'created_at' => 'datetime',
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function paiement(): BelongsTo
    {
        return $this->belongsTo(Paiement::class, 'paiement_id');
    }

    public function retrait(): BelongsTo
    {
        return $this->belongsTo(Retrait::class, 'retrait_id');
    }

    /**
     * Retourne le solde actuel vérifiable.
     */
    public static function getDernierSolde(): float
    {
        $derniereLigne = self::latest('id')->first();
        return $derniereLigne ? (float) $derniereLigne->solde_apres : 0.0;
    }
}

