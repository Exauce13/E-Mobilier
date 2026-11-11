<?php

namespace App\Http\Controllers\Api\Finance;

use App\Http\Controllers\Controller;
use App\Services\SecurityAuditHardeningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FinancialSecurityController extends Controller
{
    public function __construct(
        protected SecurityAuditHardeningService $securityService
    ) {}

    /**
     * Parcourt toute la chaîne cryptographique du Grand Livre (HMAC Hash Chaining).
     * Accessible UNIQUEMENT par M. Justin MAGNIDE (financial_owner).
     */
    public function verifierIntegrite(): JsonResponse
    {
        $result = $this->securityService->verifierIntegriteGrandLivre();

        return response()->json([
            'success' => true,
            'message' => $result['chaine_intacte']
                ? 'Intégrité cryptographique du Grand Livre certifiée. Aucune altération détectée.'
                : 'ALERTE : Rupture de chaîne détectée ! Le Grand Livre a été altéré.',
            'data' => $result,
        ], $result['chaine_intacte'] ? 200 : 409);
    }

    /**
     * Active le coupe-circuit d'urgence suspendant immédiatement tous les retraits financiers.
     */
    public function gelerRetraits(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'motif' => ['required', 'string', 'max:255'],
        ]);

        $payload = $this->securityService->gelerRetraits(
            $validated['motif'],
            $request->user()->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Coupe-circuit activé : tous les ordres de retrait sont désormais gelés.',
            'data' => $payload,
        ]);
    }

    /**
     * Lève le gel d'urgence des retraits.
     */
    public function degelerRetraits(Request $request): JsonResponse
    {
        $res = $this->securityService->degelerRetraits($request->user()->id);

        return response()->json([
            'success' => true,
            'message' => $res['message'],
        ]);
    }

    /**
     * Statut de sécurité du Coffre-Fort.
     */
    public function statut(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'retraits_geles' => $this->securityService->isRetraitsGeles(),
            ],
        ]);
    }
}

