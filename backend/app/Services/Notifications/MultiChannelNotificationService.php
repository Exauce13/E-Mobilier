<?php

namespace App\Services\Notifications;

use App\Models\NotificationAuditLog;
use App\Models\NotificationInterne;
use App\Models\Paiement;
use App\Models\Retrait;
use App\Models\User;
use App\Services\FinancialLedgerService;
use App\Services\Notifications\Channels\PushChannel;
use App\Services\Notifications\Channels\SmsChannel;
use App\Services\Notifications\Channels\WhatsAppChannel;
use Exception;
use Illuminate\Support\Facades\Log;

class MultiChannelNotificationService
{
    public function __construct(
        protected WhatsAppChannel $whatsapp,
        protected SmsChannel $sms,
        protected PushChannel $push
    ) {}

    /**
     * Dispatching cloisonné lors d'un paiement confirmé par l'agrégateur.
     */
    public function notifierPaiementConfirme(Paiement $paiement): void
    {
        $paiement->loadMissing(['client', 'property']);
        $client = $paiement->client;
        $montant = (float) $paiement->amount;
        $ref = $paiement->transaction_reference;

        // 1. PALIER CRITIQUE : Alerte financière destinée exclusivement à Justin MAGNIDE
        $justin = User::where('email', config('emobilier.super_admin_principal_email'))->first();
        if ($justin) {
            $soldeActuel = app(FinancialLedgerService::class)->getSoldeDisponible();
            $clientNom = $client ? "{$client->prenom} {$client->name} ({$client->telephone})" : 'Client inconnu';

            $msgJustinConfidentiel = "CONFIRMATION ENCAISSEMENT : +{$montant} FCFA reçus pour ref {$ref} ({$paiement->payment_type}). Client: {$clientNom}. Nouveau solde disponible: {$soldeActuel} FCFA.";
            $msgJustinPublic = "Confirmation encaissement validé pour le dossier {$ref}.";

            $this->dispatchWithFallback(
                canal: 'whatsapp',
                filePriorite: 'critique-securite',
                destinataireType: 'justin',
                destinataireIdentifiant: $justin->telephone ?? $justin->email,
                sujet: 'Encaissement validé - ' . $ref,
                contenuPublic: $msgJustinPublic,
                contenuConfidentiel: $msgJustinConfidentiel,
                montant: $montant,
                userId: $justin->id,
                referenceEvenement: $ref
            );
        }

        // 2. PALIER NOTIFICATIONS PAIEMENT : Reçu et code de réservation pour le Client
        if ($client) {
            $msgClient = "E-MOBILIER : Votre règlement de {$montant} FCFA pour la référence {$ref} a été validé avec succès. Votre code de réservation est {$ref}. Reçu disponible sur votre espace.";

            $this->dispatchWithFallback(
                canal: 'sms',
                filePriorite: 'notifications-paiement',
                destinataireType: 'client',
                destinataireIdentifiant: $client->telephone ?? $client->email,
                sujet: 'Confirmation de paiement - ' . $ref,
                contenuPublic: $msgClient,
                contenuConfidentiel: null,
                montant: $montant,
                userId: $client->id,
                referenceEvenement: $ref
            );

            // Notification interne client
            NotificationInterne::create([
                'user_id' => $client->id,
                'type' => 'paiement',
                'titre' => 'Paiement confirmé',
                'message' => $msgClient,
                'data' => [
                    'reference' => $ref,
                    'montant' => $montant,
                    'paiement_id' => $paiement->id,
                ],
            ]);
        }

        // 3. PALIER NOTIFICATIONS PAIEMENT : Notification Opérationnelle pour la Secrétaire & Responsables
        // RÈGLE ANTI-CONTOURNEMENT ABSOLUE : Zéro montant, Zéro téléphone/email client
        $adminsSecondaires = User::role(['Secrétaire', 'Responsable de zone'])->get();
        foreach ($adminsSecondaires as $admin) {
            $msgOperationnel = "Nouveau dossier payé et validé (Ref: {$ref}). Prêt pour assignation ou suivi logistique terrain.";

            // Notification interne in-app
            NotificationInterne::create([
                'user_id' => $admin->id,
                'type' => 'visite',
                'titre' => 'Nouvelle opération validée',
                'message' => $msgOperationnel,
                'data' => [
                    'reference' => $ref,
                    'paiement_id' => $paiement->id,
                    'type_operation' => $paiement->payment_type,
                    // Exclusion absolue de montants et coordonnées
                ],
            ]);

            // Notification Push
            $this->push->sendToUser($admin->id, 'Nouvelle opération validée', $msgOperationnel);

            // Audit
            NotificationAuditLog::create([
                'reference_evenement' => $ref,
                'file_priorite' => 'notifications-paiement',
                'canal' => 'push',
                'destinataire_type' => 'admin_secondaire',
                'destinataire_identifiant' => "USER#{$admin->id} ({$admin->statut})",
                'sujet' => 'Alerte opérationnelle dossier ' . $ref,
                'contenu_public' => $msgOperationnel,
                'contenu_confidentiel' => null,
                'montant' => null, // STRICTEMENT PURGÉ
                'statut' => 'envoye',
                'tentatives' => 1,
                'latence_ms' => 5,
            ]);
        }
    }

