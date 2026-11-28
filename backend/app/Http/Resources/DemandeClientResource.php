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

        // RÈGLE DE CONFIDENTIALITÉ STRICTE :
        // Seuls les Super Admins Principaux voient en permanence les coordonnées clients en clair.
        if ($user) {
            if ($user->isSuperAdminPrincipal()) {
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

        $isSuperAdminPrincipal = $user ? $user->isSuperAdminPrincipal() : false;
        $isCloturee = $this->isCloturee();
        $isExpired = $this->isExpired();
        $isAssignedToMe = $user && $this->gestionnaire_id !== null && (int) $this->gestionnaire_id === (int) $user->id;
        $isUnassigned = $this->gestionnaire_id === null;
        $canManage = ! $isCloturee && ($isSuperAdminPrincipal || $isAssignedToMe || $isUnassigned);

        // Sérialisation des biens associés (table pivot + compatibilité matched_propriete_id)
        $biensAssocies = [];
        if ($this->relationLoaded('proprietesAssociees')) {
            foreach ($this->proprietesAssociees as $prop) {
                $img = $prop->relationLoaded('media')
                    ? ($prop->media->first(fn ($m) => ($m->media_type ?? 'image') === 'image') ?? $prop->media->first())
                    : null;
                $biensAssocies[] = [
                    'id' => $prop->id,
                    'type' => $prop->type,
                    'transaction_type' => $prop->transaction_type,
                    'commune' => $prop->commune,
                    'arrondissement' => $prop->arrondissement,
                    'quartier' => $prop->quartier,
                    'prix' => (float) $prop->prix,
                    'surface' => $prop->surface !== null ? (float) $prop->surface : null,
                    'nombres_chambres' => $prop->nombres_chambres,
                    'status' => $prop->status,
                    'photo_url' => $img?->media_url,
                    'score_matching' => $prop->pivot?->score_matching,
                    'note_agent' => $prop->pivot?->note_agent,
                    'client_notifie' => (bool) ($prop->pivot?->client_notifie ?? false),
                    'notifie_at' => $prop->pivot?->notifie_at,
                    'associe_at' => $prop->pivot?->created_at,
                ];
            }
        }

        $matchedPropData = null;
        if ($this->relationLoaded('matchedPropriete') && $this->matchedPropriete) {
            $mp = $this->matchedPropriete;
            $img = $mp->relationLoaded('media')
                ? ($mp->media->first(fn ($m) => ($m->media_type ?? 'image') === 'image') ?? $mp->media->first())
                : null;
            $matchedPropData = [
                'id' => $mp->id,
                'type' => $mp->type,
                'transaction_type' => $mp->transaction_type,
                'commune' => $mp->commune,
                'arrondissement' => $mp->arrondissement,
                'quartier' => $mp->quartier,
                'prix' => (float) $mp->prix,
                'status' => $mp->status,
                'photo_url' => $img?->media_url,
            ];
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
            'workflow_status' => $this->workflow_status,
            'gestionnaire_id' => $this->gestionnaire_id,
            'gestionnaire' => $this->relationLoaded('gestionnaire') && $this->gestionnaire ? [
                'id' => $this->gestionnaire->id,
                'nom_complet' => $this->gestionnaire->full_name,
                'email' => $this->gestionnaire->email,
            ] : null,
            'prise_en_charge_at' => $this->prise_en_charge_at?->toIso8601String(),
            'expires_at' => $this->expires_at?->toIso8601String(),
            'is_expired' => $isExpired,
            'matched_propriete_id' => $this->matched_propriete_id,
            'matched_propriete' => $matchedPropData,
            'biens_associes' => $biensAssocies,
            'biens_associes_count' => count($biensAssocies) > 0 ? count($biensAssocies) : ($this->matched_propriete_id ? 1 : 0),
            'biens_correspondants_count' => isset($this->biens_correspondants_count) ? (int) $this->biens_correspondants_count : 0,
            'motif_cloture' => $this->motif_cloture,
            'motif_cloture_details' => $this->motif_cloture_details,
            'cloture_at' => $this->cloture_at?->toIso8601String(),
            'cloture_par_id' => $this->cloture_par_id,
            'cloture_par' => $this->relationLoaded('cloturePar') && $this->cloturePar ? [
                'id' => $this->cloturePar->id,
                'nom_complet' => $this->cloturePar->full_name,
                'email' => $this->cloturePar->email,
            ] : null,
            'permissions' => [
                'can_take_charge' => ! $isCloturee && $isUnassigned,
                'can_reassign' => ! $isCloturee && $isSuperAdminPrincipal && ! $isUnassigned,
                'can_match' => ! $isCloturee && $canManage,
                'can_view_matches' => true,
                'can_close_satisfied' => ! $isCloturee && ($isSuperAdminPrincipal || $isAssignedToMe),
                'can_close_abandoned' => ! $isCloturee && ($isSuperAdminPrincipal || $isAssignedToMe),
                'can_mark_expired' => ! $isCloturee && $isExpired && ($isSuperAdminPrincipal || $isAssignedToMe || $isUnassigned),
                'can_view_history' => true,
            ],
            'donnees_masquees' => ! $canViewClear,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
