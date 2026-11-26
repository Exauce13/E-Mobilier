<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Demande_client;
use App\Models\Paiement;
use App\Models\Proprietes;
use App\Models\Visite_client;
use App\Services\KkiapayService;
use App\Services\PlatformSettingsService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class KkiapayController extends Controller
{
    protected KkiapayService $kkiapayService;
    protected PlatformSettingsService $settings;

    public function __construct(KkiapayService $kkiapayService, PlatformSettingsService $settings)
    {
        $this->kkiapayService = $kkiapayService;
        $this->settings = $settings;
    }

    /**
     * Retourne la configuration Kkiapay pour le frontend (widget de paiement).
     * Inclut les tarifs dynamiques de la plateforme selon le rôle de l'utilisateur connecté.
     */
    public function config(Request $request): JsonResponse
    {
        $user = $request->user();
        $tarifs = $this->settings->getTarifs();

        // Tarifs officiels dynamiques (depuis platform_settings)
        $montantPoste = $tarifs['post_client'];
        if ($user && $user->hasRole('Agent mobilier')) {
            $montantPoste = $tarifs['post_agent'];
        } elseif ($user && $user->hasRole('Admin')) {
            $montantPoste = 0; // Dispensé
        }

        $widgetConfig = $this->kkiapayService->getWidgetConfig(
            $montantPoste,
            "Frais de publication ({$montantPoste} FCFA) - " . $this->settings->getString('platform_name', 'E-Mobilier')
        );

        return response()->json([
            'success' => true,
            'data' => [
                'widget' => $widgetConfig,
                'pricing' => [
                    'post_client' => $tarifs['post_client'],
                    'post_agent' => $tarifs['post_agent'],
                    'unlock_details' => $tarifs['deblocage_coordonnees'],
                    'visit_fee' => $tarifs['visite'],
                    'current_user_post_fee' => $montantPoste,
                ],
                'user' => $user ? [
                    'name' => $user->name,
                    'phone' => $user->telephone,
                    'email' => $user->email,
                ] : null,
            ],
        ]);
    }

    /**
     * Vérification serveur-à-serveur déléguée à l'autorité unique PaymentController::verify.
     */
    public function verify(Request $request): JsonResponse
    {
        return app(\App\Http\Controllers\Api\Finance\PaymentController::class)->verify($request);
    }

    /**
     * Webhook délégué à l'autorité unique PaymentController::webhook
     * (vérification de signature x-kkiapay-secret + vérification serveur-à-serveur + idempotence).
     */
    public function webhook(Request $request): JsonResponse
    {
        return app(\App\Http\Controllers\Api\Finance\PaymentController::class)->webhook($request, 'kkiapay');
    }
}
