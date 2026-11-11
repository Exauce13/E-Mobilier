<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Services\SecurityAuditHardeningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SecurityAlertController extends Controller
{
    public function __construct(
        protected SecurityAuditHardeningService $securityService
    ) {}

    /**
     * Révocation d'urgence immédiate de toutes les autorisations de démasquage actives.
     * Accessible par Super Admin Principal et Super Admin Tech.
     */
    public function revoquerTousDemasquages(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'motif' => ['nullable', 'string', 'max:255'],
        ]);

        $motif = $validated['motif'] ?? "Révocation d'urgence initiée par l'administration";
        $nbRevoques = $this->securityService->revoquerTousDemasquages($request->user()->id, $motif);

        return response()->json([
            'success' => true,
            'message' => "Révocation d'urgence exécutée : {$nbRevoques} autorisation(s) de démasquage ont été immédiatement révoquées.",
            'total_revoques' => $nbRevoques,
        ]);
    }

    /**
     * Consulte le journal des alertes de sécurité applicatives (Tripwire, RBAC, etc.).
     * Justin : Accès intégral.
     * Tech : Accès technique (hors tentatives ciblant le compte de Justin).
     */
    public function alertes(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = AuditLog::query()
            ->where(function ($q) {
                $q->where('action', 'LIKE', '%security%')
                    ->orWhere('action', 'LIKE', '%violation%')
                    ->orWhere('action', 'LIKE', '%kill_switch%')
                    ->orWhere('action', 'LIKE', '%brute_force%')
                    ->orWhere('action', 'LIKE', '%escalade%');
            })
            ->latest();

        // Cloisonnement : si Tech Admin, filtrer les alertes ciblant le compte de Justin
        if (! $user->isSuperAdminPrincipal()) {
            $ownerEmail = config('emobilier.super_admin_principal_email');
            $query->where(function ($q) use ($ownerEmail) {
                $q->whereNull('details')
                    ->orWhereRaw("details::text NOT ILIKE ?", ["%{$ownerEmail}%"]);
            });
        }

        $alertes = $query->paginate($request->integer('per_page', 25));

        return response()->json([
            'success' => true,
            'data' => $alertes->items(),
            'pagination' => [
                'current_page' => $alertes->currentPage(),
                'last_page' => $alertes->lastPage(),
                'per_page' => $alertes->perPage(),
                'total' => $alertes->total(),
            ],
        ]);
    }
}

