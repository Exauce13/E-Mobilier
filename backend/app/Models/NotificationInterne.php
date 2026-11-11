<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationInterne extends Model
{
    use HasFactory;

    protected $table = 'notifications_internes';

    protected $fillable = [
        'user_id',
        'type',
        'titre',
        'message',
        'data',
        'lu',
        'lu_a',
    ];

    protected $casts = [
        'data' => 'array',
        'lu' => 'boolean',
        'lu_a' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function marquerCommeLue(): void
    {
        $this->update([
            'lu' => true,
            'lu_a' => now(),
        ]);
    }
}

