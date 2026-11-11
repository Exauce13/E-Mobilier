<?php

namespace App\Http\Controllers\Api\Finance;

use App\Http\Controllers\Controller;
use App\Models\WebhookLog;
use Illuminate\Http\JsonResponse;

class TechWebhookHealthController extends Controller
{
    /**
     * Moniteur de santé et de connectivité technique des webhooks.
     * Accessible au Super Admin Technique et au Super Admin Principal.
     * RÈGLE STRICTE : Purgé de tout montant financier et de tout contenu monétaire.
     */
    public function health(): JsonResponse
    {
        $webhooks = WebhookLog::select([
            'id',
            'gateway',
            'event_type',
            'status_http',
            'is_signature_valid',
            'reconciliation_status',
            'ip_address',
            'created_at',
        ])
        ->orderBy('id', 'desc')
        ->limit(30)
        ->get();

        $stats = [
            'total_reçus' => WebhookLog::count(),
            'signatures_valides' => WebhookLog::where('is_signature_valid', true)->count(),
            'signatures_invalides' => WebhookLog::where('is_signature_valid', false)->count(),
            'doublons_neutralises' => WebhookLog::where('reconciliation_status', 'doublon_ignore')->count(),
            'reconciliations_reussies' => WebhookLog::where('reconciliation_status', 'reconcilie')->count(),
        ];

        return response()->json([
            'success' => true,
            'message' => 'Diagnostic technique des webhooks de paiement récupéré (Zéro donnée financière exposée).',
            'passerelle_active' => config('emobilier.payment_gateway', 'kkiapay'),
            'statistiques_techniques' => $stats,
            'derniers_evenements' => $webhooks,
        ]);
    }
}

