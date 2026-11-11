<?php

namespace App\Services;

use App\Models\Retrait;
use App\Models\User;
use App\Services\Gateways\PaymentGatewayManager;
use Exception;
use Illuminate\Support\Facades\Log;

class PayoutService
{
    protected FinancialLedgerService $ledgerService;
    protected PaymentGatewayManager $gatewayManager;

    public function __construct(FinancialLedgerService $ledgerService, PaymentGatewayManager $gatewayManager)
    {
        $this->ledgerService = $ledgerService;
        $this->gatewayManager = $gatewayManager;
    }

    /**
     * ÉTAPE 1 : Initiation d'une demande de retrait sécurisé.
     * Le compte bénéficiaire est STRICTEMENT lu depuis la configuration en liste blanche.
     */
    public function initierRetrait(User $user, float $montant, string $typeCompte = 'mobile_money'): array
    {
        if (! $user->isFinancialOwner()) {
            throw new Exception("Action non autorisée : Seul M. Justin MAGNIDE peut ordonner un retrait.");
        }

        $soldeDispo = $this->ledgerService->getSoldeDisponible();
        if ($montant > $soldeDispo) {
            throw new Exception("Solde disponible insuffisant ({$soldeDispo} FCFA) pour un retrait de {$montant} FCFA.");
        }

        if ($montant < 1000) {
            throw new Exception("Le montant minimum d'un retrait est de 1 000 FCFA.");
        }

        // Vérification du Coupe-Circuit d'Urgence (Kill-Switch)
        if (app(\App\Services\SecurityAuditHardeningService::class)->isRetraitsGeles()) {
            throw new Exception("Opérations de retrait suspendues : Le coupe-circuit d'urgence (Kill-Switch) est actuellement activé.");
        }

        // Récupération obligatoire du compte bénéficiaire en liste blanche (Hardcoded Whitelist)
        $beneficiaireConfig = config('emobilier.beneficiaire_officiel');
        $compteBeneficiaire = $typeCompte === 'virement_bancaire'
            ? $beneficiaireConfig['rib_bancaire']
            : $beneficiaireConfig['mobile_money'];

        // Génération du code OTP à 6 chiffres
        $codeOtp = str_pad((string) random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
        $otpTtlMinutes = config('emobilier.payout_otp_ttl_minutes', 3);
        $expiresAt = now()->addMinutes($otpTtlMinutes);

        $ref = 'RET-' . date('Ymd') . '-' . str_pad((string) (Retrait::count() + 1), 5, '0', STR_PAD_LEFT);
        $gatewayName = config('emobilier.payment_gateway', 'kkiapay');

        $retrait = Retrait::create([
            'reference_retrait' => $ref,
            'user_id' => $user->id,
            'montant' => $montant,
            'devise' => 'XOF',
            'compte_beneficiaire' => $compteBeneficiaire,
            'type_compte' => $typeCompte,
            'statut' => 'en_attente_otp',
            'otp_hash' => hash('sha256', $codeOtp),
            'otp_expires_at' => $expiresAt,
            'otp_tentatives' => 0,
            'gateway' => $gatewayName,
        ]);

        AuditService::log('initiation_retrait_otp', $retrait, [
            'montant' => $montant,
            'compte_beneficiaire' => $compteBeneficiaire,
            'type_compte' => $typeCompte,
            'expires_at' => $expiresAt->toIso8601String(),
        ], true);

        // Simulation / Envoi du code OTP
        Log::channel('single')->info("[OTP_RETRAIT] Code de confirmation pour le retrait {$ref} de {$montant} FCFA : {$codeOtp}");

        try {
            app(\App\Services\Notifications\MultiChannelNotificationService::class)->notifierOtpRetrait($retrait, $codeOtp);
        } catch (\Throwable $e) {
            Log::error('[NOTIFICATION_OTP_DISPATCH_ERROR] ' . $e->getMessage());
        }

        $response = [
            'retrait' => $retrait,
            'message' => "Code de confirmation OTP expédié sur le canal sécurisé de M. Justin MAGNIDE (Valable {$otpTtlMinutes} minutes).",
            'compte_destination' => $compteBeneficiaire,
        ];

        // En environnement de test ou local, renvoyer l'OTP pour faciliter les tests d'intégration
        if (app()->environment(['local', 'testing'])) {
            $response['test_otp_code'] = $codeOtp;
        }

        return $response;
    }

    /**
     * ÉTAPE 2 : Vérification du code OTP et exécution de l'ordre auprès de l'agrégateur.
     */
    public function confirmerOtpEtExecuter(Retrait $retrait, string $codeOtp): array
    {
        if ($retrait->statut !== 'en_attente_otp') {
            throw new Exception("Cette demande de retrait n'est plus en attente d'OTP (statut : {$retrait->statut}).");
        }

        // Vérification du nombre maximal de tentatives (Protection anti-brute-force)
        $maxAttempts = config('emobilier.payout_max_otp_attempts', 3);
        if ($retrait->otp_tentatives >= $maxAttempts) {
            $retrait->update(['statut' => 'rejete', 'motif_annulation_rejet' => 'Nombre maximal de tentatives OTP dépassé.']);
            AuditService::securityAlert('BRUTE_FORCE_OTP_RETRAIT', "Tentatives excessives de validation OTP sur le retrait {$retrait->reference_retrait}");
            throw new Exception("Code OTP bloqué suite à {$maxAttempts} tentatives erronées. La demande de retrait est annulée.");
        }

        // Vérification de la validité temporelle (TTL)
        if (now()->gt($retrait->otp_expires_at)) {
            $retrait->update(['statut' => 'rejete', 'motif_annulation_rejet' => 'Délai de validité du code OTP expiré.']);
            throw new Exception("Le code de confirmation OTP a expiré (validité 3 minutes). Veuillez relancer une nouvelle demande.");
        }

        // Incrémentation des tentatives
        $retrait->increment('otp_tentatives');
        $retrait->refresh();

        // Vérification de la valeur du hash OTP
        $computedHash = hash('sha256', trim($codeOtp));
        if (! hash_equals($retrait->otp_hash, $computedHash)) {
            if ($retrait->otp_tentatives >= $maxAttempts) {
                $retrait->update([
                    'statut' => 'rejete',
                    'motif_annulation_rejet' => 'Nombre maximal de tentatives OTP dépassé (3 tentatives erronées).',
                ]);
                AuditService::securityAlert('BRUTE_FORCE_OTP_RETRAIT', "Tentatives excessives de validation OTP sur le retrait {$retrait->reference_retrait}");
                throw new Exception("Code OTP bloqué suite à {$maxAttempts} tentatives erronées. La demande de retrait est annulée.");
            }

            $tentativesRestantes = $maxAttempts - $retrait->otp_tentatives;
            throw new Exception("Code OTP invalide. Tentatives restantes avant annulation : {$tentativesRestantes}.");
        }

        // Validation réussie de l'OTP
        $retrait->update([
            'otp_verifie_at' => now(),
            'statut' => 'en_cours_agregateur',
        ]);

        // Appel de la passerelle agnostique (KKiaPay / FedaPay)
        $gateway = $this->gatewayManager->gateway($retrait->gateway);
        $payoutResult = $gateway->initiatePayout(
            $retrait->compte_beneficiaire,
            (float) $retrait->montant,
            $retrait->reference_retrait,
            ['user_id' => $retrait->user_id]
        );

        if (! $payoutResult['success']) {
            $retrait->update([
                'statut' => 'rejete',
                'motif_annulation_rejet' => $payoutResult['message'],
            ]);
            throw new Exception("L'agrégateur a rejeté le virement : " . $payoutResult['message']);
        }

        // Inscription atomique du débit au Grand Livre
        $this->ledgerService->debit(
            (float) $retrait->montant,
            'retrait_payout',
            "Virement exécuté vers compte officiel ({$retrait->compte_beneficiaire})",
            $retrait->id,
            $retrait->gateway
        );

        $retrait->update([
            'statut' => 'execute',
            'gateway_payout_id' => $payoutResult['payout_id'],
            'executed_at' => now(),
        ]);

        AuditService::log('execution_retrait_reussie', $retrait, [
            'montant' => $retrait->montant,
            'reference' => $retrait->reference_retrait,
            'gateway_payout_id' => $retrait->gateway_payout_id,
            'solde_restant' => $this->ledgerService->getSoldeDisponible(),
        ], true);

        return [
            'success' => true,
            'message' => "Virement de {$retrait->montant} FCFA exécuté avec succès vers le compte d'entreprise de M. Justin MAGNIDE.",
            'retrait' => $retrait->fresh(),
            'nouveau_solde_disponible' => $this->ledgerService->getSoldeDisponible(),
        ];
    }

    /**
     * Annule une demande de retrait en attente d'OTP.
     */
    public function annulerRetrait(Retrait $retrait, string $motif = 'Annulé par l\'administrateur'): bool
    {
        if ($retrait->statut !== 'en_attente_otp') {
            throw new Exception("Seul un retrait en attente d'OTP peut être annulé.");
        }

        $retrait->update([
            'statut' => 'annule',
            'motif_annulation_rejet' => $motif,
        ]);

        AuditService::log('annulation_demande_retrait', $retrait, [
            'motif' => $motif,
        ], true);

        return true;
    }
}
