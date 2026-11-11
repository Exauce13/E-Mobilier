<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class NotificationAuditLog extends Model
{
    use HasFactory;

    protected $table = 'notifications_audit_log';

    protected $fillable = [
        'reference_evenement',
        'file_priorite',
        'canal',
        'destinataire_type',
        'destinataire_identifiant',
        'sujet',
        'contenu_public',
        'contenu_confidentiel',
        'montant',
        'statut',
        'tentatives',
        'erreur_technique',
        'latence_ms',
        'metadata',
    ];

    protected $casts = [
        'montant' => 'float',
        'tentatives' => 'integer',
        'latence_ms' => 'integer',
        'metadata' => 'array',
    ];
}

