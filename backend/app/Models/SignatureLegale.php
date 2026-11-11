<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SignatureLegale extends Model
{
    use HasFactory;

    protected $table = 'signatures_legales';

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'document_legal_id',
        'hash_document',
        'ip_address',
        'user_agent',
        'signed_at',
    ];

    protected $casts = [
        'signed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(DocumentLegal::class, 'document_legal_id');
    }
}

