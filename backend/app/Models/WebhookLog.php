<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WebhookLog extends Model
{
    use HasFactory;

    protected $table = 'webhooks_log';

    public $timestamps = false;

    protected $fillable = [
        'gateway',
        'event_type',
        'gateway_transaction_id',
        'status_http',
        'is_signature_valid',
        'reconciliation_status',
        'montant',
        'payload_brut',
        'headers',
        'ip_address',
        'created_at',
    ];

    protected $casts = [
        'is_signature_valid' => 'boolean',
        'montant' => 'decimal:2',
        'payload_brut' => 'array',
        'headers' => 'array',
        'created_at' => 'datetime',
    ];
}

