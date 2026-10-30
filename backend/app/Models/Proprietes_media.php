<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Proprietes_media extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'proprietes_media';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'propriete_id',
        'media_url',
        'media_type',
    ];

    /**
     * Propriété parente.
     */
    public function propriete(): BelongsTo
    {
        return $this->belongsTo(Proprietes::class, 'propriete_id');
    }
}
