<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['name', 'prenom', 'email', 'telephone', 'is_verifed', 'password', 'device_token', 'zone_id', 'statut'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, HasRoles;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'is_verifed' => 'boolean',
            'password' => 'hashed',
        ];
    }

    /**
     * Get full name attribute.
     */
    public function getFullNameAttribute(): string
    {
        return trim("{$this->prenom} {$this->name}");
    }

    /**
     * Propriétés publiées par l'utilisateur.
     */
    public function proprietes(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Proprietes::class, 'user_id');
    }

    /**
     * Demandes de recherche soumises par l'utilisateur.
     */
    public function demandes(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Demande_client::class, 'client_id');
    }

    /**
     * Visites demandées par l'utilisateur en tant que client.
     */
    public function visites(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Visite_client::class, 'client_id');
    }

    /**
     * Visites assignées à l'utilisateur en tant qu'agent.
     */
    public function visitesAgent(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Visite_client::class, 'target_agent_id');
    }

    /**
     * Paiements effectués par l'utilisateur.
     */
    public function paiements(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Paiement::class, 'user_id');
    }

    /**
     * Vues de coordonnées débloquées par l'utilisateur.
     */
    public function paiementVues(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Paiement_vue::class, 'client_id');
    }

    /**
     * Zone géographique de rattachement (pour les Responsables de zone).
     */
    public function zone(): BelongsTo
    {
        return $this->belongsTo(Zone::class, 'zone_id');
    }

    /**
     * Signatures de documents légaux de l'utilisateur.
     */
    public function signaturesLegales(): HasMany
    {
        return $this->hasMany(SignatureLegale::class, 'user_id');
    }

    /**
     * Logs d'audit générés par cet utilisateur.
     */
    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class, 'user_id');
    }

    public function isActif(): bool
    {
        return $this->statut === 'actif';
    }

    public function isSuspendu(): bool
    {
        return $this->statut === 'suspendu';
    }

    public function isSuperAdminPrincipal(): bool
    {
        $ownerEmail = config('emobilier.super_admin_principal_email');
        if ($ownerEmail && strtolower($this->email) === strtolower($ownerEmail)) {
            return true;
        }

        $ownerId = config('emobilier.super_admin_principal_id');
        if ($ownerId && (int) $this->id === (int) $ownerId) {
            return true;
        }

        return $this->hasRole('Super Admin Principal');
    }

    /**
     * Titulaire financier exclusif du compte marchand (MAGNIDE Justin).
     * Monopole absolu sur les soldes, le Grand Livre et les retraits (Payouts OTP).
     */
    public function isFinancialOwner(): bool
    {
        $ownerEmail = config('emobilier.super_admin_principal_email');
        $isOwnerEmail = $ownerEmail && strtolower($this->email) === strtolower($ownerEmail);

        $ownerId = config('emobilier.super_admin_principal_id');
        $isOwnerId = $ownerId && (int) $this->id === (int) $ownerId;

        return ($isOwnerEmail || $isOwnerId) && $this->hasRole('Super Admin Principal');
    }

    public function isSuperAdminTechnique(): bool
    {
        return $this->hasRole('Super Admin Technique');
    }

    public function isSecretaire(): bool
    {
        return $this->hasRole('Secrétaire');
    }

    public function isResponsableZone(): bool
    {
        return $this->hasRole('Responsable de zone');
    }

    public function isAnyAdmin(): bool
    {
        return $this->isSuperAdminPrincipal()
            || $this->isSuperAdminTechnique()
            || $this->isSecretaire()
            || $this->isResponsableZone()
            || $this->hasRole('Admin');
    }

    public function hasSignedCurrentCharte(): bool
    {
        $charte = DocumentLegal::courante('charte_non_contournement');
        if (! $charte) {
            return true; // Aucune charte active requise
        }

        return $this->signaturesLegales()
            ->where('document_legal_id', $charte->id)
            ->exists();
    }
}
