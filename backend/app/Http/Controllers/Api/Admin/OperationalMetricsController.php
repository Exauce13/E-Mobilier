<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Demande_client;
use App\Models\Proprietes;
use App\Models\Visite_client;
use App\Models\Zone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OperationalMetricsController extends Controller
{
    /**
     * Synthèse des performances opérationnelles globales (Zéro FCFA).
     * Accessible par Super Admin Principal et Secrétaire.
     */
    public function operationsGlobales(): JsonResponse
    {
        $debutMois = now()->startOfMonth();

        // 1. Indicateurs de visites terrain
        $totalVisites = Visite_client::where('created_at', '>=', $debutMois)->count();
        $visitesEffectuees = Visite_client::where('created_at', '>=', $debutMois)
            ->where('status', 'completed')
            ->count();
        $tauxCompletionVisites = $totalVisites > 0 ? round(($visitesEffectuees / $totalVisites) * 100, 2) : 0.0;

        // 2. Indicateurs de conversion des demandes
        $totalDemandes = Demande_client::where('created_at', '>=', $debutMois)->count();
        $demandesSatisfaites = Demande_client::where('created_at', '>=', $debutMois)
            ->where('motif_cloture', 'satisfaite')
            ->count();
        $tauxTransformation = $totalDemandes > 0 ? round(($demandesSatisfaites / $totalDemandes) * 100, 2) : 0.0;

        // 3. Vélocité du catalogue
        $annoncesActives = Proprietes::where('status', 'published')->count();
        $annoncesEnAttente = Proprietes::where('status', 'pending')->count();
        $annoncesConclues = Proprietes::where('status', 'sold_rented')
            ->where('updated_at', '>=', $debutMois)
            ->count();

        return response()->json([
            'success' => true,
            'periode' => [
                'mois' => now()->format('Y-m'),
                'debut' => $debutMois->toIso8601String(),
                'fin' => now()->toIso8601String(),
            ],
            'indicateurs_visites_terrain' => [
                'total_visites' => $totalVisites,
                'visites_effectuees' => $visitesEffectuees,
                'taux_completion_pourcentage' => $tauxCompletionVisites,
            ],
            'indicateurs_demandes_recherche' => [
                'total_demandes' => $totalDemandes,
                'demandes_satisfaites' => $demandesSatisfaites,
                'taux_transformation_pourcentage' => $tauxTransformation,
            ],
            'catalogue_immobilier' => [
                'annonces_en_ligne' => $annoncesActives,
                'annonces_en_attente_moderation' => $annoncesEnAttente,
                'biens_vendus_ou_loues_ce_mois' => $annoncesConclues,
            ],
        ]);
    }

    /**
     * Métriques de performance sectorielle par zone géographique.
     */
    public function zonePerformance(Request $request): JsonResponse
    {
        $user = $request->user();

        // Détermination de la zone cible
        $zoneId = $user->isResponsableZone() && ! $user->isSuperAdminPrincipal() && ! $user->isSuperAdminTechnique()
            ? $user->zone_id
            : $request->integer('zone_id', $user->zone_id ?? 1);

        $zone = Zone::findOrFail($zoneId);

        $visitesZone = Visite_client::where('zone_id', $zoneId)->count();
        $visitesTerminees = Visite_client::where('zone_id', $zoneId)
            ->where('status', 'completed')
            ->count();
        $tauxCompletion = $visitesZone > 0 ? round(($visitesTerminees / $visitesZone) * 100, 2) : 0.0;

        $biensZoneActifs = Proprietes::where('zone_id', $zoneId)->where('status', 'published')->count();
        $biensZoneConclus = Proprietes::where('zone_id', $zoneId)->where('status', 'sold_rented')->count();

        return response()->json([
            'success' => true,
            'zone' => [
                'id' => $zone->id,
                'nom' => $zone->nom,
                'code' => $zone->code,
            ],
            'performance_operationnelle' => [
                'total_visites_secteur' => $visitesZone,
                'visites_realisees' => $visitesTerminees,
                'taux_completion_pourcentage' => $tauxCompletion,
                'biens_actifs_secteur' => $biensZoneActifs,
                'biens_conclus_secteur' => $biensZoneConclus,
            ],
        ]);
    }
}
