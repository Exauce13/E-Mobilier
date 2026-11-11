<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    use HasFactory;

    protected $table = 'audit_logs';

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'action',
        'target_type',
        'target_id',
        'details',
        'ip_address',
        'user_agent',
        'is_financial',
        'created_at',
    ];

    protected $casts = [
        'details' => 'array',
        'is_financial' => 'boolean',
        'created_at' => 'datetime',
    ];

    /**
     * L'utilisateur ayant effectué l'action (nullable si action système ou non authentifiée).
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Méthode utilitaire pour enregistrer un log d'audit (Append-Only).
     */
    public static function log(string $action, ?Model $target = null, array $details = [], bool $isFinancial = false, ?int $userId = null): self
    {
        $request = request();

        return self::create([
            'user_id' => $userId ?? auth()->id(),
            'action' => $action,
            'target_type' => $target ? get_class($target) : null,
            'target_id' => $target ? $target->getKey() : null,
            'details' => $details,
            'ip_address' => $request ? $request->ip() : null,
            'user_agent' => $request ? substr($request->userAgent() ?? '', 0, 500) : null,
            'is_financial' => $isFinancial,
            'created_at' => now(),
        ]);
    }
}

