<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Demande_client;
use App\Models\DemandeDemasquage;
use App\Models\GrandLivre;
use App\Models\Proprietes;
use App\Models\Retrait;
use App\Models\User;
use App\Models\Visite_client;
use App\Models\Zone;
use App\Services\FinancialLedgerService;
use App\Services\PlatformSettingsService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SuperAdminDashboardController extends Controller
{
    public function __construct(
        protected FinancialLedgerService $ledgerService,
        protected PlatformSettingsService $settings
    ) {
    }

    /**
     * Centre de supervision unifié pour le Super Administrateur Principal.
     * Toutes les données proviennent exclusivement d'agrégations réelles en base de données.
     */
    public function overview(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user || ! $user->isSuperAdminPrincipal()) {
            return response()->json([
                'success' => false,
                'message' => 'Accès strictement réservé au Super Administrateur Principal.',
            ], 403);
        }

        $isFinancialOwner = $user->isFinancialOwner();

        // 1. Résolution de la période & période précédente de comparaison
        [$periodKey, $periodLabel, $start, $end, $prevStart, $prevEnd] = $this->resolvePeriod($request);

        // 2. Santé système temps réel
        $systemHealth = $this->buildSystemHealth();

        // 3. KPI 1 : Utilisateurs inscrits (Clients / Agents / Évolution période)
        $totalUsers = User::count();
        $totalClients = User::role('Client')->count();
        $totalAgents = User::role('Agent mobilier')->count();
        $agentsKycPending = User::role('Agent mobilier')->where('is_verifed', false)->count();

        $usersInPeriod = User::whereBetween('created_at', [$start, $end])->count();
        $usersPrevPeriod = User::whereBetween('created_at', [$prevStart, $prevEnd])->count();
        $clientsInPeriod = User::role('Client')->whereBetween('created_at', [$start, $end])->count();
        $agentsInPeriod = User::role('Agent mobilier')->whereBetween('created_at', [$start, $end])->count();

        // 4. KPI 2 : Publications (Posts immobiliers)
        $propStatusCounts = Proprietes::select('status', DB::raw('COUNT(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status');

        $pubsPublished = (int) ($propStatusCounts['published'] ?? 0);
        $pubsPending = (int) ($propStatusCounts['pending'] ?? 0) + (int) ($propStatusCounts['pending_payment'] ?? 0);
        $pubsRejected = (int) ($propStatusCounts['rejected'] ?? 0);
        $pubsConclues = (int) ($propStatusCounts['sold_rented'] ?? 0);
        $pubsTotal = (int) $propStatusCounts->sum();

        $pubsInPeriod = Proprietes::whereBetween('created_at', [$start, $end])->count();
        $pubsPrevPeriod = Proprietes::whereBetween('created_at', [$prevStart, $prevEnd])->count();

        // 5. KPI 3 : Demandes de recherche
        $demStatusCounts = Demande_client::select('status', DB::raw('COUNT(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status');

        $demActives = (int) ($demStatusCounts['active'] ?? 0);
        $demFulfilled = (int) ($demStatusCounts['fulfilled'] ?? 0);
        $demClosed = (int) ($demStatusCounts['closed'] ?? 0);
        $demTotal = (int) $demStatusCounts->sum();
        $demUnassigned = Demande_client::where('status', 'active')->whereNull('gestionnaire_id')->count();

        $demInPeriod = Demande_client::whereBetween('created_at', [$start, $end])->count();
        $demPrevPeriod = Demande_client::whereBetween('created_at', [$prevStart, $prevEnd])->count();

        // 6. KPI 4 : Visites terrain
        $visStatusCounts = Visite_client::select('status', DB::raw('COUNT(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status');

        $visPending = (int) ($visStatusCounts['pending'] ?? 0);
        $visConfirmed = (int) ($visStatusCounts['confirmed'] ?? 0);
        $visCompleted = (int) ($visStatusCounts['completed'] ?? 0);
        $visCancelled = (int) ($visStatusCounts['cancelled'] ?? 0);
        $visTotal = (int) $visStatusCounts->sum();
        $visCompletionRate = $visTotal > 0 ? round(($visCompleted / $visTotal) * 100, 1) : 0.0;

        $visInPeriod = Visite_client::whereBetween('created_at', [$start, $end])->count();
        $visPrevPeriod = Visite_client::whereBetween('created_at', [$prevStart, $prevEnd])->count();

        // 7. KPI 5 : Démasquages TTL (Anti-contournement)
        $ttlStatusCounts = DemandeDemasquage::select('statut', DB::raw('COUNT(*) as total'))
            ->groupBy('statut')
            ->pluck('total', 'statut');

        $ttlPending = (int) ($ttlStatusCounts['en_attente'] ?? 0);
        $ttlApproved = (int) ($ttlStatusCounts['approuve'] ?? 0);
        $ttlRefusedOrRevoked = (int) ($ttlStatusCounts['refuse'] ?? 0) + (int) ($ttlStatusCounts['revoque'] ?? 0);
        $ttlTotal = (int) $ttlStatusCounts->sum();
        $ttlActiveNow = DemandeDemasquage::where('statut', 'approuve')
            ->where('expires_at', '>', now())
            ->count();

        $ttlInPeriod = DemandeDemasquage::whereBetween('created_at', [$start, $end])->count();
        $ttlPrevPeriod = DemandeDemasquage::whereBetween('created_at', [$prevStart, $prevEnd])->count();

        // 8. KPI 6 : Trésorerie / Coffre-Fort (STRICTEMENT réservé au propriétaire financier)
        $tresorerie = null;
        $retraitsPendingCount = 0;
        if ($isFinancialOwner) {
            $soldeDispo = $this->ledgerService->getSoldeDisponible();
            $soldeEnCours = $this->ledgerService->getSoldeEnCompensation();
            $totalRetraitsExecutes = (float) Retrait::where('statut', 'execute')->sum('montant');
            $retraitsPendingCount = Retrait::whereIn('statut', ['en_attente_otp', 'en_cours_agregateur'])->count();
            $encaissementsPeriod = (float) GrandLivre::where('type_mouvement', 'credit')
                ->whereBetween('created_at', [$start, $end])
                ->sum('montant_net');
            $encaissementsPrevPeriod = (float) GrandLivre::where('type_mouvement', 'credit')
                ->whereBetween('created_at', [$prevStart, $prevEnd])
                ->sum('montant_net');
            $retraitsGeles = (bool) $this->settings->get('retraits_geles', false);

            $tresorerie = [
                'solde_disponible' => $soldeDispo,
                'solde_en_cours_retrait' => $soldeEnCours,
                'total_retraits_executes' => $totalRetraitsExecutes,
                'retraits_en_attente_count' => $retraitsPendingCount,
                'encaissements_periode' => $encaissementsPeriod,
                'encaissements_periode_precedente' => $encaissementsPrevPeriod,
                'evolution_pct' => $this->calcEvolution($encaissementsPeriod, $encaissementsPrevPeriod),
                'retraits_geles' => $retraitsGeles,
                'devise' => 'XOF',
            ];
        }

        // 9. Séries temporelles pour le graphique linéaire (Évolution des activités)
        $evolutionSeries = $this->buildActivitySeries($periodKey, $start, $end);

        // 10. Performance géographique par zone (toutes les zones actives de la BDD)
        $zonesPerformance = $this->buildZonesPerformance();

        // 11. Activités récentes réelles paginées
        $activityPage = max(1, (int) $request->input('activity_page', 1));
        $activityPerPage = min(20, max(5, (int) $request->input('activity_per_page', 8)));
        $recentActivities = $this->buildRecentActivities($isFinancialOwner, $activityPage, $activityPerPage);

        // 12. Actions en attente d'intervention
        $pendingActions = [];
        if ($pubsPending > 0) {
            $pendingActions[] = [
                'key' => 'publications_en_attente',
                'label' => 'Publications en attente de validation',
                'description' => 'Annonces clients et agents à vérifier avant mise en ligne',
                'count' => $pubsPending,
                'severity' => 'high',
                'target_page' => 'moderation',
            ];
        }
        if ($ttlPending > 0) {
            $pendingActions[] = [
                'key' => 'demasquages_en_attente',
                'label' => 'Demandes de démasquage TTL à arbitrer',
                'description' => 'Demandes temporaires d\'accès aux coordonnées clients',
                'count' => $ttlPending,
                'severity' => 'high',
                'target_page' => 'demasquages',
            ];
        }
        if ($isFinancialOwner && $retraitsPendingCount > 0) {
            $pendingActions[] = [
                'key' => 'retraits_en_attente',
                'label' => 'Retraits en attente de traitement',
                'description' => 'Ordres de décaissement en attente de confirmation OTP ou agrégateur',
                'count' => $retraitsPendingCount,
                'severity' => 'high',
                'target_page' => 'finance',
            ];
        }
        if ($visPending > 0) {
            $pendingActions[] = [
                'key' => 'visites_en_attente',
                'label' => 'Visites terrain à planifier',
                'description' => 'Visites payées en attente de confirmation et d\'assignation de zone',
                'count' => $visPending,
                'severity' => 'medium',
                'target_page' => 'visites',
                'sub_tab' => 'visites',
            ];
        }
        if ($demActives > 0) {
            $pendingActions[] = [
                'key' => 'demandes_actives',
                'label' => $demUnassigned > 0
                    ? 'Demandes de recherche non prises en charge'
                    : 'Demandes de recherche actives à rapprocher',
                'description' => 'Besoins clients actifs en attente de matching immobilier',
                'count' => $demUnassigned > 0 ? $demUnassigned : $demActives,
                'severity' => 'medium',
                'target_page' => 'visites',
                'sub_tab' => 'demandes',
            ];
        }
        if ($agentsKycPending > 0) {
            $pendingActions[] = [
                'key' => 'agents_kyc_en_attente',
                'label' => 'Agents mobiliers en attente d\'agrément KYC',
                'description' => 'Profils professionnels à auditer et approuver',
                'count' => $agentsKycPending,
                'severity' => 'low',
                'target_page' => 'equipe',
                'sub_tab' => 'kyc',
            ];
        }

        // 13. Badges temps réel pour la sidebar
        $sidebarBadges = [
            'moderation' => $pubsPending,
            'visites' => $visPending + $demUnassigned,
            'demasquages' => $ttlPending,
            'equipe' => $agentsKycPending,
            'finance' => $isFinancialOwner ? $retraitsPendingCount : 0,
        ];

        $auditLogsTotal = $isFinancialOwner
            ? AuditLog::count()
            : AuditLog::where('is_financial', false)->count();

        return response()->json([
            'success' => true,
            'generated_at' => now()->toIso8601String(),
            'financial_access' => $isFinancialOwner,
            'periode' => [
                'key' => $periodKey,
                'label' => $periodLabel,
                'debut' => $start->toIso8601String(),
                'fin' => $end->toIso8601String(),
                'precedent_debut' => $prevStart->toIso8601String(),
                'precedent_fin' => $prevEnd->toIso8601String(),
            ],
            'system_health' => $systemHealth,
            'kpis' => [
                'utilisateurs' => [
                    'total' => $totalUsers,
                    'clients' => $totalClients,
                    'agents' => $totalAgents,
                    'agents_kyc_en_attente' => $agentsKycPending,
                    'periode_count' => $usersInPeriod,
                    'clients_periode' => $clientsInPeriod,
                    'agents_periode' => $agentsInPeriod,
                    'periode_precedente' => $usersPrevPeriod,
                    'evolution_pct' => $this->calcEvolution($usersInPeriod, $usersPrevPeriod),
                ],
                'publications' => [
                    'total' => $pubsTotal,
                    'publiees' => $pubsPublished,
                    'en_attente' => $pubsPending,
                    'rejetees' => $pubsRejected,
                    'conclues' => $pubsConclues,
                    'periode_count' => $pubsInPeriod,
                    'periode_precedente' => $pubsPrevPeriod,
                    'evolution_pct' => $this->calcEvolution($pubsInPeriod, $pubsPrevPeriod),
                ],
                'demandes_recherche' => [
                    'total' => $demTotal,
                    'actives' => $demActives,
                    'satisfaites' => $demFulfilled,
                    'cloturees' => $demClosed,
                    'non_assignees' => $demUnassigned,
                    'periode_count' => $demInPeriod,
                    'periode_precedente' => $demPrevPeriod,
                    'evolution_pct' => $this->calcEvolution($demInPeriod, $demPrevPeriod),
                ],
                'visites_terrain' => [
                    'total' => $visTotal,
                    'en_attente' => $visPending,
                    'programmees' => $visConfirmed,
                    'effectuees' => $visCompleted,
                    'annulees' => $visCancelled,
                    'taux_completion_pct' => $visCompletionRate,
                    'periode_count' => $visInPeriod,
                    'periode_precedente' => $visPrevPeriod,
                    'evolution_pct' => $this->calcEvolution($visInPeriod, $visPrevPeriod),
                ],
                'demasquages_ttl' => [
                    'total' => $ttlTotal,
                    'en_attente' => $ttlPending,
                    'approuves' => $ttlApproved,
                    'actifs_maintenant' => $ttlActiveNow,
                    'refuses_ou_revoques' => $ttlRefusedOrRevoked,
                    'periode_count' => $ttlInPeriod,
                    'periode_precedente' => $ttlPrevPeriod,
                    'evolution_pct' => $this->calcEvolution($ttlInPeriod, $ttlPrevPeriod),
                ],
                'tresorerie' => $tresorerie,
            ],
            'charts' => [
                'evolution_activites' => $evolutionSeries,
                'repartition_demandes' => [
                    ['key' => 'active', 'label' => 'Actives', 'count' => $demActives, 'color' => '#008751'],
                    ['key' => 'fulfilled', 'label' => 'Satisfaites', 'count' => $demFulfilled, 'color' => '#2563EB'],
                    ['key' => 'closed', 'label' => 'Clôturées', 'count' => $demClosed, 'color' => '#94A3B8'],
                ],
                'repartition_publications' => [
                    ['key' => 'published', 'label' => 'Publiées', 'count' => $pubsPublished, 'color' => '#008751'],
                    ['key' => 'pending', 'label' => 'En attente', 'count' => $pubsPending, 'color' => '#D97706'],
                    ['key' => 'sold_rented', 'label' => 'Conclues', 'count' => $pubsConclues, 'color' => '#2563EB'],
                    ['key' => 'rejected', 'label' => 'Rejetées', 'count' => $pubsRejected, 'color' => '#DC2626'],
                ],
                'repartition_visites' => [
                    ['key' => 'pending', 'label' => 'En attente', 'count' => $visPending, 'color' => '#D97706'],
                    ['key' => 'confirmed', 'label' => 'Programmées', 'count' => $visConfirmed, 'color' => '#2563EB'],
                    ['key' => 'completed', 'label' => 'Effectuées', 'count' => $visCompleted, 'color' => '#008751'],
                    ['key' => 'cancelled', 'label' => 'Annulées', 'count' => $visCancelled, 'color' => '#94A3B8'],
                ],
                'performance_zones' => $zonesPerformance,
            ],
            'actions_en_attente' => $pendingActions,
            'sidebar_badges' => $sidebarBadges,
            'activites_recentes' => $recentActivities,
            'meta' => [
                'audit_logs_total' => $auditLogsTotal,
                'zones_actives_total' => count($zonesPerformance),
            ],
        ], 200);
    }

    /**
     * Résout la période demandée et calcule une période précédente de durée identique.
     *
     * @return array{0: string, 1: string, 2: Carbon, 3: Carbon, 4: Carbon, 5: Carbon}
     */
    protected function resolvePeriod(Request $request): array
    {
        $period = (string) $request->input('period', 'month');
        $now = now();

        if ($period === 'custom' && $request->filled('date_debut') && $request->filled('date_fin')) {
            try {
                $start = Carbon::parse($request->input('date_debut'))->startOfDay();
                $end = Carbon::parse($request->input('date_fin'))->endOfDay();
                if ($end->lt($start)) {
                    [$start, $end] = [$end->copy()->startOfDay(), $start->copy()->endOfDay()];
                }
                $diffSeconds = max(86400, (int) $start->diffInSeconds($end));
                $prevEnd = $start->copy()->subSecond();
                $prevStart = $prevEnd->copy()->subSeconds($diffSeconds);

                return [
                    'custom',
                    $start->format('d/m/Y') . ' – ' . $end->format('d/m/Y'),
                    $start,
                    $end,
                    $prevStart,
                    $prevEnd,
                ];
            } catch (\Throwable) {
                $period = 'month';
            }
        }

        return match ($period) {
            'today' => [
                'today',
                "Aujourd'hui",
                $now->copy()->startOfDay(),
                $now->copy()->endOfDay(),
                $now->copy()->subDay()->startOfDay(),
                $now->copy()->subDay()->endOfDay(),
            ],
            'week' => [
                'week',
                'Cette semaine',
                $now->copy()->subDays(6)->startOfDay(),
                $now->copy()->endOfDay(),
                $now->copy()->subDays(13)->startOfDay(),
                $now->copy()->subDays(7)->endOfDay(),
            ],
            'year' => [
                'year',
                'Cette année',
                $now->copy()->startOfYear(),
                $now->copy()->endOfDay(),
                $now->copy()->subYear()->startOfYear(),
                $now->copy()->subYear()->endOfYear(),
            ],
            default => [
                'month',
                'Ce mois',
                $now->copy()->startOfMonth(),
                $now->copy()->endOfDay(),
                $now->copy()->subMonthNoOverflow()->startOfMonth(),
                $now->copy()->subMonthNoOverflow()->endOfMonth(),
            ],
        };
    }

    /**
     * Calcule une évolution réelle en pourcentage uniquement si la base précédente est > 0.
     */
    protected function calcEvolution(float|int $current, float|int $previous): ?float
    {
        if ((float) $previous <= 0.0) {
            return null;
        }

        return round((((float) $current - (float) $previous) / (float) $previous) * 100, 1);
    }

    /**
     * Diagnostic léger temps réel de la plateforme.
     */
    protected function buildSystemHealth(): array
    {
        $dbOk = true;
        $latencyMs = null;
        try {
            $t0 = microtime(true);
            DB::select('SELECT 1');
            $latencyMs = round((microtime(true) - $t0) * 1000, 1);
        } catch (\Throwable) {
            $dbOk = false;
        }

        $failedJobs = 0;
        try {
            if (DB::getSchemaBuilder()->hasTable('failed_jobs')) {
                $failedJobs = (int) DB::table('failed_jobs')->count();
            }
        } catch (\Throwable) {
            // Ignorer
        }

        $status = ! $dbOk ? 'error' : ($failedJobs > 0 ? 'degraded' : 'operational');
        $label = match ($status) {
            'error' => 'Incident base de données',
            'degraded' => "Système dégradé ({$failedJobs} tâche(s) en échec)",
            default => 'Système opérationnel',
        };

        return [
            'status' => $status,
            'label' => $label,
            'db_latency_ms' => $latencyMs,
            'failed_jobs' => $failedJobs,
        ];
    }

    /**
     * Construit des séries temporelles réelles (inscriptions, publications, demandes) sur des intervalles cohérents.
     */
    protected function buildActivitySeries(string $periodKey, Carbon $start, Carbon $end): array
    {
        $buckets = [];

        if ($periodKey === 'today') {
            for ($h = 0; $h < 24; $h += 4) {
                $bStart = $start->copy()->addHours($h);
                $bEnd = $h === 20 ? $end->copy() : $start->copy()->addHours($h + 4)->subSecond();
                $buckets[] = ['label' => sprintf('%02dh', $h), 'start' => $bStart, 'end' => $bEnd];
            }
        } elseif ($periodKey === 'week') {
            $joursFr = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
            for ($i = 0; $i < 7; $i++) {
                $day = $start->copy()->addDays($i);
                $buckets[] = [
                    'label' => $joursFr[$day->dayOfWeek] . ' ' . $day->format('d'),
                    'start' => $day->copy()->startOfDay(),
                    'end' => $day->copy()->endOfDay(),
                ];
            }
        } elseif ($periodKey === 'year') {
            $moisFr = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
            for ($m = 1; $m <= 12; $m++) {
                $mStart = $start->copy()->month($m)->startOfMonth();
                $mEnd = $mStart->copy()->endOfMonth();
                $buckets[] = ['label' => $moisFr[$m], 'start' => $mStart, 'end' => $mEnd];
            }
        } else {
            // Mois en cours ou période personnalisée : découpage adaptatif en 6 à 10 tranches lisibles
            $totalDays = max(1, (int) $start->diffInDays($end) + 1);
            if ($totalDays <= 10) {
                for ($i = 0; $i < $totalDays; $i++) {
                    $day = $start->copy()->addDays($i);
                    $buckets[] = [
                        'label' => $day->format('d/m'),
                        'start' => $day->copy()->startOfDay(),
                        'end' => $day->copy()->endOfDay(),
                    ];
                }
            } else {
                $sliceCount = $totalDays <= 35 ? 6 : 8;
                $stepDays = (int) ceil($totalDays / $sliceCount);
                $cursor = $start->copy()->startOfDay();
                while ($cursor->lte($end)) {
                    $bEnd = $cursor->copy()->addDays($stepDays - 1)->endOfDay();
                    if ($bEnd->gt($end)) {
                        $bEnd = $end->copy();
                    }
                    $buckets[] = [
                        'label' => $cursor->format('d/m'),
                        'start' => $cursor->copy(),
                        'end' => $bEnd,
                    ];
                    $cursor = $bEnd->copy()->addSecond()->startOfDay();
                }
            }
        }

        // Récupération optimisée en 3 requêtes (timestamps uniquement) pour éviter N*3 requêtes SQL
        $userDates = User::whereBetween('created_at', [$start, $end])->pluck('created_at');
        $propDates = Proprietes::whereBetween('created_at', [$start, $end])->pluck('created_at');
        $demDates = Demande_client::whereBetween('created_at', [$start, $end])->pluck('created_at');

        $series = [];
        foreach ($buckets as $b) {
            $bStartTs = $b['start']->timestamp;
            $bEndTs = $b['end']->timestamp;

            $series[] = [
                'label' => $b['label'],
                'inscriptions' => $userDates->filter(fn ($d) => $d && $d->timestamp >= $bStartTs && $d->timestamp <= $bEndTs)->count(),
                'publications' => $propDates->filter(fn ($d) => $d && $d->timestamp >= $bStartTs && $d->timestamp <= $bEndTs)->count(),
                'demandes' => $demDates->filter(fn ($d) => $d && $d->timestamp >= $bStartTs && $d->timestamp <= $bEndTs)->count(),
            ];
        }

        return $series;
    }

    /**
     * Agrège les performances opérationnelles réelles pour chaque zone active en base.
     * Évite les doubles comptages en rattachant prioritairement par zone_id puis par commune si zone_id est null.
     */
    protected function buildZonesPerformance(): array
    {
        $zones = Zone::where('is_active', true)->orderBy('id')->get();
        if ($zones->isEmpty()) {
            return [];
        }

        // Charger les résumés légers une seule fois
        $allProps = Proprietes::select('id', 'zone_id', 'commune', 'status')->get();
        $allVisits = Visite_client::with('propriete:id,zone_id,commune')
            ->select('id', 'zone_id', 'property_id', 'status')
            ->get();
        $allDemands = Demande_client::select('id', 'zone_id', 'target_commune', 'status')->get();

        // Map commune (lowercase) -> premier zone_id de cette commune (fallback unique sans double comptage)
        $communeFallbackZone = [];
        foreach ($zones as $z) {
            $cKey = mb_strtolower(trim((string) $z->commune));
            if ($cKey !== '' && ! isset($communeFallbackZone[$cKey])) {
                $communeFallbackZone[$cKey] = $z->id;
            }
        }

        $stats = [];
        foreach ($zones as $z) {
            $stats[$z->id] = [
                'id' => $z->id,
                'code' => $z->code,
                'nom' => $z->nom,
                'commune' => $z->commune,
                'departement' => $z->departement,
                'visites_total' => 0,
                'visites_effectuees' => 0,
                'biens_actifs' => 0,
                'biens_conclus' => 0,
                'biens_en_attente' => 0,
                'demandes_total' => 0,
                'demandes_traitees' => 0,
            ];
        }

        foreach ($allProps as $p) {
            $zId = $p->zone_id;
            if (! $zId || ! isset($stats[$zId])) {
                $cKey = mb_strtolower(trim((string) $p->commune));
                $zId = $communeFallbackZone[$cKey] ?? null;
            }
            if (! $zId || ! isset($stats[$zId])) {
                continue;
            }
            if ($p->status === 'published') {
                $stats[$zId]['biens_actifs']++;
            } elseif ($p->status === 'sold_rented') {
                $stats[$zId]['biens_conclus']++;
            } elseif (in_array($p->status, ['pending', 'pending_payment'], true)) {
                $stats[$zId]['biens_en_attente']++;
            }
        }

        foreach ($allVisits as $v) {
            $zId = $v->zone_id ?: $v->propriete?->zone_id;
            if (! $zId || ! isset($stats[$zId])) {
                $cKey = mb_strtolower(trim((string) ($v->propriete?->commune ?? '')));
                $zId = $communeFallbackZone[$cKey] ?? null;
            }
            if (! $zId || ! isset($stats[$zId])) {
                continue;
            }
            $stats[$zId]['visites_total']++;
            if ($v->status === 'completed') {
                $stats[$zId]['visites_effectuees']++;
            }
        }

        foreach ($allDemands as $d) {
            $zId = $d->zone_id;
            if (! $zId || ! isset($stats[$zId])) {
                $cKey = mb_strtolower(trim((string) $d->target_commune));
                $zId = $communeFallbackZone[$cKey] ?? null;
            }
            if (! $zId || ! isset($stats[$zId])) {
                continue;
            }
            $stats[$zId]['demandes_total']++;
            if (in_array($d->status, ['fulfilled', 'closed'], true)) {
                $stats[$zId]['demandes_traitees']++;
            }
        }

        $result = [];
        foreach ($stats as $row) {
            $totalOps = $row['visites_total'] + $row['demandes_total'];
            $doneOps = $row['visites_effectuees'] + $row['demandes_traitees'];
            $row['dossiers_traites'] = $doneOps + $row['biens_conclus'];
            $row['taux_realisation_pct'] = $totalOps > 0 ? round(($doneOps / $totalOps) * 100, 1) : 0.0;
            $result[] = $row;
        }

        return $result;
    }

    /**
     * Flux unifié et paginé d'activités récentes issues des données réelles de la BDD.
     */
    protected function buildRecentActivities(bool $isFinancialOwner, int $page, int $perPage): array
    {
        $events = collect();

        // 1. Derniers logs d'audit
        $auditQuery = AuditLog::with('user:id,name,prenom')->latest('created_at')->limit(15);
        if (! $isFinancialOwner) {
            $auditQuery->where('is_financial', false);
        }
        foreach ($auditQuery->get() as $log) {
            $actor = $log->user ? trim("{$log->user->prenom} {$log->user->name}") : 'Système';
            $events->push([
                'id' => 'audit-' . $log->id,
                'category' => $log->is_financial ? 'finance' : 'audit',
                'title' => str_replace('_', ' ', ucfirst((string) $log->action)),
                'description' => "Action tracée par {$actor}" . ($log->ip_address ? " ({$log->ip_address})" : ''),
                'actor' => $actor,
                'status' => $log->is_financial ? 'Finance' : 'Audit',
                'target_page' => $log->is_financial ? 'finance' : 'logs',
                'created_at' => $log->created_at?->toIso8601String(),
                '_ts' => $log->created_at?->timestamp ?? 0,
            ]);
        }

        // 2. Dernières inscriptions (Clients & Agents)
        foreach (User::with('roles:id,name')->latest('created_at')->limit(8)->get() as $u) {
            $role = $u->roles->first()?->name ?? 'Client';
            $full = trim("{$u->prenom} {$u->name}") ?: $u->email;
            $events->push([
                'id' => 'user-' . $u->id,
                'category' => $role === 'Agent mobilier' ? 'agent' : 'client',
                'title' => $role === 'Agent mobilier' ? 'Nouvelle inscription Agent' : 'Nouvelle inscription Client',
                'description' => "{$full} ({$role})",
                'actor' => $full,
                'status' => $u->statut ?? 'actif',
                'target_page' => 'equipe',
                'created_at' => $u->created_at?->toIso8601String(),
                '_ts' => $u->created_at?->timestamp ?? 0,
            ]);
        }

        // 3. Dernières publications
        foreach (Proprietes::with('user:id,name,prenom')->latest('created_at')->limit(8)->get() as $p) {
            $actor = $p->user ? trim("{$p->user->prenom} {$p->user->name}") : 'Utilisateur';
            $events->push([
                'id' => 'prop-' . $p->id,
                'category' => 'publication',
                'title' => 'Publication #' . $p->id . ' — ' . ucfirst((string) $p->type),
                'description' => "{$p->commune}" . ($p->quartier ? ", {$p->quartier}" : '') . " ({$p->transaction_type})",
                'actor' => $actor,
                'status' => $p->status,
                'target_page' => 'moderation',
                'created_at' => $p->created_at?->toIso8601String(),
                '_ts' => $p->created_at?->timestamp ?? 0,
            ]);
        }

        // 4. Dernières demandes de recherche
        foreach (Demande_client::with('client:id,name,prenom')->latest('created_at')->limit(6)->get() as $d) {
            $actor = $d->client ? trim("{$d->client->prenom} {$d->client->name}") : 'Client';
            $events->push([
                'id' => 'dem-' . $d->id,
                'category' => 'demande',
                'title' => 'Demande DEM-' . str_pad((string) $d->id, 5, '0', STR_PAD_LEFT),
                'description' => ucfirst((string) $d->property_type) . " ({$d->transaction_type}) à {$d->target_commune}",
                'actor' => $actor,
                'status' => $d->status,
                'target_page' => 'visites',
                'sub_tab' => 'demandes',
                'created_at' => $d->created_at?->toIso8601String(),
                '_ts' => $d->created_at?->timestamp ?? 0,
            ]);
        }

        // 5. Dernières visites programmées
        foreach (Visite_client::with(['client:id,name,prenom', 'propriete:id,commune,type'])->latest('created_at')->limit(6)->get() as $v) {
            $actor = $v->client ? trim("{$v->client->prenom} {$v->client->name}") : 'Client';
            $loc = $v->propriete ? "{$v->propriete->type} à {$v->propriete->commune}" : "Bien #{$v->property_id}";
            $events->push([
                'id' => 'vis-' . $v->id,
                'category' => 'visite',
                'title' => 'Visite VIS-' . str_pad((string) $v->id, 5, '0', STR_PAD_LEFT),
                'description' => "{$loc} • " . ($v->scheduled_date ? $v->scheduled_date->format('d/m H:i') : ''),
                'actor' => $actor,
                'status' => $v->status,
                'target_page' => 'visites',
                'sub_tab' => 'visites',
                'created_at' => $v->created_at?->toIso8601String(),
                '_ts' => $v->created_at?->timestamp ?? 0,
            ]);
        }

        // 6. Dernières opérations financières (strictement si propriétaire financier)
        if ($isFinancialOwner) {
            foreach (GrandLivre::latest('id')->limit(6)->get() as $gl) {
                $montant = number_format((float) $gl->montant_net, 0, ',', ' ') . ' FCFA';
                $events->push([
                    'id' => 'gl-' . $gl->id,
                    'category' => 'finance',
                    'title' => ($gl->type_mouvement === 'credit' ? 'Encaissement ' : 'Décaissement ') . $montant,
                    'description' => (string) $gl->description,
                    'actor' => $gl->reference_unique,
                    'status' => $gl->type_mouvement === 'credit' ? 'credit' : 'debit',
                    'target_page' => 'finance',
                    'created_at' => $gl->created_at?->toIso8601String(),
                    '_ts' => $gl->created_at?->timestamp ?? 0,
                ]);
            }
        }

        $sorted = $events->sortByDesc('_ts')->values();
        $total = $sorted->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $safePage = min($page, $lastPage);
        $slice = $sorted->slice(($safePage - 1) * $perPage, $perPage)
            ->map(function ($e) {
                unset($e['_ts']);
                return $e;
            })
            ->values()
            ->all();

        return [
            'data' => $slice,
            'current_page' => $safePage,
            'last_page' => $lastPage,
            'per_page' => $perPage,
            'total' => $total,
        ];
    }
}
