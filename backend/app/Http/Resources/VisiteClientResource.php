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

        // Déterminer les droits de lecture en clair
        $canViewClear = false;

        if ($user) {
            if ($user->isSuperAdminPrincipal() || $user->isSuperAdminTechnique()) {
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

        return [
            'id' => $this->id,
            'reference_visite' => 'VIS-' . str_pad((string) $this->id, 5, '0', STR_PAD_LEFT),
            'client_id' => $this->client_id,
            'client' => $clientData,
            'property_id' => $this->property_id,
            'zone_id' => $this->zone_id ?? $this->propriete?->zone_id,
            'zone' => $this->zone ? [
                'id' => $this->zone->id,
                'nom' => $this->zone->nom,
                'code' => $this->zone->code,
                'commune' => $this->zone->commune,
            ] : ($this->propriete?->zone ? [
                'id' => $this->propriete->zone->id,
                'nom' => $this->propriete->zone->nom,
                'code' => $this->propriete->zone->code,
                'commune' => $this->propriete->zone->commune,
            ] : null),
            'propriete' => $this->propriete ? [
                'id' => $this->propriete->id,
                'type' => $this->propriete->type,
                'transaction_type' => $this->propriete->transaction_type,
                'commune' => $this->propriete->commune,
                'arrondissement' => $this->propriete->arrondissement,
                'quartier' => $this->propriete->quartier,
                'prix' => $this->propriete->prix,
                'status' => $this->propriete->status,
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
            'donnees_masquees' => ! $canViewClear,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}

