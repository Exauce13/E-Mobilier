<?php

namespace App\Http\Resources;

use App\Models\DemandeDemasquage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VisiteClientResource extends JsonResource
{
    /**
     * Transform the visit resource with server-side context-aware masking.
     */
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $client = $this->client;

        // Règle de confidentialité E-Mobilier :
        // Seuls les Super Admins Principaux voient en permanence les coordonnées clients en clair.
        // Secrétaire & Responsable de zone : uniquement via démasquage temporaire (TTL) approuvé.
        // Super Admin Technique : coordonnées clients toujours masquées.
        $canViewClear = false;

        if ($user) {
            if ($user->isSuperAdminPrincipal()) {
                $canViewClear = true;
            } elseif ($user->isSecretaire() || $user->isResponsableZone()) {
                $canViewClear = DemandeDemasquage::hasActiveAccess($user->id, 'visite', $this->id);
            }
        }

        // Sérialisation conditionnelle du client
        $clientData = null;
        if ($client) {
            if ($canViewClear) {
                $clientData = [
                    'id' => $client->id,
                    'name' => $client->name,
                    'prenom' => $client->prenom,
                    'nom_complet' => $client->full_name,
                    'telephone' => $client->telephone,
                    'email' => $client->email,
                    'is_verifed' => $client->is_verifed,
                    'donnees_masquees' => false,
                ];
            } else {
                $clientData = [
                    'id' => $client->id,
                    'pseudo' => 'Visiteur #' . $this->id,
                    'name' => 'MASQUÉ',
                    'prenom' => 'Client',
                    'nom_complet' => 'Visiteur #' . $this->id . ' (Masqué)',
                    'telephone' => '•• •• •• •• ••',
                    'email' => '••••••@••••.••',
                    'is_verifed' => $client->is_verifed,
                    'donnees_masquees' => true,
                    'demasquage_possible' => true,
                ];
            }
        }

        $prop = $this->propriete;
        $firstImage = $prop && $prop->relationLoaded('media')
            ? ($prop->media->first(fn ($m) => ($m->media_type ?? 'image') === 'image') ?? $prop->media->first())
            : null;

        $allowedNext = $this->allowedNextStatuses();
        $canAssignZone = $user
            ? ($user->isSuperAdminPrincipal() || $user->isSuperAdminTechnique() || $user->isSecretaire() || $user->hasRole('Admin'))
            : false;

        return [
            'id' => $this->id,
            'reference_visite' => 'VIS-' . str_pad((string) $this->id, 5, '0', STR_PAD_LEFT),
            'client_id' => $this->client_id,
            'client' => $clientData,
            'property_id' => $this->property_id,
            'zone_id' => $this->zone_id ?? $prop?->zone_id,
            'zone' => $this->zone ? [
                'id' => $this->zone->id,
                'nom' => $this->zone->nom,
                'code' => $this->zone->code,
                'commune' => $this->zone->commune,
            ] : ($prop?->zone ? [
                'id' => $prop->zone->id,
                'nom' => $prop->zone->nom,
                'code' => $prop->zone->code,
                'commune' => $prop->zone->commune,
            ] : null),
            'propriete' => $prop ? [
                'id' => $prop->id,
                'type' => $prop->type,
                'transaction_type' => $prop->transaction_type,
                'commune' => $prop->commune,
                'arrondissement' => $prop->arrondissement,
                'quartier' => $prop->quartier,
                'prix' => $prop->prix,
                'surface' => $prop->surface !== null ? (float) $prop->surface : null,
                'nombres_chambres' => $prop->nombres_chambres,
                'status' => $prop->status,
                'photo_url' => $firstImage?->media_url,
            ] : null,
            'target_agent_id' => $this->target_agent_id,
            'agent_assigne' => $this->agentAssigne ? [
                'id' => $this->agentAssigne->id,
                'nom_complet' => $this->agentAssigne->full_name,
                'email' => $this->agentAssigne->email,
            ] : null,
            'scheduled_date' => $this->scheduled_date?->toIso8601String(),
            'status' => $this->status,
            'is_fee_paid' => $this->is_fee_paid,
            'statut_paiement' => $this->is_fee_paid ? 'Payé / Validé' : 'En attente de paiement',
            'instructions_itineraire' => $this->instructions_itineraire,
            'compte_rendu' => $this->compte_rendu,
            'issue_cloture' => $this->issue_cloture,
            'is_escalade_haute' => (bool) $this->is_escalade_haute,
            'offre_montant' => $this->offre_montant !== null ? (float) $this->offre_montant : null,
            'allowed_transitions' => $allowedNext,
            'permissions' => [
                'can_plan' => in_array($this->status, ['pending', 'confirmed'], true),
                'can_confirm' => in_array('confirmed', $allowedNext, true),
                'can_complete' => in_array('completed', $allowedNext, true),
                'can_cancel' => in_array('cancelled', $allowedNext, true),
                'can_report' => $this->status === 'confirmed',
                'can_close' => in_array($this->status, ['confirmed', 'completed'], true) && empty($this->issue_cloture),
                'can_escalate' => in_array($this->status, ['confirmed', 'completed'], true) && ! $this->is_escalade_haute,
                'can_assign_zone' => $canAssignZone && in_array($this->status, ['pending', 'confirmed'], true),
                'can_change_status' => count($allowedNext) > 0,
            ],
            'donnees_masquees' => ! $canViewClear,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
