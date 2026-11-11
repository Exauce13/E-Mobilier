<?php

namespace App\Services;

use App\Models\GrandLivre;
use App\Models\Retrait;
use Exception;
use Illuminate\Support\Facades\DB;

class FinancialLedgerService
{
    /**
     * Enregistre un crédit comptable au Grand Livre (entrée nette de fonds).
     */
    public function credit(
        float $montantBrut,
        float $fraisAgregateur,
        string $categorie,
        string $description,
        ?int $paiementId = null,
        ?string $gatewayTxId = null,
        ?int $clientId = null,
        string $gateway = 'kkiapay',
        array $metadata = []
    ): GrandLivre {
        return DB::transaction(function () use (
            $montantBrut,
            $fraisAgregateur,
            $categorie,
            $description,
            $paiementId,
            $gatewayTxId,
            $clientId,
            $gateway,
            $metadata
        ) {
            // Verrou pessimiste sur la dernière ligne du Grand Livre
            $derniereLigne = GrandLivre::lockForUpdate()->latest('id')->first();
            $dernierSolde = $derniereLigne ? (float) $derniereLigne->solde_apres : 0.0;

            $montantNet = round($montantBrut - $fraisAgregateur, 2);
            $nouveauSolde = round($dernierSolde + $montantNet, 2);

            $seq = ($derniereLigne ? $derniereLigne->id : 0) + 1;
            $ref = 'GL-' . date('Ymd') . '-' . str_pad((string) $seq, 5, '0', STR_PAD_LEFT);

            // Hash d'intégrité chaîné (HMAC avec signature précédente)
            $prevHash = $derniereLigne ? $derniereLigne->signature_integrite : 'GENESIS';
            $signatureIntegrite = hash('sha256', "{$ref}|{$montantNet}|{$nouveauSolde}|{$prevHash}");

            return GrandLivre::create([
                'reference_unique' => $ref,
                'type_mouvement' => 'credit',
                'categorie' => $categorie,
                'montant_brut' => $montantBrut,
                'frais_agregateur' => $fraisAgregateur,
                'montant_net' => $montantNet,
                'devise' => 'XOF',
                'solde_apres' => $nouveauSolde,
                'paiement_id' => $paiementId,
                'retrait_id' => null,
                'gateway' => $gateway,
                'gateway_transaction_id' => $gatewayTxId,
                'client_id' => $clientId,
                'description' => $description,
                'metadata' => $metadata,
                'signature_integrite' => $signatureIntegrite,
                'created_at' => now(),
            ]);
        });
    }

    /**
     * Enregistre un débit comptable au Grand Livre (décaissement / retrait).
     */
    public function debit(
        float $montant,
        string $categorie,
        string $description,
        ?int $retraitId = null,
        string $gateway = 'kkiapay',
        array $metadata = []
    ): GrandLivre {
        return DB::transaction(function () use ($montant, $categorie, $description, $retraitId, $gateway, $metadata) {
            $derniereLigne = GrandLivre::lockForUpdate()->latest('id')->first();
            $dernierSolde = $derniereLigne ? (float) $derniereLigne->solde_apres : 0.0;

            if ($dernierSolde < $montant) {
                throw new Exception("Solde disponible insuffisant ({$dernierSolde} FCFA) pour exécuter ce retrait de {$montant} FCFA.");
            }

            $nouveauSolde = round($dernierSolde - $montant, 2);
            $seq = ($derniereLigne ? $derniereLigne->id : 0) + 1;
            $ref = 'GL-' . date('Ymd') . '-' . str_pad((string) $seq, 5, '0', STR_PAD_LEFT);

            $prevHash = $derniereLigne ? $derniereLigne->signature_integrite : 'GENESIS';
            $signatureIntegrite = hash('sha256', "{$ref}|-{$montant}|{$nouveauSolde}|{$prevHash}");

            return GrandLivre::create([
                'reference_unique' => $ref,
                'type_mouvement' => 'debit',
                'categorie' => $categorie,
                'montant_brut' => $montant,
                'frais_agregateur' => 0.0,
                'montant_net' => $montant,
                'devise' => 'XOF',
                'solde_apres' => $nouveauSolde,
                'paiement_id' => null,
                'retrait_id' => $retraitId,
                'gateway' => $gateway,
                'gateway_transaction_id' => null,
                'client_id' => null,
                'description' => $description,
                'metadata' => $metadata,
                'signature_integrite' => $signatureIntegrite,
                'created_at' => now(),
            ]);
        });
    }

    /**
     * Retourne le solde net immédiatement disponible au retrait.
     */
    public function getSoldeDisponible(): float
    {
        return GrandLivre::getDernierSolde();
    }

    /**
     * Retourne le solde des retraits en cours de traitement (en attente OTP ou opérateur).
     */
    public function getSoldeEnCompensation(): float
    {
        return (float) Retrait::whereIn('statut', ['en_attente_otp', 'en_cours_agregateur'])->sum('montant');
    }

    /**
     * Agrège les indicateurs financiers du tableau de bord de M. Justin MAGNIDE.
     */
    public function getTableauDeBord(): array
    {
        $soldeDispo = $this->getSoldeDisponible();
        $soldeEnCours = $this->getSoldeEnCompensation();

        $totalEncaisseBrut = (float) GrandLivre::where('type_mouvement', 'credit')->sum('montant_brut');
        $totalCommissions = (float) GrandLivre::where('type_mouvement', 'credit')->sum('frais_agregateur');
        $totalNetEncaissé = (float) GrandLivre::where('type_mouvement', 'credit')->sum('montant_net');
        $totalRetraitsExecutes = (float) GrandLivre::where('type_mouvement', 'debit')->where('categorie', 'retrait_payout')->sum('montant_net');

        // Ventilation par catégorie
        $categories = GrandLivre::where('type_mouvement', 'credit')
            ->select('categorie', DB::raw('SUM(montant_net) as total_net'), DB::raw('COUNT(*) as nombre'))
            ->groupBy('categorie')
            ->get()
            ->keyBy('categorie')
            ->toArray();

        return [
            'tresorerie' => [
                'solde_disponible' => $soldeDispo,
                'solde_en_cours_retrait' => $soldeEnCours,
                'devise' => 'XOF',
            ],
            'flux_globaux' => [
                'total_chiffre_affaires_brut' => $totalEncaisseBrut,
                'total_commissions_prelevees' => $totalCommissions,
                'total_net_encaisse' => $totalNetEncaissé,
                'total_retraits_vires' => $totalRetraitsExecutes,
            ],
            'ventilation_recettes' => $categories,
            'compte_beneficiaire_officiel' => config('emobilier.beneficiaire_officiel'),
        ];
    }
}

