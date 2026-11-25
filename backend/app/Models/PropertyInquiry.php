<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PropertyInquiry extends Model
{
    use HasFactory;

    protected $table = 'property_inquiries';

    protected $fillable = [
        'property_id',
        'user_id',
        'recipient_id',
        'type',
        'nom',
        'prenom',
        'telephone',
        'email',
        'scheduled_date',
        'meeting_mode',
        'sujet',
        'commune',
        'quartier',
        'budget',
        'message',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_date' => 'datetime',
            'budget' => 'decimal:2',
        ];
    }

    public function propriete(): BelongsTo
    {
        return $this->belongsTo(Proprietes::class, 'property_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_id');
    }
}
