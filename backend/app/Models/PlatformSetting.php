<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlatformSetting extends Model
{
    protected $table = 'platform_settings';

    protected $fillable = [
        'cle',
        'valeur',
        'type',
        'groupe',
        'label',
        'description',
        'is_public',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'is_public' => 'boolean',
        ];
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Retourne la valeur typée selon la colonne `type`.
     */
    public function typedValue(): mixed
    {
        if ($this->valeur === null) {
            return null;
        }

        return match ($this->type) {
            'integer' => (int) $this->valeur,
            'boolean' => filter_var($this->valeur, FILTER_VALIDATE_BOOLEAN),
            'json' => json_decode($this->valeur, true),
            default => (string) $this->valeur,
        };
    }
}