    /**
     * Expédition prioritaire du code OTP de retrait pour Justin MAGNIDE.
     */
    public function notifierOtpRetrait(Retrait $retrait, string $codeOtp): void
    {
        $justin = User::where('email', config('emobilier.super_admin_principal_email'))->first();
        if (! $justin) {
            return;
        }

        $msgConfidentiel = "CODE DE SÉCURITÉ RETRAIT : Votre code OTP est [{$codeOtp}] pour autoriser le virement de {$retrait->montant} FCFA vers {$retrait->compte_beneficiaire}. Valable 3 minutes. Ne le transmettez à personne.";
        $msgPublic = "Code de confirmation OTP expédié pour l'ordre de retrait.";

        $this->dispatchWithFallback(
            canal: 'whatsapp',
            filePriorite: 'critique-securite',
            destinataireType: 'justin',
            destinataireIdentifiant: $justin->telephone ?? '+22997000001',
            sujet: 'Code OTP Retrait - ' . $retrait->reference_retrait,
            contenuPublic: $msgPublic,
            contenuConfidentiel: $msgConfidentiel,
            montant: (float) $retrait->montant,
            userId: $justin->id,
            referenceEvenement: $retrait->reference_retrait
        );
    }

    /**
     * Alerte de sécurité immédiate en cas de tentative d'intrusion financière.
     */
    public function notifierAlerteSecurite(string $typeAlerte, string $details): void
    {
        $justin = User::where('email', config('emobilier.super_admin_principal_email'))->first();
        if (! $justin) {
            return;
        }

        $msgConfidentiel = "ALERTE SÉCURITÉ CRITIQUE : [{$typeAlerte}] {$details}. Mesure de confinement active.";

        $this->dispatchWithFallback(
            canal: 'whatsapp',
            filePriorite: 'critique-securite',
            destinataireType: 'justin',
            destinataireIdentifiant: $justin->telephone ?? '+22997000001',
            sujet: 'ALERTE SÉCURITÉ - ' . $typeAlerte,
            contenuPublic: 'Alerte de sécurité système enregistrée.',
            contenuConfidentiel: $msgConfidentiel,
            montant: null,
            userId: $justin->id,
            referenceEvenement: 'SEC-' . time()
        );
    }

    /**
     * Moteur d'expédition avec repli automatique WhatsApp -> SMS en cas d'échec.
     */
    public function dispatchWithFallback(
        string $canal,
        string $filePriorite,
        string $destinataireType,
        ?string $destinataireIdentifiant,
        string $sujet,
        string $contenuPublic,
        ?string $contenuConfidentiel = null,
        ?float $montant = null,
        ?int $userId = null,
        ?string $referenceEvenement = null
    ): NotificationAuditLog {
        $messageToSend = $contenuConfidentiel ?? $contenuPublic;
        $telephone = $destinataireIdentifiant ?? '+22900000000';
        $statut = 'en_attente';
        $tentatives = 0;
        $erreur = null;
        $canalEffectif = $canal;
        $totalLatency = 0;

        // Tentative 1 : Canal initial (ex: WhatsApp)
        $tentatives++;
        if ($canal === 'whatsapp') {
            $result = $this->whatsapp->send($telephone, $messageToSend);
            $totalLatency += $result['latence_ms'] ?? 10;

            if ($result['success']) {
                $statut = 'envoye';
            } else {
                // Échec WhatsApp -> Bascule de repli immédiate sur SMS Transactionnel
                $tentatives++;
                $smsResult = $this->sms->send($telephone, $messageToSend);
                $totalLatency += $smsResult['latence_ms'] ?? 15;

                if ($smsResult['success']) {
                    $statut = 'replie_sms';
                    $canalEffectif = 'sms';
                } else {
                    $statut = 'echec';
                    $erreur = "Échec WhatsApp ({$result['erreur']}) + Échec Repli SMS ({$smsResult['erreur']})";
                }
            }
        } elseif ($canal === 'sms') {
            $result = $this->sms->send($telephone, $messageToSend);
            $totalLatency += $result['latence_ms'] ?? 10;
            $statut = $result['success'] ? 'envoye' : 'echec';
            $erreur = $result['erreur'] ?? null;
        } elseif ($canal === 'push' && $userId) {
            $result = $this->push->sendToUser($userId, $sujet, $contenuPublic);
            $totalLatency += $result['latence_ms'] ?? 5;
            $statut = $result['success'] ? 'envoye' : 'echec';
            $erreur = $result['erreur'] ?? null;
        } else {
            $statut = 'envoye';
            $totalLatency = 2;
        }

        // Enregistrement immuable dans le journal d'audit des notifications
        return NotificationAuditLog::create([
            'reference_evenement' => $referenceEvenement,
            'file_priorite' => $filePriorite,
            'canal' => $canalEffectif,
            'destinataire_type' => $destinataireType,
            'destinataire_identifiant' => $destinataireIdentifiant,
            'sujet' => $sujet,
            'contenu_public' => $contenuPublic,
            'contenu_confidentiel' => $contenuConfidentiel,
            'montant' => $montant,
            'statut' => $statut,
            'tentatives' => $tentatives,
            'erreur_technique' => $erreur,
            'latence_ms' => $totalLatency,
            'metadata' => [
                'canal_initial' => $canal,
                'user_id' => $userId,
            ],
        ]);
    }
}

