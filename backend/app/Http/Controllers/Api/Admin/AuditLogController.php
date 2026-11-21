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

        $query = AuditLog::with(['user:id,name,prenom,email', 'user.roles:id,name'])
            ->orderBy('created_at', 'desc');

        // Cloisonnement : Si ce n'est pas Justin, interdire la vue des logs financiers
        if (! $isPrincipal) {
            $query->where('is_financial', false);
        }

        // Filtre par module métier
        if ($request->filled('module') && $request->input('module') !== 'all') {
            $mod = $request->input('module');
            if ($mod === 'finance') {
                $query->where(function ($q) {
                    $q->where('is_financial', true)
                        ->orWhere('action', 'ILIKE', '%finance%')
                        ->orWhere('action', 'ILIKE', '%retrait%')
                        ->orWhere('action', 'ILIKE', '%paiement%')
                        ->orWhere('action', 'ILIKE', '%kkiapay%');
                });
            } elseif ($mod === 'auth') {
                $query->where(function ($q) {
                    $q->where('action', 'ILIKE', '%auth%')
                        ->orWhere('action', 'ILIKE', '%connexion%')
                        ->orWhere('action', 'ILIKE', '%otp%')
                        ->orWhere('action', 'ILIKE', '%profil%');
                });
            } elseif ($mod === 'posts') {
                $query->where(function ($q) {
                    $q->where('action', 'ILIKE', '%propriete%')
                        ->orWhere('action', 'ILIKE', '%moderation%')
                        ->orWhere('action', 'ILIKE', '%annonce%');
                });
            } elseif ($mod === 'visites') {
                $query->where(function ($q) {
                    $q->where('action', 'ILIKE', '%visite%')
                        ->orWhere('action', 'ILIKE', '%demande%');
                });
            } elseif ($mod === 'securite') {
                $query->where(function ($q) {
                    $q->where('action', 'ILIKE', '%demasquage%')
                        ->orWhere('action', 'ILIKE', '%securite%')
                        ->orWhere('action', 'ILIKE', '%revoqu%')
                        ->orWhere('action', 'ILIKE', '%charte%')
                        ->orWhere('action', 'ILIKE', '%kyc%')
                        ->orWhere('action', 'ILIKE', '%role%');
                });
            }
        }

        // Recherche libre sur action, IP ou acteur
        if ($request->filled('search')) {
            $term = '%' . trim((string) $request->input('search')) . '%';
            $query->where(function ($q) use ($term) {
                $q->where('action', 'ILIKE', $term)
                    ->orWhere('ip_address', 'ILIKE', $term)
                    ->orWhereHas('user', function ($uq) use ($term) {
                        $uq->where('name', 'ILIKE', $term)
                            ->orWhere('prenom', 'ILIKE', $term)
                            ->orWhere('email', 'ILIKE', $term);
                    });
            });
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

