<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Demande_client;
use App\Models\Paiement;
use App\Models\Proprietes;
use App\Models\Visite_client;
use App\Services\KkiapayService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class KkiapayController extends Controller
{
    protected KkiapayService $kkiapayService;

    public function __construct(KkiapayService $kkiapayService)
    {
        $this->kkiapayService = $kkiapayService;
    }

    /**
     * Retourne la configuration Kkiapay pour le frontend (widget de paiement).
     * Inclut les tarifs de la plateforme selon le rôle de l'utilisateur connecté.
     */
    public function config(Request $request): JsonResponse
    {
        $user = $request->user();

        // Tarifs officiels E-Mobilier
        $montantPoste = 500; // Par défaut : tarif Client (500 FCFA)
        if ($user && $user->hasRole('Agent mobilier')) {
            $montantPoste = 100; // Tarif Agent (100 FCFA)
        } elseif ($user && $user->hasRole('Admin')) {
            $montantPoste = 0; // Dispensé
        }

        $widgetConfig = $this->kkiapayService->getWidgetConfig(
            $montantPoste,
            "Frais de publication ({$montantPoste} FCFA) - E-Mobilier"
        );

        return response()->json([
            'success' => true,
            'data' => [
                'widget' => $widgetConfig,
                'pricing' => [
                    'post_client' => 500,
                    'post_agent' => 100,
                    'unlock_details' => 500,
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
     * Vérifie manuellement une transaction Kkiapay via son transactionId.
     */
    public function verify(Request $request): JsonResponse
    {
        $transactionId = $request->input('transactionId')
            ?: $request->input('transaction_id')
            ?: $request->input('transaction_reference');

        if (! $transactionId) {
            return response()->json([
                'success' => false,
                'message' => 'L\'identifiant de transaction Kkiapay (transactionId) est requis.',
            ], 422);
        }

        $expectedAmount = (int) $request->input('amount', 0);
        $result = $this->kkiapayService->verifyTransaction($transactionId, $expectedAmount);

        // Vérifier si cette transaction est déjà liée à un paiement dans notre base
        $existingPaiement = Paiement::where('transaction_reference', $transactionId)->first();

        return response()->json([
            'success' => $result['success'],
            'message' => $result['message'],
            'data' => [
                'transaction_id' => $transactionId,
                'amount' => $result['amount'],
                'is_already_used' => $existingPaiement !== null,
                'paiement' => $existingPaiement,
                'raw' => $result['raw'] ?? null,
            ],
        ], $result['success'] ? 200 : 422);
    }

    /**
     * Webhook appelé de manière asynchrone par les serveurs Kkiapay.
     * Met à jour le statut du paiement et de l'entité liée (propriété, visite, demande).
     */
    public function webhook(Request $request): JsonResponse
    {
        $payload = $request->all();

        Log::info('Webhook Kkiapay reçu :', $payload);

        $transactionId = $payload['transactionId']
            ?? $payload['transaction_id']
            ?? $payload['reference']
            ?? null;

        if (! $transactionId) {
            return response()->json([
                'success' => false,
                'message' => 'Identifiant de transaction manquant dans le payload.',
            ], 400);
        }

        try {
            // Vérifier auprès de l'API Kkiapay pour garantir l'authenticité
            $verification = $this->kkiapayService->verifyTransaction($transactionId);
            $isSuccess = $verification['success'] || (strtoupper((string) ($payload['state'] ?? $payload['status'] ?? '')) === 'SUCCESS');

            $paiement = Paiement::where('transaction_reference', $transactionId)->first();

            if ($paiement) {
                $paiement->update([
                    'status' => $isSuccess ? 'successful' : 'failed',
                ]);

                // Si lié à une propriété, mettre à jour le statut si nécessaire
                if ($paiement->property_id && $isSuccess) {
                    Proprietes::where('id', $paiement->property_id)
                        ->where('status', 'pending_payment')
                        ->update(['status' => 'pending']);
                }

                // Si lié à une visite
                if ($paiement->payment_type === 'visit_fee' && $paiement->related_entity_id && $isSuccess) {
                    Visite_client::where('id', $paiement->related_entity_id)
                        ->update(['is_fee_paid' => true]);
                }

                // Si lié à une demande client
                if ($paiement->payment_type === 'search_post' && $paiement->related_entity_id && $isSuccess) {
                    Demande_client::where('id', $paiement->related_entity_id)
                        ->update(['is_paid' => true]);
                }

                Log::info("Paiement #{$paiement->id} mis à jour via webhook Kkiapay : " . ($isSuccess ? 'SUCCESS' : 'FAILED'));
            }

            return response()->json([
                'success' => true,
                'message' => 'Webhook traité avec succès.',
            ], 200);
        } catch (Exception $e) {
            Log::error('Erreur lors du traitement du webhook Kkiapay : ' . $e->getMessage(), [
                'payload' => $payload,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du traitement du webhook.',
            ], 500);
        }
    }
}
