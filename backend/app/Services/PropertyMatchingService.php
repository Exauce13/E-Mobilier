<?php

namespace App\Services;

use App\Models\Demande_client;
use App\Models\Proprietes;
use Illuminate\Support\Collection;

class PropertyMatchingService
{
    public const MIN_SCORE_THRESHOLD = 40;

    /**
     * Calcule le score de correspondance (0-100) et les critères correspondants entre une demande et un bien publié.
     *
     * @return array{score: int, criteres_correspondants: list<string>, criteres_manquants: list<string>}
     */
    public function evaluate(Demande_client $demande, Proprietes $bien): array
    {
        $score = 0;
        $matched = [];
        $missing = [];

        // 1. Type de bien (30 pts)
        if (mb_strtolower((string) $bien->type) === mb_strtolower((string) $demande->property_type)) {
            $score += 30;
            $matched[] = 'type';
        } else {
            $missing[] = 'type';
        }

        // 2. Type de transaction (20 pts)
        if (mb_strtolower((string) $bien->transaction_type) === mb_strtolower((string) $demande->transaction_type)) {
            $score += 20;
            $matched[] = 'transaction';
        } else {
            $missing[] = 'transaction';
        }

        // 3. Localisation : Commune + Quartier / Arrondissement (25 pts max)
        $bienCommune = mb_strtolower(trim((string) $bien->commune));
        $targetCommune = mb_strtolower(trim((string) $demande->target_commune));
        $communeMatches = $bienCommune !== '' && $targetCommune !== ''
            && (str_contains($bienCommune, $targetCommune) || str_contains($targetCommune, $bienCommune));

        $targetQuartier = mb_strtolower(trim((string) ($demande->target_quartier ?? '')));
        $bienQuartier = mb_strtolower(trim((string) ($bien->quartier ?? '')));
        $targetArr = mb_strtolower(trim((string) ($demande->target_arrondissement ?? '')));
        $bienArr = mb_strtolower(trim((string) ($bien->arrondissement ?? '')));

        if ($communeMatches) {
            $matched[] = 'commune';
            if ($targetQuartier !== '') {
                $quartierMatches = $bienQuartier !== ''
                    && (str_contains($bienQuartier, $targetQuartier) || str_contains($targetQuartier, $bienQuartier));
                if ($quartierMatches) {
                    $score += 25;
                    $matched[] = 'quartier';
                } else {
                    $score += 18;
                    $missing[] = 'quartier';
                }
            } elseif ($targetArr !== '') {
                $arrMatches = $bienArr !== ''
                    && (str_contains($bienArr, $targetArr) || str_contains($targetArr, $bienArr));
                if ($arrMatches) {
                    $score += 25;
                    $matched[] = 'arrondissement';
                } else {
                    $score += 20;
                    $missing[] = 'arrondissement';
                }
            } else {
                $score += 25;
            }
        } else {
            $missing[] = 'commune';
        }

        // 4. Budget plafond (25 pts max)
        $prix = (float) $bien->prix;
        $budgetMax = (float) $demande->budget_max;
        if ($budgetMax > 0 && $prix <= $budgetMax) {
            $score += 25;
            $matched[] = 'budget';
        } elseif ($budgetMax > 0 && $prix <= ($budgetMax * 1.15)) {
            $score += 12;
            $matched[] = 'budget_proche';
        } else {
            $missing[] = 'budget';
        }

        return [
            'score' => min(100, $score),
            'criteres_correspondants' => $matched,
            'criteres_manquants' => $missing,
        ];
    }

    /**
     * Retourne les biens publiés et disponibles classés par score décroissant pour une demande donnée.
     *
     * @param Collection<int, Proprietes>|null $publishedPool
     * @return list<array<string, mixed>>
     */
    public function findMatches(Demande_client $demande, ?Collection $publishedPool = null): array
    {
        $biens = $publishedPool ?? Proprietes::with(['zone', 'media'])
            ->where('status', 'published')
            ->get();

        $associatedIds = $demande->relationLoaded('proprietesAssociees')
            ? $demande->proprietesAssociees->pluck('id')->all()
            : $demande->proprietesAssociees()->pluck('proprietes.id')->all();

        if ($demande->matched_propriete_id && ! in_array($demande->matched_propriete_id, $associatedIds, true)) {
            $associatedIds[] = $demande->matched_propriete_id;
        }

        $resultats = [];

        foreach ($biens as $bien) {
            if ($bien->status !== 'published') {
                continue;
            }

            $eval = $this->evaluate($demande, $bien);
            if ($eval['score'] < self::MIN_SCORE_THRESHOLD) {
                continue;
            }

            $firstImage = $bien->media
                ? $bien->media->first(fn ($m) => ($m->media_type ?? 'image') === 'image') ?? $bien->media->first()
                : null;

            $resultats[] = [
                'propriete_id' => $bien->id,
                'titre' => ucfirst((string) $bien->type) . ' — ' . $bien->commune . ($bien->quartier ? ', ' . $bien->quartier : ''),
                'type' => $bien->type,
                'transaction_type' => $bien->transaction_type,
                'commune' => $bien->commune,
                'arrondissement' => $bien->arrondissement,
                'quartier' => $bien->quartier,
                'prix' => (float) $bien->prix,
                'surface' => $bien->surface !== null ? (float) $bien->surface : null,
                'nombres_chambres' => $bien->nombres_chambres !== null ? (int) $bien->nombres_chambres : null,
                'avance_mois' => $bien->avance_mois !== null ? (int) $bien->avance_mois : null,
                'accessibilite' => $bien->accessibilite,
                'eau_courant' => $bien->eau_courant,
                'is_negotiable' => (bool) $bien->is_negotiable,
                'description' => $bien->description,
                'status' => $bien->status,
                'disponibilite' => 'Disponible',
                'photo_url' => $firstImage?->media_url,
                'zone' => $bien->zone?->nom,
                'score_matching_pourcentage' => $eval['score'],
                'criteres_correspondants' => $eval['criteres_correspondants'],
                'criteres_manquants' => $eval['criteres_manquants'],
                'deja_associe' => in_array($bien->id, $associatedIds, true),
            ];
        }

        usort($resultats, fn ($a, $b) => $b['score_matching_pourcentage'] <=> $a['score_matching_pourcentage'] ?: ($a['prix'] <=> $b['prix']));

        return $resultats;
    }

    /**
     * Compte rapidement le nombre de biens publiés compatibles (score >= 40%) pour une demande.
     *
     * @param Collection<int, Proprietes> $publishedPool
     */
    public function countMatches(Demande_client $demande, Collection $publishedPool): int
    {
        $count = 0;
        foreach ($publishedPool as $bien) {
            if ($bien->status !== 'published') {
                continue;
            }
            if ($this->evaluate($demande, $bien)['score'] >= self::MIN_SCORE_THRESHOLD) {
                $count++;
            }
        }

        return $count;
    }
}
