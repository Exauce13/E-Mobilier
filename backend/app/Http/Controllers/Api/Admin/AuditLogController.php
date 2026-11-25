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
        $isFinancialOwner = $user->isFinancialOwner();

        $query = AuditLog::with(['user:id,name,prenom,email', 'user.roles:id,name'])
            ->orderBy('created_at', 'desc');

        // Cloisonnement strict : Seul le propriétaire financier (Justin MAGNIDE) voit les logs financiers
        if (! $isFinancialOwner) {
            $query->where('is_financial', false);
        }

        $like = \Illuminate\Support\Facades\DB::connection()->getDriverName() === 'pgsql' ? 'ILIKE' : 'LIKE';

        // Filtre par module métier
        if ($request->filled('module') && $request->input('module') !== 'all') {
            $mod = $request->input('module');
            if ($mod === 'finance') {
                $query->where(function ($q) use ($like) {
                    $q->where('is_financial', true)
                        ->orWhere('action', $like, '%finance%')
                        ->orWhere('action', $like, '%retrait%')
                        ->orWhere('action', $like, '%paiement%')
                        ->orWhere('action', $like, '%kkiapay%');
                });
            } elseif ($mod === 'auth') {
                $query->where(function ($q) use ($like) {
                    $q->where('action', $like, '%auth%')
                        ->orWhere('action', $like, '%connexion%')
                        ->orWhere('action', $like, '%otp%')
                        ->orWhere('action', $like, '%profil%');
                });
            } elseif ($mod === 'posts') {
                $query->where(function ($q) use ($like) {
                    $q->where('action', $like, '%propriete%')
                        ->orWhere('action', $like, '%moderation%')
                        ->orWhere('action', $like, '%annonce%');
                });
            } elseif ($mod === 'visites') {
                $query->where(function ($q) use ($like) {
                    $q->where('action', $like, '%visite%')
                        ->orWhere('action', $like, '%demande%');
                });
            } elseif ($mod === 'securite') {
                $query->where(function ($q) use ($like) {
                    $q->where('action', $like, '%demasquage%')
                        ->orWhere('action', $like, '%securite%')
                        ->orWhere('action', $like, '%revoqu%')
                        ->orWhere('action', $like, '%charte%')
                        ->orWhere('action', $like, '%kyc%')
                        ->orWhere('action', $like, '%role%');
                });
            }
        }

        // Recherche libre sur action, IP ou acteur
        if ($request->filled('search')) {
            $term = '%' . trim((string) $request->input('search')) . '%';
            $query->where(function ($q) use ($term, $like) {
                $q->where('action', $like, $term)
                    ->orWhere('ip_address', $like, $term)
                    ->orWhereHas('user', function ($uq) use ($term, $like) {
                        $uq->where('name', $like, $term)
                            ->orWhere('prenom', $like, $term)
                            ->orWhere('email', $like, $term);
                    });
            });
        }

        // Filtre optionnel par action
        if ($request->filled('action')) {
            $query->where('action', $like, '%' . $request->input('action') . '%');
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
            'financial_view_enabled' => $isFinancialOwner,
            'data' => $logs,
        ]);
    }
}

