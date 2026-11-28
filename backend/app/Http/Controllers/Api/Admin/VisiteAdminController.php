<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\VisiteClientResource;
use App\Models\AuditLog;
use App\Models\User;
use App\Models\Visite_client;
use App\Models\Zone;
use App\Services\AuditService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class VisiteAdminController extends Controller
{
    /**
     * Liste paginée des visites avec masquage conditionnel, filtrage territorial,
     * recherche multicritères et statistiques réelles.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $like = DB::connection()->getDriverName() === 'pgsql' ? 'ILIKE' : 'LIKE';

        $baseQuery = Visite_client::query();

        // 1. CLOISONNEMENT TERRITORIAL POUR LE RESPONSABLE DE ZONE
        if ($user->isResponsableZone() && ! $user->isSuperAdminPrincipal() && ! $user->isSuperAdminTechnique()) {
            if (! $user->zone_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Aucune zone géographique n\'est assignée à votre profil.',
                ], 403);
            }

            $userZone = $user->zone;
            $commune = $userZone?->commune;

            $baseQuery->where(function ($q) use ($user, $commune, $like) {
                $q->where('zone_id', $user->zone_id)
                    ->orWhere('target_agent_id', $user->id)
                    ->orWhereHas('propriete', function ($propQ) use ($user, $commune, $like) {
                        $propQ->where('zone_id', $user->zone_id);
                        if ($commune) {
                            $propQ->orWhere('commune', $like, '%' . $commune . '%');
                        }
                    });
            });
        }

        // 2. Statistiques réelles calculées sur la portée de l'utilisateur
        $stats = $this->computeStats(clone $baseQuery);

        // 3. Filtres optionnels
        $query = (clone $baseQuery)
            ->with(['client', 'propriete.zone', 'propriete.media', 'agentAssigne', 'zone'])
            ->latest('scheduled_date');

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('zone_id') && $request->input('zone_id') !== 'all') {
            $zId = (int) $request->input('zone_id');
            $query->where(function ($q) use ($zId) {
                $q->where('zone_id', $zId)
                    ->orWhereHas('propriete', fn ($pq) => $pq->where('zone_id', $zId));
            });
        }
        if ($request->filled('agent_id') && $request->input('agent_id') !== 'all') {
            if ($request->input('agent_id') === 'unassigned') {
                $query->whereNull('target_agent_id');
            } elseif ($request->input('agent_id') === 'me') {
                $query->where('target_agent_id', $user->id);
            } else {
                $query->where('target_agent_id', (int) $request->input('agent_id'));
            }
        }
        if ($request->filled('is_fee_paid')) {
            $query->where('is_fee_paid', $request->boolean('is_fee_paid'));
        }
        if ($request->filled('date')) {
            $query->whereDate('scheduled_date', $request->input('date'));
        }
        if ($request->filled('period') && $request->input('period') !== 'all') {
            $period = (string) $request->input('period');
            if ($period === 'today') {
                $query->whereDate('scheduled_date', now()->toDateString());
            } elseif ($period === 'week') {
                $query->where('scheduled_date', '>=', now()->subDays(7)->startOfDay());
            } elseif ($period === 'month') {
                $query->where('scheduled_date', '>=', now()->startOfMonth());
            }
        }
        if ($request->filled('date_debut')) {
            try {
                $query->where('scheduled_date', '>=', Carbon::parse($request->input('date_debut'))->startOfDay());
            } catch (\Throwable) {
            }
        }
        if ($request->filled('date_fin')) {
            try {
                $query->where('scheduled_date', '<=', Carbon::parse($request->input('date_fin'))->endOfDay());
            } catch (\Throwable) {
            }
        }

        // Recherche multicritères (référence, bien, commune, quartier, client si autorisé, agent)
        if ($request->filled('search')) {
            $rawTerm = trim((string) $request->input('search'));
            $term = '%' . $rawTerm . '%';
            $numericId = null;
            if (preg_match('/^(?:VIS-?)?0*(\d+)$/i', $rawTerm, $m)) {
                $numericId = (int) $m[1];
            }
            $canSearchClientName = $user->isSuperAdminPrincipal();

            $query->where(function ($q) use ($term, $like, $numericId, $canSearchClientName) {
                $q->where('instructions_itineraire', $like, $term)
                    ->orWhere('compte_rendu', $like, $term)
                    ->orWhereHas('propriete', function ($pq) use ($term, $like) {
                        $pq->where('type', $like, $term)
                            ->orWhere('commune', $like, $term)
                            ->orWhere('arrondissement', $like, $term)
                            ->orWhere('quartier', $like, $term);
                    })
                    ->orWhereHas('agentAssigne', function ($aq) use ($term, $like) {
                        $aq->where('name', $like, $term)->orWhere('prenom', $like, $term);
                    });

                if ($numericId !== null) {
                    $q->orWhere('id', $numericId);
                }

                if ($canSearchClientName) {
                    $q->orWhereHas('client', function ($cq) use ($term, $like) {
                        $cq->where('name', $like, $term)
                            ->orWhere('prenom', $like, $term)
                            ->orWhere('telephone', $like, $term);
                    });
                }
            });
        }

        $perPage = min(50, max(1, (int) $request->input('per_page', 15)));
        $visites = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Liste des visites récupérée avec succès.',
            'stats' => $stats,
            'data' => VisiteClientResource::collection($visites)->response($request)->getData(true),
        ]);
    }

    /**
     * Fiche unitaire d'une visite avec protection Anti-IDOR.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $visite = Visite_client::with(['client', 'propriete.zone', 'propriete.media', 'agentAssigne', 'zone'])->findOrFail($id);

        if (! $this->canAccessVisite($user, $visite)) {
            return response()->json([
                'success' => false,
                'message' => 'Accès refusé (Anti-IDOR) : Cette visite relève d\'une zone en dehors de votre affectation.',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'message' => 'Détail de la visite récupéré avec succès.',
            'data' => new VisiteClientResource($visite),
        ]);
    }

    /**
     * Historique d'audit d'une visite physique issu du système de journalisation globale (audit_logs).
     */
    public function historique(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $visite = Visite_client::with('propriete')->findOrFail($id);

        if (! $this->canAccessVisite($user, $visite)) {
            return response()->json([
                'success' => false,
                'message' => 'Accès refusé (Anti-IDOR) : Historique hors de votre zone d\'affectation.',
            ], 403);
        }

        $logs = AuditLog::with('user:id,name,prenom,email')
            ->where('target_type', Visite_client::class)
            ->where('target_id', $visite->id)
            ->where('is_financial', false)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(function (AuditLog $log) {
                return [
                    'id' => $log->id,
                    'action' => $log->action,
                    'details' => $log->details,
                    'actor' => $log->user ? [
                        'id' => $log->user->id,
                        'nom_complet' => $log->user->full_name,
                        'email' => $log->user->email,
                    ] : null,
                    'created_at' => $log->created_at?->toIso8601String(),
                ];
            });

        return response()->json([
            'success' => true,
            'reference' => 'VIS-' . str_pad((string) $visite->id, 5, '0', STR_PAD_LEFT),
            'data' => $logs,
        ]);
    }

    /**
     * Met à jour le statut opérationnel d'une visite avec validation stricte des transitions.
     */
    public function updateStatut(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $visite = Visite_client::with('propriete')->findOrFail($id);

        if (! $this->canAccessVisite($user, $visite)) {
            return response()->json([
                'success' => false,
                'message' => 'Action refusée (Anti-IDOR) : Vous ne pouvez pas modifier le statut d\'une visite hors de votre zone.',
            ], 403);
        }

        $validated = $request->validate([
            'status' => ['required', 'string', Rule::in([
                'pending', 'confirmed', 'completed', 'cancelled',
                'Programmée', 'Effectuée', 'Reportée', 'Clôturée', 'Annulée',
            ])],
            'motif' => ['nullable', 'string', 'max:500'],
        ]);

        // Normalisation des statuts (support labels d'interface)
        $statusMap = [
            'Programmée' => 'confirmed',
            'Effectuée' => 'completed',
            'Reportée' => 'pending',
            'Clôturée' => 'completed',
            'Annulée' => 'cancelled',
            'pending' => 'pending',
            'confirmed' => 'confirmed',
            'completed' => 'completed',
            'cancelled' => 'cancelled',
        ];

        $normalise = $statusMap[$validated['status']] ?? $validated['status'];
        $ancienStatut = $visite->status;

        // Validation stricte du cycle de vie pour empêcher les transitions incohérentes
        if (! $visite->canTransitionTo($normalise)) {
            return response()->json([
                'success' => false,
                'message' => "Transition de statut interdite : impossible de passer une visite de '{$ancienStatut}' à '{$normalise}'.",
            ], 422);
        }

        if ($ancienStatut === $normalise) {
            return response()->json([
                'success' => false,
                'message' => "La visite est déjà au statut '{$normalise}'.",
            ], 422);
        }

        $visite->update(['status' => $normalise]);

        AuditService::log('modification_statut_visite', $visite, [
            'ancien_statut' => $ancienStatut,
            'nouveau_statut' => $normalise,
            'statut_affiche' => $validated['status'],
            'motif' => $validated['motif'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Statut de la visite mis à jour avec succès : {$validated['status']}.",
            'data' => new VisiteClientResource($visite->fresh(['client', 'propriete.zone', 'propriete.media', 'agentAssigne', 'zone'])),
        ]);
    }

    /**
     * Assigne une visite à une zone géographique et éventuellement à un Responsable de zone ou Agent.
     * Réservé aux Super Admins et à la Secrétaire.
     */
    public function assignerZone(Request $request, int $id): JsonResponse
    {
        $visite = Visite_client::findOrFail($id);

        if (in_array($visite->status, ['completed', 'cancelled'], true)) {
            return response()->json([
                'success' => false,
                'message' => "Impossible de réassigner la zone d'une visite déjà {$visite->status}.",
            ], 422);
        }

        $validated = $request->validate([
            'zone_id' => ['required', 'exists:zones,id'],
            'target_agent_id' => ['nullable', 'exists:users,id'],
        ]);

        $zone = Zone::findOrFail($validated['zone_id']);

        // Vérification optionnelle de l'agent assigné
        if (! empty($validated['target_agent_id'])) {
            $agent = User::findOrFail($validated['target_agent_id']);
            if (! $agent->isResponsableZone() && ! $agent->hasRole('Agent mobilier') && ! $agent->isAnyAdmin()) {
                return response()->json([
                    'success' => false,
                    'message' => 'L\'agent assigné doit avoir le rôle de Responsable de zone, d\'Agent mobilier ou d\'Administrateur.',
                ], 422);
            }
        }

        $ancienZoneId = $visite->zone_id;
        $ancienAgentId = $visite->target_agent_id;

        $visite->update([
            'zone_id' => $zone->id,
            'target_agent_id' => array_key_exists('target_agent_id', $validated) && $validated['target_agent_id'] !== null
                ? $validated['target_agent_id']
                : $visite->target_agent_id,
        ]);

        AuditService::log('assignation_zone_visite', $visite, [
            'ancien_zone_id' => $ancienZoneId,
            'zone_id' => $zone->id,
            'zone_nom' => $zone->nom,
            'ancien_agent_id' => $ancienAgentId,
            'target_agent_id' => $visite->target_agent_id,
        ]);

        return response()->json([
            'success' => true,
            'message' => "La visite a été assignée avec succès à la zone '{$zone->nom}'.",
            'data' => new VisiteClientResource($visite->fresh(['client', 'propriete.zone', 'propriete.media', 'agentAssigne', 'zone'])),
        ]);
    }

    protected function computeStats($scopedQuery): array
    {
        $counts = $scopedQuery->select('status', DB::raw('COUNT(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status');

        $enAttente = (int) ($counts['pending'] ?? 0);
        $programmees = (int) ($counts['confirmed'] ?? 0);
        $effectuees = (int) ($counts['completed'] ?? 0);
        $annulees = (int) ($counts['cancelled'] ?? 0);

        return [
            'total_visites' => $enAttente + $programmees + $effectuees + $annulees,
            'en_attente' => $enAttente,
            'programmees' => $programmees,
            'effectuees' => $effectuees,
            'annulees' => $annulees,
        ];
    }

    protected function canAccessVisite(User $user, Visite_client $visite): bool
    {
        if (! $user->isResponsableZone() || $user->isSuperAdminPrincipal() || $user->isSuperAdminTechnique()) {
            return true;
        }

        $userZoneId = $user->zone_id;
        $propZoneId = $visite->propriete?->zone_id;
        $visiteZoneId = $visite->zone_id;
        $isAssigned = (int) $visite->target_agent_id === (int) $user->id;
        $commune = $user->zone?->commune;
        $isSameCommune = $commune && $visite->propriete?->commune
            && str_contains(mb_strtolower($visite->propriete->commune), mb_strtolower($commune));

        return $visiteZoneId === $userZoneId || $propZoneId === $userZoneId || $isAssigned || $isSameCommune;
    }
}
