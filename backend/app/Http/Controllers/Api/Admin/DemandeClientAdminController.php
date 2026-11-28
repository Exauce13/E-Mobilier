<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\DemandeClientResource;
use App\Models\AuditLog;
use App\Models\Demande_client;
use App\Models\Proprietes;
use App\Models\User;
use App\Services\PropertyMatchingService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DemandeClientAdminController extends Controller
{
    public function __construct(
        protected PropertyMatchingService $matchingService
    ) {
    }

    /**
     * Liste paginée des demandes de recherche avec masquage conditionnel, filtrage territorial,
     * recherche multicritères, statistiques réelles et compteur de biens correspondants.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $like = DB::connection()->getDriverName() === 'pgsql' ? 'ILIKE' : 'LIKE';

        $baseQuery = Demande_client::query();

        // 1. CLOISONNEMENT TERRITORIAL POUR LE RESPONSABLE DE ZONE
        if ($user->isResponsableZone() && ! $user->isSuperAdminPrincipal() && ! $user->isSuperAdminTechnique()) {
            if (! $user->zone_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Aucune zone géographique n\'est assignée à votre profil de Responsable de zone.',
                ], 403);
            }

            $userZone = $user->zone;
            $commune = $userZone?->commune;

            $baseQuery->where(function ($q) use ($user, $commune, $like) {
                $q->where('zone_id', $user->zone_id);
                if ($commune) {
                    $q->orWhere('target_commune', $like, '%' . $commune . '%');
                }
            });
        }

        // 2. Statistiques réelles calculées sur la portée de l'utilisateur connecté
        $stats = $this->computeStats(clone $baseQuery);

        // 3. Filtres sur la requête paginée
        $query = (clone $baseQuery)
            ->with([
                'client',
                'zone',
                'gestionnaire:id,name,prenom,email',
                'cloturePar:id,name,prenom,email',
                'matchedPropriete.media',
                'proprietesAssociees.media',
            ])
            ->latest();

        // Filtre par workflow_status ou status brut
        $workflowStatus = $request->input('workflow_status') ?: $request->input('status');
        if (! empty($workflowStatus) && $workflowStatus !== 'all') {
            match ($workflowStatus) {
                'en_attente' => $query->where('status', 'active')->whereNull('gestionnaire_id'),
                'en_cours' => $query->where('status', 'active')->whereNotNull('gestionnaire_id'),
                'satisfaite', 'fulfilled' => $query->where(function ($q) {
                    $q->where('status', 'fulfilled')->orWhere('motif_cloture', 'satisfaite');
                }),
                'abandonnee' => $query->where('status', 'closed')->where(function ($q) {
                    $q->where('motif_cloture', 'abandonnee_client')->orWhereNull('motif_cloture');
                }),
                'expiree' => $query->where('status', 'closed')->where('motif_cloture', 'delai_depasse'),
                'active', 'closed' => $query->where('status', $workflowStatus),
                default => $query->where('status', $workflowStatus),
            };
        }

        if ($request->filled('property_type') && $request->input('property_type') !== 'all') {
            $query->where('property_type', $request->input('property_type'));
        }
        if ($request->filled('transaction_type') && $request->input('transaction_type') !== 'all') {
            $query->where('transaction_type', $request->input('transaction_type'));
        }
        if ($request->filled('zone_id') && $request->input('zone_id') !== 'all') {
            $query->where('zone_id', $request->input('zone_id'));
        }
        if ($request->filled('commune')) {
            $query->where('target_commune', $like, '%' . trim((string) $request->input('commune')) . '%');
        }
        if ($request->filled('gestionnaire_id') && $request->input('gestionnaire_id') !== 'all') {
            if ($request->input('gestionnaire_id') === 'unassigned') {
                $query->whereNull('gestionnaire_id');
            } elseif ($request->input('gestionnaire_id') === 'me') {
                $query->where('gestionnaire_id', $user->id);
            } else {
                $query->where('gestionnaire_id', (int) $request->input('gestionnaire_id'));
            }
        }

        // Filtre par période de publication
        if ($request->filled('period') && $request->input('period') !== 'all') {
            $period = (string) $request->input('period');
            if ($period === 'today') {
                $query->where('created_at', '>=', now()->startOfDay());
            } elseif ($period === 'week') {
                $query->where('created_at', '>=', now()->subDays(7)->startOfDay());
            } elseif ($period === 'month') {
                $query->where('created_at', '>=', now()->startOfMonth());
            }
        }
        if ($request->filled('date_debut')) {
            try {
                $query->where('created_at', '>=', Carbon::parse($request->input('date_debut'))->startOfDay());
            } catch (\Throwable) {
            }
        }
        if ($request->filled('date_fin')) {
            try {
                $query->where('created_at', '<=', Carbon::parse($request->input('date_fin'))->endOfDay());
            } catch (\Throwable) {
            }
        }

        // Recherche multicritères (référence, nom client si autorisé, type de bien, commune, quartier)
        if ($request->filled('search')) {
            $rawTerm = trim((string) $request->input('search'));
            $term = '%' . $rawTerm . '%';
            $numericId = null;
            if (preg_match('/^(?:DEM-?)?0*(\d+)$/i', $rawTerm, $m)) {
                $numericId = (int) $m[1];
            }
            $canSearchClientName = $user->isSuperAdminPrincipal();

            $query->where(function ($q) use ($term, $like, $numericId, $canSearchClientName) {
                $q->where('property_type', $like, $term)
                    ->orWhere('transaction_type', $like, $term)
                    ->orWhere('target_commune', $like, $term)
                    ->orWhere('target_arrondissement', $like, $term)
                    ->orWhere('target_quartier', $like, $term)
                    ->orWhere('criteria_details', $like, $term);

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
        $demandes = $query->paginate($perPage);

        // Calcul optimisé en une seule requête du nombre de biens publiés correspondants pour la page courante
        $publishedPool = Proprietes::select('id', 'type', 'transaction_type', 'commune', 'arrondissement', 'quartier', 'prix', 'status')
            ->where('status', 'published')
            ->get();

        foreach ($demandes->getCollection() as $dem) {
            $dem->biens_correspondants_count = $this->matchingService->countMatches($dem, $publishedPool);
        }

        return response()->json([
            'success' => true,
            'message' => 'Demandes clients récupérées avec succès (application des règles de masquage).',
            'stats' => $stats,
            'data' => DemandeClientResource::collection($demandes)->response($request)->getData(true),
        ]);
    }

    /**
     * Fiche détaillée d'une demande client avec protection Anti-IDOR.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $demande = Demande_client::with([
            'client',
            'zone',
            'gestionnaire:id,name,prenom,email',
            'cloturePar:id,name,prenom,email',
            'matchedPropriete.media',
            'proprietesAssociees.media',
        ])->findOrFail($id);

        if (! $this->canAccessDemande($user, $demande)) {
            return response()->json([
                'success' => false,
                'message' => 'Accès refusé (Anti-IDOR) : Ce dossier relève d\'un secteur géographique en dehors de votre zone d\'affectation.',
            ], 403);
        }

        $publishedPool = Proprietes::select('id', 'type', 'transaction_type', 'commune', 'arrondissement', 'quartier', 'prix', 'status')
            ->where('status', 'published')
            ->get();
        $demande->biens_correspondants_count = $this->matchingService->countMatches($demande, $publishedPool);

        return response()->json([
            'success' => true,
            'message' => 'Détail de la demande client récupéré avec succès.',
            'data' => new DemandeClientResource($demande),
        ]);
    }

    /**
     * Historique d'audit d'une demande issu directement du système de journalisation globale (audit_logs).
     */
    public function historique(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $demande = Demande_client::findOrFail($id);

        if (! $this->canAccessDemande($user, $demande)) {
            return response()->json([
                'success' => false,
                'message' => 'Accès refusé (Anti-IDOR) : Historique hors de votre zone d\'affectation.',
            ], 403);
        }

        $logs = AuditLog::with('user:id,name,prenom,email')
            ->where('target_type', Demande_client::class)
            ->where('target_id', $demande->id)
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
            'reference' => 'DEM-' . str_pad((string) $demande->id, 5, '0', STR_PAD_LEFT),
            'data' => $logs,
        ]);
    }

    /**
     * Liste des gestionnaires/agents opérationnels éligibles pour les filtres et réattributions.
     */
    public function operationalAgents(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = User::with(['roles:id,name', 'zone:id,nom,commune'])
            ->where('statut', 'actif')
            ->whereHas('roles', function ($q) {
                $q->whereIn('name', [
                    'Super Admin Principal',
                    'Super Admin Technique',
                    'Secrétaire',
                    'Responsable de zone',
                    'Agent mobilier',
                    'Admin',
                ]);
            })
            ->orderBy('name');

        if ($user->isResponsableZone() && ! $user->isSuperAdminPrincipal() && ! $user->isSuperAdminTechnique() && $user->zone_id) {
            $query->where(function ($q) use ($user) {
                $q->where('zone_id', $user->zone_id)->orWhere('id', $user->id);
            });
        }

        $agents = $query->get()->map(function (User $u) {
            return [
                'id' => $u->id,
                'nom_complet' => $u->full_name ?: $u->email,
                'email' => $u->email,
                'role' => $u->roles->first()?->name ?? 'Staff',
                'zone_id' => $u->zone_id,
                'zone_nom' => $u->zone?->nom,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $agents,
        ]);
    }

    /**
     * Calcule les indicateurs statistiques réels des demandes sur une requête de portée.
     */
    protected function computeStats($scopedQuery): array
    {
        $rows = $scopedQuery->select('status', 'gestionnaire_id', 'motif_cloture')->get();

        $total = $rows->count();
        $enAttente = 0;
        $enCours = 0;
        $satisfaites = 0;
        $abandonnees = 0;
        $expirees = 0;

        foreach ($rows as $row) {
            if ($row->status === 'fulfilled' || $row->motif_cloture === 'satisfaite') {
                $satisfaites++;
            } elseif ($row->status === 'closed') {
                if ($row->motif_cloture === 'delai_depasse') {
                    $expirees++;
                } else {
                    $abandonnees++;
                }
            } elseif ($row->gestionnaire_id) {
                $enCours++;
            } else {
                $enAttente++;
            }
        }

        return [
            'total_demandes' => $total,
            'en_attente' => $enAttente,
            'en_cours' => $enCours,
            'satisfaites' => $satisfaites,
            'abandonnees' => $abandonnees,
            'expirees' => $expirees,
        ];
    }

    protected function canAccessDemande(User $user, Demande_client $demande): bool
    {
        if (! $user->isResponsableZone() || $user->isSuperAdminPrincipal() || $user->isSuperAdminTechnique()) {
            return true;
        }

        $userZone = $user->zone;
        $commune = $userZone?->commune;
        $isSameZone = ($demande->zone_id && (int) $demande->zone_id === (int) $user->zone_id);
        $isSameCommune = ($commune && $demande->target_commune && str_contains(mb_strtolower($demande->target_commune), mb_strtolower($commune)));

        return $isSameZone || $isSameCommune;
    }
}
