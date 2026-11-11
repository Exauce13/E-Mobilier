<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    /**
     * Consulte le journal d'audit immuable.
     * Accessible aux Super Administrateurs.
     * Règle de cloisonnement : les données et logs financiers sont automatiquement
     * masqués/exclus pour le Super Admin Technique.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $isPrincipal = $user->isSuperAdminPrincipal();

        $query = AuditLog::with(['user:id,name,prenom,email'])
            ->orderBy('created_at', 'desc');

        // Cloisonnement : Si ce n'est pas Justin, interdire la vue des logs financiers
        if (! $isPrincipal) {
            $query->where('is_financial', false);
        }

        // Filtre optionnel par action
        if ($request->filled('action')) {
            $query->where('action', 'ILIKE', '%' . $request->input('action') . '%');
        }

        // Filtre optionnel par utilisateur
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->input('user_id'));
        }

        // Filtre par période
        if ($request->filled('date_debut')) {
            $query->where('created_at', '>=', $request->input('date_debut'));
        }
        if ($request->filled('date_fin')) {
            $query->where('created_at', '<=', $request->input('date_fin'));
        }

        $logs = $query->paginate((int) $request->input('per_page', 25));

        return response()->json([
            'success' => true,
            'message' => 'Journal d\'audit de sécurité récupéré avec succès.',
            'financial_view_enabled' => $isPrincipal,
            'data' => $logs,
        ]);
    }
}

