<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Retrait extends Model
{
    use HasFactory;

    protected $table = 'retraits';

    protected $fillable = [
        'reference_retrait',
        'user_id',
        'montant',
        'devise',
        'compte_beneficiaire',
        'type_compte',
        'statut',
        'otp_hash',
        'otp_expires_at',
        'otp_tentatives',
        'otp_verifie_at',
        'gateway',
        'gateway_payout_id',
        'motif_annulation_rejet',
        'executed_at',
    ];

    protected $casts = [
        'montant' => 'decimal:2',
        'otp_expires_at' => 'datetime',
        'otp_verifie_at' => 'datetime',
        'executed_at' => 'datetime',
        'otp_tentatives' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Vérifie si l'OTP est encore valide temporellement.
     */
    public function isOtpValide(): bool
    {
        return $this->statut === 'en_attente_otp'
            && $this->otp_expires_at !== null
            && now()->lt($this->otp_expires_at)
            && $this->otp_tentatives < 3;
    }
}

