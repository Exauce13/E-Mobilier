<?php

namespace App\Services;

use App\Models\DemandeDemasquage;
use App\Models\GrandLivre;
use Illuminate\Support\Facades\Cache;

class SecurityAuditHardeningService
{
    /**
     * Clé de cache pour le coupe-circuit d'urgence des retraits.
     */
    public const CACHE_KEY_RETRAITS_GELES = 'emobilier_retraits_geles';

    /**
     * Vérification de l'intégrité cryptographique du Grand Livre (HMAC Hash Chaining).
     * Parcourt toute la chaîne séquentielle et vérifie qu'aucun enregistrement
     * n'a été altéré directement en base de données.
     */
    public function verifierIntegriteGrandLivre(): array
    {
        $ecritures = GrandLivre::orderBy('id', 'asc')->get();
        $total = $ecritures->count();

        if ($total === 0) {
            return [
                'chaine_intacte' => true,
                'total_ecritures' => 0,
                'derniere_reference' => null,
                'derniere_signature' => null,
                'anomalies' => [],
            ];
        }

        $anomalies = [];
        $prevHash = 'GENESIS';

        foreach ($ecritures as $ecriture) {
            $ref = $ecriture->reference_unique;
            $soldeApres = (float) $ecriture->solde_apres;

            $montantSigned = $ecriture->type_mouvement === 'debit'
                ? '-' . (float) $ecriture->montant_brut
                : (float) $ecriture->montant_net;

            $expectedHash = hash('sha256', "{$ref}|{$montantSigned}|{$soldeApres}|{$prevHash}");

            if (! hash_equals($ecriture->signature_integrite, $expectedHash)) {
                $anomalies[] = [
                    'id' => $ecriture->id,
                    'reference' => $ref,
                    'type_mouvement' => $ecriture->type_mouvement,
                    'signature_actuelle' => $ecriture->signature_integrite,
                    'signature_attendue' => $expectedHash,
                    'erreur' => 'Rupture de la chaîne cryptographique (Altération détectée).',
                ];
            }

            // Propagation du chaînage
            $prevHash = $ecriture->signature_integrite;
        }

        $last = $ecritures->last();

        return [
            'chaine_intacte' => empty($anomalies),
            'total_ecritures' => $total,
            'derniere_reference' => $last->reference_unique,
            'derniere_signature' => $last->signature_integrite,
            'anomalies' => $anomalies,
        ];
    }

    /**
     * Coupe-circuit d'urgence : gèle instantanément tous les retraits financiers.
     */
    public function gelerRetraits(string $motif, ?int $userId = null): array
    {
        $payload = [
            'gele' => true,
            'motif' => $motif,
            'actionnaire_id' => $userId,
            'date_gel' => now()->toIso8601String(),
        ];

        Cache::forever(self::CACHE_KEY_RETRAITS_GELES, $payload);

        AuditService::securityAlert('KILL_SWITCH_RETRAITS_ACTIVE', "Gel d'urgence de tous les retraits financiers activé. Motif: {$motif}");

        return $payload;
    }

    /**
     * Lève le coupe-circuit des retraits.
     */
    public function degelerRetraits(?int $userId = null): array
    {
        Cache::forget(self::CACHE_KEY_RETRAITS_GELES);

        AuditService::log('KILL_SWITCH_RETRAITS_DESACTIVE', null, [
            'actionnaire_id' => $userId,
            'message' => 'Reprise autorisée des opérations de retrait financier.',
        ]);

        return ['gele' => false, 'message' => 'Coupe-circuit des retraits désactivé. Retraits autorisés.'];
    }

    /**
     * Vérifie si le coupe-circuit des retraits est actif.
     */
    public function isRetraitsGeles(): bool
    {
        return Cache::has(self::CACHE_KEY_RETRAITS_GELES);
    }

    /**
     * Révocation d'urgence de toutes les autorisations de démasquage actives.
     */
    public function revoquerTousDemasquages(?int $adminId = null, string $motif = 'Révocation administrative d\'urgence'): int
    {
        $actives = DemandeDemasquage::where('statut', 'approuve')
            ->where('expires_at', '>', now())
            ->get();

        $count = 0;
        foreach ($actives as $demande) {
            $demande->update([
                'statut' => 'revoque',
                'expires_at' => now(),
                'motif_refus' => $motif,
            ]);
            $count++;
        }

        AuditService::securityAlert('REVOCATION_MASSIVE_DEMASQUAGES', "Révocation d'urgence de {$count} démasquage(s) actif(s). Initiateur ID: {$adminId}. Motif: {$motif}");

        return $count;
    }
}

