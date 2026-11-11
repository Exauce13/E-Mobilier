<?php

use App\Http\Controllers\Api\Admin\AdminUserController;
use App\Http\Controllers\Api\Admin\AgentKycController;
use App\Http\Controllers\Api\Admin\AuditLogController;
use App\Http\Controllers\Api\Admin\CatalogModerationController;
use App\Http\Controllers\Api\Admin\DemandeClientAdminController;
use App\Http\Controllers\Api\Admin\DemasquageController;
use App\Http\Controllers\Api\Admin\LegalDocumentController;
use App\Http\Controllers\Api\Admin\OperationalMetricsController;
use App\Http\Controllers\Api\Admin\SearchRequestMatchingController;
use App\Http\Controllers\Api\Admin\SecurityAlertController;
use App\Http\Controllers\Api\Admin\SystemHealthController;
use App\Http\Controllers\Api\Admin\VisitOperationalController;
use App\Http\Controllers\Api\Admin\VisiteAdminController;
use App\Http\Controllers\Api\Admin\VueDemandeClient;
use App\Http\Controllers\Api\Admin\ZoneController;
use App\Http\Controllers\Api\Client\PosteController;
use App\Http\Controllers\Api\Client\PosteRechercheController;
use App\Http\Controllers\Api\Client\VisitController;
use App\Http\Controllers\Api\Finance\FinancialNotificationAuditController;
use App\Http\Controllers\Api\Finance\FinancialSecurityController;
use App\Http\Controllers\Api\Finance\FinancialVaultController;
use App\Http\Controllers\Api\Finance\PaymentController;
use App\Http\Controllers\Api\Finance\TechWebhookHealthController;
use App\Http\Controllers\Api\Notification\DeviceTokenController;
use App\Http\Controllers\Api\Notification\NotificationInterneController;
use App\Http\Controllers\Api\Tech\TechNotificationLogController;
use App\Http\Controllers\Api\InscriptionController;
use App\Http\Controllers\Api\KkiapayController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes - E-Mobilier
|--------------------------------------------------------------------------
*/

// Routes publiques d'inscription et d'authentification
Route::post('/inscription', [InscriptionController::class, 'inscription']);
Route::post('/authentification', [InscriptionController::class, 'authentification']);

// Webhook public Kkiapay / passerelle agnostique (appelé par les serveurs de paiement)
Route::post('/kkiapay/webhook', [PaymentController::class, 'webhook']);
Route::post('/paiements/webhook/{gateway?}', [PaymentController::class, 'webhook']);

// Fil d'actualité public des biens immobiliers publiés
Route::get('/proprietes', [PosteController::class, 'filActualite']);
Route::get('/fil-actualite', [PosteController::class, 'filActualite']);

// Conformité légale publique : consultation de la version active des CGU
Route::get('/cgu/courante', [LegalDocumentController::class, 'cguCourante']);

