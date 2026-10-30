<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['name', 'prenom', 'email', 'telephone', 'is_verifed', 'password'])]
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
}
