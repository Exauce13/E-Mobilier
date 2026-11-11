<?php

namespace App\Http\Resources;

use App\Models\DemandeDemasquage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DemandeClientResource extends JsonResource
{
    /**
     * Transform the resource into an array with context-aware data masking.
     */
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $client = $this->client;

        // Déterminer si l'utilisateur a le droit de voir les données en clair
        $canViewClear = false;

        if ($user) {
            if ($user->isSuperAdminPrincipal() || $user->isSuperAdminTechnique()) {
                $canViewClear = true;
            } elseif ($user->isSecretaire() || $user->isResponsableZone()) {
                // Vérifier s'il dispose d'un démasquage temporaire actif (TTL)
                $canViewClear = DemandeDemasquage::hasActiveAccess($user->id, 'demande_client', $this->id);
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
                // Masquage strict côté serveur
                $clientData = [
                    'id' => $client->id,
                    'pseudo' => 'Client #' . $this->id,
                    'name' => 'MASQUÉ',
                    'prenom' => 'Client',
                    'nom_complet' => 'Client #' . $this->id . ' (Masqué)',
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
            'reference_dossier' => 'DEM-' . str_pad((string) $this->id, 5, '0', STR_PAD_LEFT),
            'client_id' => $this->client_id,
            'client' => $clientData,
            'zone_id' => $this->zone_id,
            'zone' => $this->zone ? [
                'id' => $this->zone->id,
                'nom' => $this->zone->nom,
                'code' => $this->zone->code,
                'commune' => $this->zone->commune,
            ] : null,
            'property_type' => $this->property_type,
            'transaction_type' => $this->transaction_type,
            'target_commune' => $this->target_commune,
            'target_arrondissement' => $this->target_arrondissement,
            'target_quartier' => $this->target_quartier,
            'budget_max' => $this->budget_max,
            'criteria_details' => $this->criteria_details,
            'is_paid' => $this->is_paid,
            'statut_paiement' => $this->is_paid ? 'Payé / Validé' : 'En attente de paiement',
            'status' => $this->status,
            'donnees_masquees' => ! $canViewClear,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}