// Routes protégées par token Sanctum et compte actif
Route::middleware(['auth:sanctum', 'active'])->group(function () {
    // Profil et compte utilisateur commun
    Route::get('/profil', [InscriptionController::class, 'profil']);
    Route::post('/deconnexion', [InscriptionController::class, 'deconnexion']);
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // Configuration et vérification de paiement Kkiapay / Passerelle agnostique
    Route::get('/kkiapay/config', [KkiapayController::class, 'config']);
    Route::post('/kkiapay/verify', [PaymentController::class, 'verify']);
    Route::post('/paiements/initier', [PaymentController::class, 'initier']);
    Route::post('/paiements/verifier', [PaymentController::class, 'verify']);
    Route::get('/paiements/{ref}/recu', [PaymentController::class, 'recu']);

    // Gestion des propriétés et annonces (Client, Agent mobilier, Admin)
    Route::middleware('role:Client|Agent mobilier|Admin')->group(function () {
        Route::get('/mes-proprietes', [PosteController::class, 'mesProprietes']);
        Route::post('/proprietes', [PosteController::class, 'posteProprietes']);
        Route::post('/poste-proprietes', [PosteController::class, 'posteProprietes']);
        Route::get('/proprietes/{id}', [PosteController::class, 'show']);
        Route::match(['put', 'patch', 'post'], '/proprietes/{id}', [PosteController::class, 'update']);
        Route::delete('/proprietes/{id}', [PosteController::class, 'destroy']);

        // Déblocage des détails et coordonnées du bien (50 FCFA - paiement unique)
        Route::post('/proprietes/{id}/debloquer', [PosteController::class, 'debloquerDetails']);
        Route::post('/proprietes/{id}/payer-vue', [PosteController::class, 'debloquerDetails']);
    });

    // Demandes de visites physiques (500 FCFA obligatoires) - Client, Agent mobilier et Admin
    Route::middleware('role:Client|Agent mobilier|Admin')->group(function () {
        Route::get('/mes-visites', [VisitController::class, 'mesVisites']);
        Route::get('/visites', [VisitController::class, 'mesVisites']);
        Route::post('/visites', [VisitController::class, 'demandeVisite']);
        Route::post('/demande-visite', [VisitController::class, 'demandeVisite']);
        Route::get('/visites/{id}', [VisitController::class, 'show']);
        Route::post('/visites/{id}/annuler', [VisitController::class, 'annulerVisite']);
    });

    // Gestion des demandes de recherche de biens (Client et Admin)
    Route::middleware('role:Client|Admin')->group(function () {
        Route::get('/mes-demandes-recherche', [PosteRechercheController::class, 'mesDemandes']);
        Route::get('/demandes-recherche', [PosteRechercheController::class, 'mesDemandes']);
        Route::post('/demandes-recherche', [PosteRechercheController::class, 'posteDemandeRecherche']);
        Route::post('/poste-demande-recherche', [PosteRechercheController::class, 'posteDemandeRecherche']);
        Route::get('/demandes-recherche/{id}', [PosteRechercheController::class, 'show']);
        Route::match(['put', 'patch', 'post'], '/demandes-recherche/{id}', [PosteRechercheController::class, 'modifierDemande']);
        Route::delete('/demandes-recherche/{id}', [PosteRechercheController::class, 'supprimerDemande']);
    });

    // =========================================================================
    // PHASE 2 : ANTI-CONTOURNEMENT, MASQUAGE DYNAMIQUE & DÉMASQUAGE (TTL)
    // =========================================================================

    // Consultation des demandes clients & visites (Masquage dynamique + Portée par zone)
    Route::middleware(['role:Super Admin Principal|Super Admin Technique|Secrétaire|Responsable de zone|Admin', 'charte.signed'])->group(function () {
        Route::get('/admin/demandes-clients', [DemandeClientAdminController::class, 'index']);
        Route::get('/admin/toutes-les-demandes', [DemandeClientAdminController::class, 'index']);
        Route::get('/admin/demandes-clients/{id}', [DemandeClientAdminController::class, 'show']);

        Route::get('/admin/visites', [VisiteAdminController::class, 'index']);
        Route::get('/admin/visites/{id}', [VisiteAdminController::class, 'show']);
        Route::patch('/admin/visites/{id}/statut', [VisiteAdminController::class, 'updateStatut']);

        // Consultation unitaire tracée des coordonnées (Vérification TTL stricte now < expires_at)
        Route::get('/admin/dossiers/{type}/{id}/coordonnees', [DemasquageController::class, 'coordonnees']);
    });

    // Affectation de zone pour les visites (Super Admins et Secrétaire)
    Route::middleware(['role:Super Admin Principal|Super Admin Technique|Secrétaire|Admin', 'charte.signed'])->group(function () {
        Route::post('/admin/visites/{id}/assigner-zone', [VisiteAdminController::class, 'assignerZone']);
    });

    // Workflow de demande de démasquage (Secrétaire et Responsable de zone)
    Route::middleware(['role:Secrétaire|Responsable de zone|Admin', 'charte.signed'])->group(function () {
        Route::post('/admin/demasquages/demander', [DemasquageController::class, 'demander']);
        Route::get('/admin/demasquages/mes-demandes', [DemasquageController::class, 'mesDemandes']);
    });

    // Arbitrage des démasquages (Super Administrateurs : Principal et Technique)
    Route::middleware('super_admin')->group(function () {
        Route::get('/admin/demasquages/en-attente', [DemasquageController::class, 'enAttente']);
        Route::post('/admin/demasquages/{id}/approuver', [DemasquageController::class, 'approuver']);
        Route::post('/admin/demasquages/{id}/refuser', [DemasquageController::class, 'refuser']);
        Route::post('/admin/demasquages/{id}/revoquer', [DemasquageController::class, 'revoquer']);
    });

    // =========================================================================
    // SECTION 4 : LES 5 BRIQUES OPÉRATIONNELLES (CŒUR MÉTIER IMMOBILIER)
    // =========================================================================

    // BRIQUE A : Modération du Catalogue & Audit des Titres Fonciers
    Route::middleware(['role:Super Admin Principal|Super Admin Technique|Secrétaire|Responsable de zone|Admin', 'charte.signed'])->group(function () {
        Route::get('/admin/proprietes/en-attente', [CatalogModerationController::class, 'enAttente']);
        Route::post('/admin/proprietes/{id}/marquer-conclu', [CatalogModerationController::class, 'marquerConclu']);
    });
    Route::middleware(['role:Super Admin Principal|Super Admin Technique|Secrétaire|Admin', 'charte.signed'])->group(function () {
        Route::post('/admin/proprietes/{id}/valider', [CatalogModerationController::class, 'valider']);
        Route::post('/admin/proprietes/{id}/rejeter', [CatalogModerationController::class, 'rejeter']);
        Route::get('/admin/proprietes/{id}/documents', [CatalogModerationController::class, 'documents']);
    });

    // BRIQUE B : Cycle Opérationnel des Visites Terrain & Comptes-Rendus
    Route::middleware(['role:Super Admin Principal|Super Admin Technique|Secrétaire|Responsable de zone|Admin', 'charte.signed'])->group(function () {
        Route::post('/admin/visites/{id}/planifier', [VisitOperationalController::class, 'planifier']);
        Route::post('/admin/visites/{id}/compte-rendu', [VisitOperationalController::class, 'compteRendu']);
        Route::post('/admin/visites/{id}/cloturer', [VisitOperationalController::class, 'cloturer']);
        Route::post('/admin/visites/{id}/escalader-offre', [VisitOperationalController::class, 'escaladerOffre']);
    });

    // BRIQUE C : Gestion des Demandes de Recherche & Moteur de Matching
    Route::middleware(['role:Super Admin Principal|Super Admin Technique|Secrétaire|Responsable de zone|Admin', 'charte.signed'])->group(function () {
        Route::post('/admin/demandes-clients/{id}/prendre-en-charge', [SearchRequestMatchingController::class, 'prendreEnCharge']);
        Route::get('/admin/demandes-clients/{id}/matching-biens', [SearchRequestMatchingController::class, 'matchingBiens']);
        Route::post('/admin/demandes-clients/{id}/associer-bien', [SearchRequestMatchingController::class, 'associerBien']);
        Route::post('/admin/demandes-clients/{id}/cloturer', [SearchRequestMatchingController::class, 'cloturer']);
    });

    // BRIQUE D : Agrément, Contrôle & KYC des Agents Mobiliers
    Route::middleware(['role:Super Admin Principal|Super Admin Technique|Secrétaire|Admin', 'charte.signed'])->group(function () {
        Route::get('/admin/agents-mobiliers', [AgentKycController::class, 'index']);
        Route::get('/admin/agents-mobiliers/{id}/dossier', [AgentKycController::class, 'dossier']);
        Route::post('/admin/agents-mobiliers/{id}/approuver', [AgentKycController::class, 'approuver']);
        Route::post('/admin/agents-mobiliers/{id}/suspendre', [AgentKycController::class, 'suspendre']);
    });

    // BRIQUE E : Tableaux de Bord de Performance Opérationnelle (Non-Financiers)
    Route::middleware(['role:Super Admin Principal|Secrétaire|Admin', 'charte.signed'])->group(function () {
        Route::get('/admin/metriques/operations-globales', [OperationalMetricsController::class, 'operationsGlobales']);
    });
    Route::middleware(['role:Super Admin Principal|Super Admin Technique|Secrétaire|Responsable de zone|Admin', 'charte.signed'])->group(function () {
        Route::get('/admin/metriques/zone-performance', [OperationalMetricsController::class, 'zonePerformance']);
    });

    // =========================================================================
    // PHASE 1 : FONDATIONS RBAC, GOUVERNANCE, ZONES & CONFORMITÉ LÉGALE
    // =========================================================================

    // Consultation des zones géographiques (Accessible à tous les profils administrateurs)
    Route::middleware('role:Super Admin Principal|Super Admin Technique|Secrétaire|Responsable de zone|Admin')->group(function () {
        Route::get('/admin/zones', [ZoneController::class, 'index']);
    });

    // Signature obligatoire de la Charte de Non-Contournement (Secrétaire, Responsable de zone)
    Route::middleware('role:Secrétaire|Responsable de zone|Admin')->group(function () {
        Route::post('/admin/charte/signer', [LegalDocumentController::class, 'signerCharte']);
    });

    // Administration Globale & Système (Super Administrateurs : Principal et Technique)
    Route::middleware('super_admin')->group(function () {
        // Gestion des zones géographiques
        Route::post('/admin/zones', [ZoneController::class, 'store']);
        Route::patch('/admin/zones/{id}', [ZoneController::class, 'update']);

        // Gestion des utilisateurs et rôles (Anti-escalade & sanctuarisation)
        Route::get('/admin/utilisateurs', [AdminUserController::class, 'index']);
        Route::post('/admin/utilisateurs', [AdminUserController::class, 'store']);
        Route::patch('/admin/utilisateurs/{id}/role-zone', [AdminUserController::class, 'updateRoleZone']);
        Route::post('/admin/utilisateurs/{id}/statut', [AdminUserController::class, 'updateStatut']);

        // Publication de nouvelles versions de documents légaux
        Route::post('/admin/cgu', [LegalDocumentController::class, 'publierDocument']);

        // Journal d'audit de sécurité (Filtrage automatique hors finance pour Tech)
        Route::get('/admin/audit-logs', [AuditLogController::class, 'index']);

        // Diagnostic de santé et de charge de l'infrastructure
        Route::get('/tech/system-health', [SystemHealthController::class, 'health']);

        // Moniteur technique des webhooks de paiement (Métadonnées seules, zéro finance)
        Route::get('/tech/webhooks/health', [TechWebhookHealthController::class, 'health']);

        // PHASE 4 : Journal technique des canaux d'envoi & relance DLQ (Zéro finance)
        Route::get('/tech/notifications/logs', [TechNotificationLogController::class, 'index']);
        Route::post('/tech/notifications/{id}/relancer', [TechNotificationLogController::class, 'relancer']);

        // PHASE 5 : Révocation d'urgence des démasquages & Journal des alertes de sécurité
        Route::post('/admin/securite/revoquer-tous-demasquages', [SecurityAlertController::class, 'revoquerTousDemasquages']);
        Route::get('/admin/securite/alertes', [SecurityAlertController::class, 'alertes']);
    });

    // =========================================================================
    // PHASE 3 : COFFRE-FORT FINANCIER & RETRAITS (MAGNIDE Justin UNIQUEMENT)
    // =========================================================================
    Route::middleware('financial_owner')->group(function () {
        Route::get('/finance/tableau-de-bord', [FinancialVaultController::class, 'tableauDeBord']);
        Route::get('/finance/transactions', [FinancialVaultController::class, 'transactions']);
        Route::get('/finance/transactions/export', [FinancialVaultController::class, 'export']);
        Route::get('/finance/webhooks', [FinancialVaultController::class, 'webhooks']);
        Route::get('/finance/retraits', [FinancialVaultController::class, 'retraits']);

        // Décaissement (Payout) sécurisé par OTP vers compte officiel
        Route::post('/finance/retraits/initier', [FinancialVaultController::class, 'initierRetrait']);
        Route::post('/finance/retraits/{id}/confirmer-otp', [FinancialVaultController::class, 'confirmerOtp']);
        Route::post('/finance/retraits/{id}/annuler', [FinancialVaultController::class, 'annulerRetrait']);

        // PHASE 4 : Journal exhaustif des notifications financières expédiées (Justin MAGNIDE UNIQUEMENT)
        Route::get('/finance/notifications/audit', [FinancialNotificationAuditController::class, 'index']);

        // PHASE 5 : Scellement Cryptographique (HMAC Hash Chaining) & Coupe-Circuit des Retraits
        Route::post('/finance/securite/verifier-integrite', [FinancialSecurityController::class, 'verifierIntegrite']);
        Route::post('/finance/securite/geler-retraits', [FinancialSecurityController::class, 'gelerRetraits']);
        Route::post('/finance/securite/degeler-retraits', [FinancialSecurityController::class, 'degelerRetraits']);
        Route::get('/finance/securite/statut', [FinancialSecurityController::class, 'statut']);
    });

    // =========================================================================
    // PHASE 4 : NOTIFICATIONS IN-APP & GESTION DES JETONS PUSH (Tous profils)
    // =========================================================================
    Route::post('/user/device-token', [DeviceTokenController::class, 'store']);
    Route::delete('/user/device-token', [DeviceTokenController::class, 'destroy']);
    Route::post('/device-token', [DeviceTokenController::class, 'store']); // Compatibilité

    Route::get('/notifications', [NotificationInterneController::class, 'index']);
    Route::post('/notifications/{id}/lire', [NotificationInterneController::class, 'lire']);
    Route::post('/notifications/tout-lire', [NotificationInterneController::class, 'toutLire']);
});


