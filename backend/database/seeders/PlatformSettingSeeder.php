<?php

namespace Database\Seeders;

use App\Models\PlatformSetting;
use App\Services\PlatformSettingsService;
use Illuminate\Database\Seeder;

class PlatformSettingSeeder extends Seeder
{
    /**
     * Initialise les paramètres administrables de la plateforme (idempotent :
     * ne remplace pas une valeur déjà modifiée par un administrateur).
     */
    public function run(): void
    {
        $defaults = [
            // --- Tarifs officiels (publics, éditables uniquement par le propriétaire financier) ---
            [
                'cle' => 'tarif_deblocage_coordonnees',
                'valeur' => (string) config('emobilier.tarifs_officiels.deblocage_coordonnees', 50),
                'type' => 'integer',
                'groupe' => 'tarifs',
                'label' => 'Frais de déblocage des coordonnées (FCFA)',
                'description' => 'Montant unique facturé pour débloquer les coordonnées et documents d\'un bien.',
                'is_public' => true,
            ],
            [
                'cle' => 'tarif_visite',
                'valeur' => (string) config('emobilier.tarifs_officiels.visite', 500),
                'type' => 'integer',
                'groupe' => 'tarifs',
                'label' => 'Frais de visite physique (FCFA)',
                'description' => 'Montant obligatoire pour réserver une visite terrain encadrée par E-Mobilier.',
                'is_public' => true,
            ],
            [
                'cle' => 'tarif_post_client',
                'valeur' => (string) config('emobilier.tarifs_officiels.post_client', 500),
                'type' => 'integer',
                'groupe' => 'tarifs',
                'label' => 'Frais de publication — Particulier / Propriétaire (FCFA)',
                'description' => 'Frais de soumission d\'une annonce immobilière par un compte Client.',
                'is_public' => true,
            ],
            [
                'cle' => 'tarif_post_agent',
                'valeur' => (string) config('emobilier.tarifs_officiels.post_agent', 100),
                'type' => 'integer',
                'groupe' => 'tarifs',
                'label' => 'Frais de publication — Agent mobilier (FCFA)',
                'description' => 'Frais préférentiels de publication d\'annonce pour un Agent mobilier agréé.',
                'is_public' => true,
            ],

            // --- Finance & Décaissements (confidentiels, Justin MAGNIDE uniquement) ---
            [
                'cle' => 'retrait_montant_minimum',
                'valeur' => '1000',
                'type' => 'integer',
                'groupe' => 'finance',
                'label' => 'Montant minimum de retrait (FCFA)',
                'description' => 'Seuil minimum requis pour ordonner un décaissement depuis le coffre-fort financier.',
                'is_public' => false,
            ],
            [
                'cle' => 'beneficiaire_titulaire',
                'valeur' => (string) config('emobilier.beneficiaire_officiel.titulaire', 'MAGNIDE JUSTIN - E-MOBILIER SARL'),
                'type' => 'string',
                'groupe' => 'finance',
                'label' => 'Titulaire du compte bénéficiaire officiel',
                'description' => 'Nom officiel du bénéficiaire des virements de décaissement.',
                'is_public' => false,
            ],
            [
                'cle' => 'beneficiaire_momo',
                'valeur' => (string) config('emobilier.beneficiaire_officiel.mobile_money', '+229 97 00 00 01'),
                'type' => 'string',
                'groupe' => 'finance',
                'label' => 'Numéro Mobile Money officiel',
                'description' => 'Compte Mobile Money en liste blanche destiné aux retraits.',
                'is_public' => false,
            ],
            [
                'cle' => 'beneficiaire_rib',
                'valeur' => (string) config('emobilier.beneficiaire_officiel.rib_bancaire', 'BJ063 01001 00000000000 45'),
                'type' => 'string',
                'groupe' => 'finance',
                'label' => 'RIB bancaire officiel',
                'description' => 'Coordonnées bancaires en liste blanche destinées aux virements.',
                'is_public' => false,
            ],

            // --- Sécurité & Anti-contournement ---
            [
                'cle' => 'demasquage_default_ttl_minutes',
                'valeur' => (string) config('emobilier.demasquage_default_ttl_minutes', 120),
                'type' => 'integer',
                'groupe' => 'securite',
                'label' => 'Durée par défaut d\'un démasquage (minutes)',
                'description' => 'Durée de validité par défaut d\'une autorisation temporaire de lecture de coordonnées.',
                'is_public' => false,
            ],
            [
                'cle' => 'demasquage_max_ttl_minutes',
                'valeur' => (string) config('emobilier.demasquage_max_ttl_minutes', 1440),
                'type' => 'integer',
                'groupe' => 'securite',
                'label' => 'Durée maximale d\'un démasquage (minutes)',
                'description' => 'Plafond autorisé lors de l\'approbation d\'une demande de démasquage (max 1440 = 24h).',
                'is_public' => false,
            ],

            // --- Coordonnées publiques & Identité de la plateforme ---
            [
                'cle' => 'platform_name',
                'valeur' => 'E-Mobilier',
                'type' => 'string',
                'groupe' => 'general',
                'label' => 'Nom commercial de la plateforme',
                'description' => 'Nom affiché dans l\'application et les communications publiques.',
                'is_public' => true,
            ],
            [
                'cle' => 'platform_legal_name',
                'valeur' => 'E-MOBILIER SARL (Bénin)',
                'type' => 'string',
                'groupe' => 'general',
                'label' => 'Raison sociale (reçus officiels)',
                'description' => 'Mentions légales de l\'émetteur sur les quittances et reçus de paiement.',
                'is_public' => true,
            ],
            [
                'cle' => 'support_phone',
                'valeur' => '+229 01 97 00 11 22',
                'type' => 'string',
                'groupe' => 'contact',
                'label' => 'Téléphone du support client',
                'description' => 'Numéro officiel affiché en pied de page et dans l\'aide.',
                'is_public' => true,
            ],
            [
                'cle' => 'support_email',
                'valeur' => 'contact@e-mobilier.bj',
                'type' => 'string',
                'groupe' => 'contact',
                'label' => 'Adresse e-mail de contact',
                'description' => 'E-mail officiel du service client et de la plateforme.',
                'is_public' => true,
            ],
            [
                'cle' => 'office_address',
                'valeur' => 'Cadjehoun, Cotonou',
                'type' => 'string',
                'groupe' => 'contact',
                'label' => 'Adresse du siège social',
                'description' => 'Localisation des bureaux E-Mobilier affichée aux utilisateurs.',
                'is_public' => true,
            ],
        ];

        foreach ($defaults as $item) {
            PlatformSetting::firstOrCreate(
                ['cle' => $item['cle']],
                $item
            );
        }

        app(PlatformSettingsService::class)->clearCache();
    }
}
