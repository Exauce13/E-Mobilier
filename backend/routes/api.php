<?php

use App\Http\Controllers\Api\InscriptionController;
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

// Routes protégées par token Sanctum
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/profil', [InscriptionController::class, 'profil']);
    Route::post('/deconnexion', [InscriptionController::class, 'deconnexion']);

    Route::get('/user', function (Request $request) {
        return $request->user();
    });
});
