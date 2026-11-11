<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Zone extends Model
{
    use HasFactory;

    protected $table = 'zones';

    protected $fillable = [
        'nom',
        'departement',
        'commune',
        'arrondissements',
        'code',
        'description',
        'is_active',
    ];

    protected $casts = [
        'arrondissements' => 'array',
        'is_active' => 'boolean',
    ];

    /**
     * Utilisateurs rattachés à cette zone (ex: Responsables de zone).
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'zone_id');
    }

    /**
     * Propriétés situées dans cette zone.
     */
    public function proprietes(): HasMany
    {
        return $this->hasMany(Proprietes::class, 'zone_id');
    }
}

