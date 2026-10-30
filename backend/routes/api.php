<?php

use App\Http\Controllers\Api\InscriptionController;
use App\Http\Controllers\Api\KkiapayController;
use App\Http\Controllers\Api\PosteController;
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

// Routes protégées par token Sanctum
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/profil', [InscriptionController::class, 'profil']);
    Route::post('/deconnexion', [InscriptionController::class, 'deconnexion']);

    // Gestion Kkiapay (configuration widget et vérification)
    Route::get('/kkiapay/config', [KkiapayController::class, 'config']);
    Route::post('/kkiapay/verify', [KkiapayController::class, 'verify']);

    // Gestion des annonces et postes de propriétés
    Route::get('/mes-proprietes', [PosteController::class, 'mesProprietes']);
    Route::post('/proprietes', [PosteController::class, 'posteProprietes']);
    Route::post('/poste-proprietes', [PosteController::class, 'posteProprietes']);
    Route::get('/proprietes/{id}', [PosteController::class, 'show']);
    Route::match(['put', 'patch', 'post'], '/proprietes/{id}', [PosteController::class, 'update']);
    Route::delete('/proprietes/{id}', [PosteController::class, 'destroy']);

    Route::get('/user', function (Request $request) {
        return $request->user();
    });
});
