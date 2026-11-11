<?php

namespace App\Http\Controllers\Api\Finance;

use App\Http\Controllers\Controller;
use App\Models\GrandLivre;
use App\Models\Retrait;
use App\Models\WebhookLog;
use App\Services\FinancialLedgerService;
use App\Services\PayoutService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FinancialVaultController extends Controller
{
    protected FinancialLedgerService $ledgerService;
    protected PayoutService $payoutService;

    public function __construct(FinancialLedgerService $ledgerService, PayoutService $payoutService)
    {
        $this->ledgerService = $ledgerService;
        $this->payoutService = $payoutService;
    }

    /**
     * Tableau de bord financier temps réel (Trésorerie, flux globaux, recettes).
     */
    public function tableauDeBord(): JsonResponse
    {
        $metrics = $this->ledgerService->getTableauDeBord();

        return response()->json([
            'success' => true,
            'message' => 'Tableau de bord financier de M. Justin MAGNIDE récupéré avec succès.',
            'data' => $metrics,
        ]);
    }

    /**
     * Grand Livre Comptable complet des flux monétaires.
     */
    public function transactions(Request $request): JsonResponse
    {
        $query = GrandLivre::with(['client:id,name,prenom,email,telephone'])
            ->orderBy('id', 'desc');

        if ($request->filled('type_mouvement')) {
            $query->where('type_mouvement', $request->input('type_mouvement'));
        }
        if ($request->filled('categorie')) {
            $query->where('categorie', $request->input('categorie'));
        }
        if ($request->filled('date_debut')) {
            $query->whereDate('created_at', '>=', $request->input('date_debut'));
        }
        if ($request->filled('date_fin')) {
            $query->whereDate('created_at', '<=', $request->input('date_fin'));
        }

        $transactions = $query->paginate((int) $request->input('per_page', 25));

        return response()->json([
            'success' => true,
            'message' => 'Écritures du Grand Livre récupérées avec succès.',
            'solde_actuel' => $this->ledgerService->getSoldeDisponible(),
            'data' => $transactions,
        ]);
    }

    /**
     * Export comptable certifié (JSON / CSV).
     */
    public function export(Request $request): JsonResponse
    {
        $ecritures = GrandLivre::orderBy('id', 'asc')->get();

        return response()->json([
            'success' => true,
            'message' => 'Export des écritures comptables généré avec succès.',
            'date_generation' => now()->toIso8601String(),
            'total_ecritures' => $ecritures->count(),
            'solde_final' => $this->ledgerService->getSoldeDisponible(),
            'data' => $ecritures,
        ]);
    }

    /**
     * Journal des Webhooks financiers avec charges utiles intégrales.
     */
    public function webhooks(Request $request): JsonResponse
    {
        $webhooks = WebhookLog::orderBy('id', 'desc')
            ->paginate((int) $request->input('per_page', 20));

        return response()->json([
            'success' => true,
            'message' => 'Historique complet des webhooks financiers récupéré.',
            'data' => $webhooks,
        ]);
    }

    /**
     * Historique des ordres de retrait (Payouts).
     */
    public function retraits(Request $request): JsonResponse
    {
        $retraits = Retrait::orderBy('id', 'desc')
            ->paginate((int) $request->input('per_page', 20));

        return response()->json([
            'success' => true,
            'message' => 'Historique des ordres de retrait récupéré.',
            'solde_disponible' => $this->ledgerService->getSoldeDisponible(),
            'compte_officiel' => config('emobilier.beneficiaire_officiel'),
            'data' => $retraits,
        ]);
    }

    /**
     * ÉTAPE 1 DU RETRAIT : Initiation d'une demande de retrait vers le compte officiel.
     */
    public function initierRetrait(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'montant' => ['required', 'numeric', 'min:1000'],
            'type_compte' => ['nullable', 'string', Rule::in(['mobile_money', 'virement_bancaire'])],
        ]);

        try {
            $result = $this->payoutService->initierRetrait(
                $user,
                (float) $validated['montant'],
                $validated['type_compte'] ?? 'mobile_money'
            );

            return response()->json([
                'success' => true,
                'message' => $result['message'],
                'data' => $result,
            ], 201);
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * ÉTAPE 2 DU RETRAIT : Confirmation par code OTP et exécution du virement.
     */
    public function confirmerOtp(Request $request, int $id): JsonResponse
    {
        $retrait = Retrait::findOrFail($id);

        $validated = $request->validate([
            'code_otp' => ['required', 'string', 'size:6'],
        ]);

        try {
            $result = $this->payoutService->confirmerOtpEtExecuter($retrait, $validated['code_otp']);

            return response()->json([
                'success' => true,
                'message' => $result['message'],
                'data' => $result,
            ]);
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Annule une demande de retrait en attente d'OTP.
     */
    public function annulerRetrait(Request $request, int $id): JsonResponse
    {
        $retrait = Retrait::findOrFail($id);

        $validated = $request->validate([
            'motif' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            $this->payoutService->annulerRetrait($retrait, $validated['motif'] ?? 'Annulation demandée par M. Justin MAGNIDE.');

            return response()->json([
                'success' => true,
                'message' => "Demande de retrait {$retrait->reference_retrait} annulée avec succès.",
            ]);
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }
}

