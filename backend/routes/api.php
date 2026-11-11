<?php

use App\Http\Controllers\Api\Admin\AdminUserController;
use App\Http\Controllers\Api\Admin\AuditLogController;
use App\Http\Controllers\Api\Admin\DemandeClientAdminController;
use App\Http\Controllers\Api\Admin\DemasquageController;
use App\Http\Controllers\Api\Admin\LegalDocumentController;
use App\Http\Controllers\Api\Admin\SystemHealthController;
use App\Http\Controllers\Api\Admin\VisiteAdminController;
use App\Http\Controllers\Api\Admin\VueDemandeClient;
use App\Http\Controllers\Api\Admin\ZoneController;
use App\Http\Controllers\Api\Client\PosteController;
use App\Http\Controllers\Api\Client\PosteRechercheController;
use App\Http\Controllers\Api\Client\VisitController;
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

// Webhook public Kkiapay (appelé par les serveurs Kkiapay)
Route::post('/kkiapay/webhook', [KkiapayController::class, 'webhook']);

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

    // Configuration et vérification de paiement Kkiapay
    Route::get('/kkiapay/config', [KkiapayController::class, 'config']);
    Route::post('/kkiapay/verify', [KkiapayController::class, 'verify']);

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
    });

    // Enregistrement du token pour les notifications push
    Route::post('/user/device-token', [VisitController::class, 'registerDeviceToken']);
    Route::post('/device-token', [VisitController::class, 'registerDeviceToken']);
});


