import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  RefreshCw,
  ScrollText,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  ActivityLineChart,
  DonutChart,
  ZonePerformancePanel,
} from '@/components/super-admin/dashboard-charts';
import { SA_COLORS, type SuperAdminPageKey } from '@/components/super-admin/super-admin-sections';
import { useAuth } from '@/context/auth-context';
import { useResponsive } from '@/hooks/use-responsive';
import { adminApi } from '@/services/api';
import type {
  SuperAdminDashboardOverview,
  SuperAdminDashboardPeriod,
  SuperAdminRecentActivity,
  SuperAdminSidebarBadges,
  SuperAdminSystemHealthSummary,
} from '@/types/api';
import { formatFcfa } from '@/types/property';

const PERIOD_OPTIONS: { key: SuperAdminDashboardPeriod; label: string }[] = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week', label: 'Cette semaine' },
  { key: 'month', label: 'Ce mois' },
  { key: 'year', label: 'Cette année' },
  { key: 'custom', label: 'Personnalisée' },
];

export interface SuperAdminDashboardNavigateTarget {
  page: SuperAdminPageKey;
  subTab?: string;
}

interface SuperAdminDashboardProProps {
  onNavigate: (page: SuperAdminPageKey, subTab?: string) => void;
  onSyncHeaderState?: (payload: {
    sidebarBadges: SuperAdminSidebarBadges;
    systemHealth: SuperAdminSystemHealthSummary;
  }) => void;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getActivityMeta(cat: string) {
  switch (cat) {
    case 'client':
      return { Icon: UserPlus, bg: '#EBF7F1', color: '#008751' };
    case 'agent':
      return { Icon: UserCheck, bg: '#EFF6FF', color: '#2563EB' };
    case 'publication':
      return { Icon: Building2, bg: '#FFFBEB', color: '#D97706' };
    case 'demande':
      return { Icon: Search, bg: '#F5F3FF', color: '#7C3AED' };
    case 'visite':
      return { Icon: CalendarCheck, bg: '#ECFEFF', color: '#0891B2' };
    case 'finance':
      return { Icon: Wallet, bg: '#ECFDF5', color: '#059669' };
    default:
      return { Icon: Activity, bg: '#F1F5F9', color: '#475569' };
  }
}

function getStatusPillColors(status: string) {
  const s = (status || '').toLowerCase();
  if (['published', 'completed', 'fulfilled', 'actif', 'credit', 'approuve'].includes(s)) {
    return { bg: '#EBF7F1', text: '#008751' };
  }
  if (['pending', 'pending_payment', 'en_attente', 'active', 'confirmed'].includes(s)) {
    return { bg: '#FFFBEB', text: '#B45309' };
  }
  if (['rejected', 'cancelled', 'refuse', 'revoque', 'debit', 'suspendu'].includes(s)) {
    return { bg: '#FEF2F2', text: '#DC2626' };
  }
  return { bg: '#F1F5F9', text: '#475569' };
}

export function SuperAdminDashboardPro({
  onNavigate,
  onSyncHeaderState,
}: SuperAdminDashboardProProps) {
  const { isFinancialOwner } = useAuth();
  const { isMobile, isTablet, isDesktop } = useResponsive();

  const [period, setPeriod] = useState<SuperAdminDashboardPeriod>('month');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [activityPage, setActivityPage] = useState(1);
  const [donutTab, setDonutTab] = useState<'demandes' | 'publications' | 'visites'>('demandes');

  const [data, setData] = useState<SuperAdminDashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadOverview = useCallback(
    async (opts?: {
      periodOverride?: SuperAdminDashboardPeriod;
      pageOverride?: number;
      silent?: boolean;
    }) => {
      const targetPeriod = opts?.periodOverride ?? period;
      const targetPage = opts?.pageOverride ?? activityPage;

      if (opts?.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMsg(null);

      try {
        const res = await adminApi.getSuperAdminDashboard({
          period: targetPeriod,
          date_debut: targetPeriod === 'custom' ? customStart : undefined,
          date_fin: targetPeriod === 'custom' ? customEnd : undefined,
          activity_page: targetPage,
          activity_per_page: 8,
        });

        if (res.success && res.kpis && res.charts) {
          const overview = res as unknown as SuperAdminDashboardOverview;
          setData(overview);
          onSyncHeaderState?.({
            sidebarBadges: overview.sidebar_badges,
            systemHealth: overview.system_health,
          });
        } else {
          setErrorMsg(res.message || 'Impossible de charger les indicateurs du tableau de bord.');
        }
      } catch {
        setErrorMsg('Erreur réseau lors de la récupération du tableau de bord.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period, customStart, customEnd, activityPage, onSyncHeaderState]
  );

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const handleSelectPeriod = (next: SuperAdminDashboardPeriod) => {
    setPeriod(next);
    setActivityPage(1);
  };

  // Skeleton Loader State
  if (loading && !data) {
    return (
      <View style={styles.rootGap}>
        <View style={styles.toolbarCard}>
          <View style={[styles.skeletonLine, { width: 220, height: 18 }]} />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={[styles.skeletonLine, { width: 90, height: 32, borderRadius: 10 }]} />
            ))}
          </View>
        </View>
        <View style={styles.kpiGrid}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View
              key={i}
              style={[
                styles.kpiCard,
                {
                  width: isDesktop ? '32%' : isTablet ? '48.5%' : '100%',
                  gap: 10,
                },
              ]}>
              <View style={[styles.skeletonLine, { width: 110, height: 13 }]} />
              <View style={[styles.skeletonLine, { width: 140, height: 26 }]} />
              <View style={[styles.skeletonLine, { width: '80%', height: 12 }]} />
            </View>
          ))}
        </View>
        <View style={[styles.card, { gap: 12 }]}>
          <View style={[styles.skeletonLine, { width: 200, height: 16 }]} />
          <View style={[styles.skeletonLine, { width: '100%', height: 190, borderRadius: 14 }]} />
        </View>
      </View>
    );
  }

  if (errorMsg && !data) {
    return (
      <View style={[styles.card, { alignItems: 'center', paddingVertical: 32, gap: 12 }]}>
        <AlertCircle size={32} color={SA_COLORS.danger} strokeWidth={2} />
        <Text style={styles.cardTitle}>Chargement impossible</Text>
        <Text style={styles.mutedText}>{errorMsg}</Text>
        <Pressable onPress={() => void loadOverview()} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Réessayer</Text>
        </Pressable>
      </View>
    );
  }

  if (!data) return null;

  const { kpis, charts, actions_en_attente: pendingActions, activites_recentes: activities } = data;
  const kpiWidth = isDesktop ? '32.2%' : isTablet ? '48.8%' : '100%';

  const activeDonutSlices =
    donutTab === 'demandes'
      ? charts.repartition_demandes
      : donutTab === 'publications'
      ? charts.repartition_publications
      : charts.repartition_visites;
  const activeDonutCenterLabel =
    donutTab === 'demandes'
      ? 'Demandes'
      : donutTab === 'publications'
      ? 'Publications'
      : 'Visites';

  return (
    <View style={styles.rootGap}>
      {/* ================================================================= */}
      {/* BARRE DE CONTRÔLE TEMPOREL & RAFRAÎCHISSEMENT                     */}
      {/* ================================================================= */}
      <View style={styles.toolbarCard}>
        <View style={styles.toolbarTopRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Calendar size={16} color={SA_COLORS.green} strokeWidth={2.2} />
            <Text style={styles.toolbarLabel}>Période d’analyse :</Text>
            <View style={styles.periodPillsRow}>
              {PERIOD_OPTIONS.map((opt) => {
                const active = period === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => handleSelectPeriod(opt.key)}
                    style={[styles.periodPill, active && styles.periodPillActive]}>
                    <Text style={[styles.periodPillText, active && styles.periodPillTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            onPress={() => void loadOverview({ silent: true })}
            disabled={refreshing}
            style={[styles.refreshBtn, refreshing && { opacity: 0.65 }]}>
            <RefreshCw size={14} color={SA_COLORS.green} strokeWidth={2.3} />
            <Text style={styles.refreshBtnText}>
              {refreshing ? 'Actualisation...' : 'Actualiser'}
            </Text>
          </Pressable>
        </View>

        {period === 'custom' && (
          <View style={styles.customDateRow}>
            <View style={styles.dateField}>
              <Text style={styles.dateFieldLabel}>Du (AAAA-MM-JJ)</Text>
              <TextInput
                style={styles.dateInput}
                value={customStart}
                onChangeText={setCustomStart}
                placeholder="2026-11-01"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={styles.dateField}>
              <Text style={styles.dateFieldLabel}>Au (AAAA-MM-JJ)</Text>
              <TextInput
                style={styles.dateInput}
                value={customEnd}
                onChangeText={setCustomEnd}
                placeholder="2026-11-30"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <Pressable
              onPress={() => void loadOverview({ periodOverride: 'custom', pageOverride: 1, silent: true })}
              style={styles.applyDateBtn}>
              <Text style={styles.primaryBtnText}>Appliquer</Text>
            </Pressable>
          </View>
        )}

        {errorMsg ? (
          <Text style={{ color: SA_COLORS.danger, fontSize: 12, fontWeight: '700' }}>{errorMsg}</Text>
        ) : null}
      </View>

      {/* ================================================================= */}
      {/* 6 CARTES STATISTIQUES PRINCIPALES (KPI EXÉCUTIFS)                 */}
      {/* ================================================================= */}
      <View style={styles.kpiGrid}>
        {/* 1. Utilisateurs inscrits */}
        <KpiCard
          width={kpiWidth}
          icon={<Users size={18} color="#008751" strokeWidth={2.2} />}
          iconBg="#EBF7F1"
          label="Utilisateurs inscrits"
          value={String(kpis.utilisateurs.total)}
          secondary={`${kpis.utilisateurs.clients} clients • ${kpis.utilisateurs.agents} agents`}
          periodNote={`+${kpis.utilisateurs.periode_count} sur ${data.periode.label.toLowerCase()}`}
          evolutionPct={kpis.utilisateurs.evolution_pct}
          onPress={() => onNavigate('equipe', 'governance')}
        />

        {/* 2. Publications */}
        <KpiCard
          width={kpiWidth}
          icon={<Building2 size={18} color="#2563EB" strokeWidth={2.2} />}
          iconBg="#EFF6FF"
          label="Publications"
          value={String(kpis.publications.publiees)}
          valueSuffix="publiées"
          secondary={`${kpis.publications.en_attente} en attente • ${kpis.publications.rejetees} rejetées`}
          periodNote={`${kpis.publications.total} au total (+${kpis.publications.periode_count} période)`}
          evolutionPct={kpis.publications.evolution_pct}
          accentColor={kpis.publications.en_attente > 0 ? '#D97706' : '#2563EB'}
          onPress={() => onNavigate('moderation')}
        />

        {/* 3. Demandes de recherche */}
        <KpiCard
          width={kpiWidth}
          icon={<Search size={18} color="#7C3AED" strokeWidth={2.2} />}
          iconBg="#F5F3FF"
          label="Demandes de recherche"
          value={String(kpis.demandes_recherche.total)}
          secondary={`${kpis.demandes_recherche.actives} actives • ${kpis.demandes_recherche.satisfaites + kpis.demandes_recherche.cloturees} traitées`}
          periodNote={`+${kpis.demandes_recherche.periode_count} sur ${data.periode.label.toLowerCase()}`}
          evolutionPct={kpis.demandes_recherche.evolution_pct}
          onPress={() => onNavigate('visites', 'demandes')}
        />

        {/* 4. Visites terrain */}
        <KpiCard
          width={kpiWidth}
          icon={<CalendarCheck size={18} color="#0891B2" strokeWidth={2.2} />}
          iconBg="#ECFEFF"
          label="Visites terrain"
          value={String(kpis.visites_terrain.total)}
          secondary={`${kpis.visites_terrain.programmees} programmées • ${kpis.visites_terrain.effectuees} effectuées • ${kpis.visites_terrain.en_attente} en attente`}
          periodNote={`Taux complétion : ${kpis.visites_terrain.taux_completion_pct}%`}
          evolutionPct={kpis.visites_terrain.evolution_pct}
          onPress={() => onNavigate('visites', 'visites')}
        />

        {/* 5. Démasquages TTL */}
        <KpiCard
          width={kpiWidth}
          icon={<ShieldAlert size={18} color="#D97706" strokeWidth={2.2} />}
          iconBg="#FFFBEB"
          label="Démasquages TTL"
          value={String(kpis.demasquages_ttl.total)}
          secondary={`${kpis.demasquages_ttl.en_attente} en attente • ${kpis.demasquages_ttl.approuves} validés (${kpis.demasquages_ttl.actifs_maintenant} actifs)`}
          periodNote={`+${kpis.demasquages_ttl.periode_count} sur ${data.periode.label.toLowerCase()}`}
          evolutionPct={kpis.demasquages_ttl.evolution_pct}
          accentColor={kpis.demasquages_ttl.en_attente > 0 ? '#DC2626' : '#008751'}
          onPress={() => onNavigate('demasquages')}
        />

        {/* 6. Trésorerie / Coffre-Fort (exclusif propriétaire financier) */}
        {isFinancialOwner && kpis.tresorerie ? (
          <KpiCard
            width={kpiWidth}
            icon={<Wallet size={18} color="#008751" strokeWidth={2.2} />}
            iconBg="#EBF7F1"
            label="Trésorerie / Coffre-fort"
            value={formatFcfa(kpis.tresorerie.solde_disponible)}
            valueColor={SA_COLORS.green}
            secondary={`Retraits virés : ${formatFcfa(kpis.tresorerie.total_retraits_executes)} • ${kpis.tresorerie.retraits_en_attente_count} en attente`}
            periodNote={
              kpis.tresorerie.retraits_geles
                ? 'Coupe-circuit actif (retraits gelés)'
                : `Encaissé période : ${formatFcfa(kpis.tresorerie.encaissements_periode)}`
            }
            evolutionPct={kpis.tresorerie.evolution_pct}
            onPress={() => onNavigate('finance')}
          />
        ) : (
          <KpiCard
            width={kpiWidth}
            icon={<ScrollText size={18} color="#475569" strokeWidth={2.2} />}
            iconBg="#F1F5F9"
            label="Journalisation globale"
            value={String(data.meta.audit_logs_total)}
            secondary={`${data.meta.zones_actives_total} zones actives supervisées`}
            periodNote="Audit de sécurité immuable"
            evolutionPct={null}
            onPress={() => onNavigate('logs')}
          />
        )}
      </View>

      {/* ================================================================= */}
      {/* SECTION : ACTIONS EN ATTENTE (INTERVENTION REQUISE)               */}
      {/* ================================================================= */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AlertCircle
              size={18}
              color={pendingActions.length > 0 ? '#D97706' : SA_COLORS.green}
              strokeWidth={2.2}
            />
            <View>
              <Text style={styles.cardTitle}>Actions en attente</Text>
              <Text style={styles.cardSub}>
                Opérations nécessitant une validation ou une intervention administrative
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.countBadge,
              {
                backgroundColor: pendingActions.length > 0 ? SA_COLORS.amberBg : SA_COLORS.greenSoft,
                borderColor: pendingActions.length > 0 ? SA_COLORS.amberBorder : SA_COLORS.greenBorder,
              },
            ]}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '800',
                color: pendingActions.length > 0 ? SA_COLORS.amberText : SA_COLORS.green,
              }}>
              {pendingActions.reduce((acc, a) => acc + a.count, 0)} en attente
            </Text>
          </View>
        </View>

        {pendingActions.length === 0 ? (
          <View style={styles.allClearBox}>
            <CheckCircle2 size={20} color={SA_COLORS.green} strokeWidth={2.2} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: SA_COLORS.greenDark }}>
                Aucune intervention urgente requise
              </Text>
              <Text style={{ fontSize: 12, color: '#334155', marginTop: 2 }}>
                Toutes les publications, visites, demandes de démasquage et opérations sont à jour.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.pendingGrid}>
            {pendingActions.map((act) => {
              const dotColor =
                act.severity === 'high'
                  ? '#DC2626'
                  : act.severity === 'medium'
                  ? '#D97706'
                  : '#2563EB';
              return (
                <Pressable
                  key={act.key}
                  onPress={() => onNavigate(act.target_page as SuperAdminPageKey, act.sub_tab)}
                  style={({ pressed }) => [
                    styles.pendingRow,
                    { width: isDesktop ? '49%' : '100%' },
                    pressed && { opacity: 0.85 },
                  ]}>
                  <View style={[styles.severityDot, { backgroundColor: dotColor }]} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.pendingLabel} numberOfLines={1}>
                      {act.label}
                    </Text>
                    <Text style={styles.pendingDesc} numberOfLines={1}>
                      {act.description}
                    </Text>
                  </View>
                  <View style={[styles.pendingCountChip, { backgroundColor: `${dotColor}14` }]}>
                    <Text style={[styles.pendingCountText, { color: dotColor }]}>{act.count}</Text>
                  </View>
                  <View style={styles.pendingGoBtn}>
                    <Text style={styles.pendingGoText}>Traiter</Text>
                    <ArrowRight size={13} color={SA_COLORS.green} strokeWidth={2.4} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* ================================================================= */}
      {/* SECTION : ANALYSE ET PERFORMANCE OPÉRATIONNELLE (GRAPHIQUES)      */}
      {/* ================================================================= */}
      <View style={[styles.analyticsGrid, !isDesktop && { flexDirection: 'column' }]}>
        {/* A. Évolution des activités (Line Chart) */}
        <View style={[styles.card, { flex: 1.55 }]}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={17} color={SA_COLORS.green} strokeWidth={2.2} />
              <View>
                <Text style={styles.cardTitle}>Évolution des activités</Text>
                <Text style={styles.cardSub}>
                  Inscriptions, publications et demandes — {data.periode.label}
                </Text>
              </View>
            </View>
          </View>

          <ActivityLineChart data={charts.evolution_activites} compact={isMobile} />
        </View>

        {/* B. Répartition des opérations (Donut Chart) */}
        <View style={[styles.card, { flex: 1 }]}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Répartition des opérations</Text>
              <Text style={styles.cardSub}>Ventilation temps réel par statut</Text>
            </View>
          </View>

          <View style={styles.miniTabsRow}>
            {(
              [
                { key: 'demandes', label: 'Demandes' },
                { key: 'publications', label: 'Publications' },
                { key: 'visites', label: 'Visites' },
              ] as const
            ).map((t) => {
              const active = donutTab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setDonutTab(t.key)}
                  style={[styles.miniTab, active && styles.miniTabActive]}>
                  <Text style={[styles.miniTabText, active && styles.miniTabTextActive]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <DonutChart slices={activeDonutSlices} centerLabel={activeDonutCenterLabel} />

          {/* Visit completion strip */}
          <View style={styles.completionStrip}>
            <Text style={styles.completionLabel}>Taux de réalisation visites terrain</Text>
            <Text style={styles.completionPct}>{kpis.visites_terrain.taux_completion_pct}%</Text>
          </View>
        </View>
      </View>

      {/* C. Performance géographique par zone */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.cardTitle}>Performance géographique par zone</Text>
            <Text style={styles.cardSub}>
              {charts.performance_zones.length} zone(s) active(s) configurée(s) en base de données
            </Text>
          </View>
          <Pressable onPress={() => onNavigate('equipe', 'governance')}>
            <Text style={styles.greenLink}>Gérer les zones →</Text>
          </Pressable>
        </View>

        <ZonePerformancePanel zones={charts.performance_zones} isMobile={isMobile} />
      </View>

      {/* ================================================================= */}
      {/* SECTION : ACTIVITÉS RÉCENTES & ACCÈS RAPIDES                      */}
      {/* ================================================================= */}
      <View style={[styles.analyticsGrid, !isDesktop && { flexDirection: 'column' }]}>
        {/* Activités récentes (réelles & paginées) */}
        <View style={[styles.card, { flex: 1.5 }]}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Clock size={17} color={SA_COLORS.green} strokeWidth={2.2} />
              <View>
                <Text style={styles.cardTitle}>Activités récentes</Text>
                <Text style={styles.cardSub}>
                  Événements réels issus de la plateforme et du journal d’audit
                </Text>
              </View>
            </View>
            <Pressable onPress={() => onNavigate('logs')} style={styles.outlineLinkBtn}>
              <Text style={styles.greenLink}>Voir toutes les activités</Text>
            </Pressable>
          </View>

          {activities.data.length === 0 ? (
            <View style={styles.emptyActivityBox}>
              <Text style={styles.mutedText}>Aucune activité récente enregistrée.</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {activities.data.map((ev: SuperAdminRecentActivity) => {
                const meta = getActivityMeta(ev.category);
                const pill = getStatusPillColors(ev.status);
                const IconComp = meta.Icon;
                return (
                  <Pressable
                    key={ev.id}
                    onPress={() => onNavigate(ev.target_page as SuperAdminPageKey, ev.sub_tab)}
                    style={({ pressed }) => [styles.activityRow, pressed && { opacity: 0.8 }]}>
                    <View style={[styles.activityIconWrap, { backgroundColor: meta.bg }]}>
                      <IconComp size={15} color={meta.color} strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.activityTitle} numberOfLines={1}>
                        {ev.title}
                      </Text>
                      <Text style={styles.activityDesc} numberOfLines={1}>
                        {ev.description}
                      </Text>
                    </View>
                    <View style={styles.activityMetaRight}>
                      <View style={[styles.statusMiniPill, { backgroundColor: pill.bg }]}>
                        <Text style={[styles.statusMiniText, { color: pill.text }]}>
                          {ev.status}
                        </Text>
                      </View>
                      <Text style={styles.activityTime}>{formatDateTime(ev.created_at)}</Text>
                    </View>
                  </Pressable>
                );
              })}

              {activities.last_page > 1 && (
                <View style={styles.activityPager}>
                  <Pressable
                    onPress={() => setActivityPage((p) => Math.max(1, p - 1))}
                    disabled={activities.current_page <= 1}
                    style={[
                      styles.pagerBtn,
                      activities.current_page <= 1 && { opacity: 0.45 },
                    ]}>
                    <ChevronLeft size={14} color={SA_COLORS.text} strokeWidth={2.2} />
                    <Text style={styles.pagerBtnText}>Précédent</Text>
                  </Pressable>
                  <Text style={styles.pagerInfo}>
                    Page {activities.current_page} / {activities.last_page}
                  </Text>
                  <Pressable
                    onPress={() => setActivityPage((p) => Math.min(activities.last_page, p + 1))}
                    disabled={activities.current_page >= activities.last_page}
                    style={[
                      styles.pagerBtn,
                      activities.current_page >= activities.last_page && { opacity: 0.45 },
                    ]}>
                    <Text style={styles.pagerBtnText}>Suivant</Text>
                    <ChevronRight size={14} color={SA_COLORS.text} strokeWidth={2.2} />
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Accès rapides métier */}
        <View style={[styles.card, { flex: 1 }]}>
          <View>
            <Text style={styles.cardTitle}>Accès rapides</Text>
            <Text style={styles.cardSub}>Raccourcis vers vos actions de pilotage quotidiennes</Text>
          </View>

          <View style={{ gap: 8 }}>
            {[
              {
                key: 'posts',
                title: 'Modérer les posts Clients & Agents',
                sub: 'Valider, rejeter ou auditer les titres fonciers',
                Icon: Building2,
                color: '#2563EB',
                bg: '#EFF6FF',
                onPress: () => onNavigate('moderation'),
              },
              {
                key: 'visits',
                title: 'Planifier visites & matching demandes',
                sub: 'Affecter les zones et suivre les comptes-rendus',
                Icon: CalendarCheck,
                color: '#0891B2',
                bg: '#ECFEFF',
                onPress: () => onNavigate('visites', 'visites'),
              },
              {
                key: 'ttl',
                title: 'Arbitrer les démasquages TTL',
                sub: 'Contrôle anti-contournement des coordonnées',
                Icon: ShieldAlert,
                color: '#D97706',
                bg: '#FFFBEB',
                onPress: () => onNavigate('demasquages'),
              },
              ...(isFinancialOwner
                ? [
                    {
                      key: 'vault',
                      title: 'Coffre-fort, Grand Livre & retraits OTP',
                      sub: 'Décaissements sécurisés et intégrité HMAC',
                      Icon: Wallet,
                      color: '#008751',
                      bg: '#EBF7F1',
                      onPress: () => onNavigate('finance'),
                    },
                  ]
                : []),
              {
                key: 'logs',
                title: 'Consulter la journalisation globale',
                sub: `${data.meta.audit_logs_total} événement(s) tracé(s) en base`,
                Icon: FileText,
                color: '#475569',
                bg: '#F1F5F9',
                onPress: () => onNavigate('logs'),
              },
              {
                key: 'team',
                title: 'Gérer équipes, KYC agents & zones',
                sub: 'Rôles RBAC, agréments et découpage territorial',
                Icon: Users,
                color: '#7C3AED',
                bg: '#F5F3FF',
                onPress: () => onNavigate('equipe', 'governance'),
              },
              {
                key: 'params',
                title: 'Configurer les paramètres & tarifs',
                sub: 'Frais officiels, contacts et durées TTL',
                Icon: SlidersHorizontal,
                color: '#008751',
                bg: '#EBF7F1',
                onPress: () => onNavigate('parametres'),
              },
            ].map((q) => (
              <Pressable
                key={q.key}
                onPress={q.onPress}
                style={({ pressed }) => [styles.quickRow, pressed && { opacity: 0.8 }]}>
                <View style={[styles.quickIconBox, { backgroundColor: q.bg }]}>
                  <q.Icon size={16} color={q.color} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.quickTitle} numberOfLines={1}>
                    {q.title}
                  </Text>
                  <Text style={styles.quickSub} numberOfLines={1}>
                    {q.sub}
                  </Text>
                </View>
                <ArrowRight size={15} color="#94A3B8" strokeWidth={2.2} />
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

/* ============================================================================
 * COMPOSANT CARTE KPI PRINCIPALE
 * ========================================================================== */
function KpiCard({
  width,
  icon,
  iconBg,
  label,
  value,
  valueSuffix,
  valueColor,
  secondary,
  periodNote,
  evolutionPct,
  accentColor,
  onPress,
}: {
  width: string;
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  valueSuffix?: string;
  valueColor?: string;
  secondary: string;
  periodNote: string;
  evolutionPct: number | null;
  accentColor?: string;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.kpiCard,
        {
          width: width as any,
          borderColor: hovered ? SA_COLORS.greenBorder : SA_COLORS.border,
          opacity: pressed ? 0.92 : 1,
        },
        Platform.OS === 'web'
          ? ({
              cursor: 'pointer',
              transition: 'border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease',
              boxShadow: hovered
                ? '0 8px 20px rgba(15, 23, 42, 0.08)'
                : '0 1px 3px rgba(15, 23, 42, 0.04)',
              transform: hovered ? [{ translateY: -2 }] : [{ translateY: 0 }],
            } as any)
          : null,
      ]}>
      <View style={styles.kpiTopRow}>
        <View style={[styles.kpiIconBox, { backgroundColor: iconBg }]}>{icon}</View>
        {evolutionPct !== null ? (
          <View
            style={[
              styles.evoBadge,
              {
                backgroundColor: evolutionPct >= 0 ? '#EBF7F1' : '#FEF2F2',
              },
            ]}>
            {evolutionPct >= 0 ? (
              <ArrowUpRight size={12} color="#008751" strokeWidth={2.5} />
            ) : (
              <ArrowDownRight size={12} color="#DC2626" strokeWidth={2.5} />
            )}
            <Text
              style={{
                fontSize: 11,
                fontWeight: '800',
                color: evolutionPct >= 0 ? '#008751' : '#DC2626',
              }}>
              {evolutionPct > 0 ? `+${evolutionPct}%` : `${evolutionPct}%`}
            </Text>
          </View>
        ) : (
          <ArrowRight size={14} color="#CBD5E1" strokeWidth={2.2} />
        )}
      </View>

      <Text style={styles.kpiLabel}>{label}</Text>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
        <Text style={[styles.kpiValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
        {valueSuffix ? <Text style={styles.kpiSuffix}>{valueSuffix}</Text> : null}
      </View>

      <Text style={styles.kpiSecondary} numberOfLines={2}>
        {secondary}
      </Text>

      <View style={styles.kpiFooterRow}>
        <Text
          style={[styles.kpiPeriodNote, accentColor ? { color: accentColor } : null]}
          numberOfLines={1}>
          {periodNote}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rootGap: { gap: 16 },
  toolbarCard: {
    backgroundColor: SA_COLORS.white,
    borderWidth: 1,
    borderColor: SA_COLORS.border,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  toolbarTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  toolbarLabel: { fontSize: 12, fontWeight: '800', color: SA_COLORS.text },
  periodPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  periodPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: SA_COLORS.slateSoft,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  periodPillActive: {
    backgroundColor: SA_COLORS.greenSoft,
    borderColor: SA_COLORS.greenBorder,
  },
  periodPillText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  periodPillTextActive: { color: SA_COLORS.green, fontWeight: '800' },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SA_COLORS.greenBorder,
    backgroundColor: SA_COLORS.greenSoft,
  },
  refreshBtnText: { fontSize: 12, fontWeight: '800', color: SA_COLORS.green },
  customDateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 10,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: SA_COLORS.slateSoft,
  },
  dateField: { flex: 1, minWidth: 140, gap: 4 },
  dateFieldLabel: { fontSize: 11, fontWeight: '700', color: SA_COLORS.muted },
  dateInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: SA_COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: SA_COLORS.text,
  },
  applyDateBtn: {
    backgroundColor: SA_COLORS.green,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryBtn: {
    backgroundColor: SA_COLORS.green,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  kpiCard: {
    backgroundColor: SA_COLORS.white,
    borderWidth: 1,
    borderColor: SA_COLORS.border,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  kpiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  kpiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  evoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  kpiLabel: { fontSize: 12, fontWeight: '700', color: SA_COLORS.muted },
  kpiValue: { fontSize: 22, fontWeight: '900', color: SA_COLORS.text, letterSpacing: -0.3 },
  kpiSuffix: { fontSize: 12, fontWeight: '700', color: SA_COLORS.muted },
  kpiSecondary: { fontSize: 12, color: '#334155', lineHeight: 17 },
  kpiFooterRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  kpiPeriodNote: { fontSize: 11, fontWeight: '700', color: SA_COLORS.green },

  card: {
    backgroundColor: SA_COLORS.white,
    borderWidth: 1,
    borderColor: SA_COLORS.border,
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: '900', color: SA_COLORS.text },
  cardSub: { fontSize: 12, color: SA_COLORS.muted, marginTop: 1 },
  mutedText: { fontSize: 13, color: SA_COLORS.muted },
  greenLink: { fontSize: 12, fontWeight: '800', color: SA_COLORS.green },
  outlineLinkBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: SA_COLORS.greenSoft,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },

  allClearBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SA_COLORS.greenSoft,
    borderWidth: 1,
    borderColor: SA_COLORS.greenBorder,
    borderRadius: 12,
    padding: 14,
  },
  pendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: SA_COLORS.border,
    borderRadius: 12,
    padding: 12,
  },
  severityDot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  pendingLabel: { fontSize: 13, fontWeight: '800', color: SA_COLORS.text },
  pendingDesc: { fontSize: 11, color: SA_COLORS.muted, marginTop: 1 },
  pendingCountChip: {
    minWidth: 28,
    height: 26,
    borderRadius: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingCountText: { fontSize: 12, fontWeight: '900' },
  pendingGoBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pendingGoText: { fontSize: 12, fontWeight: '800', color: SA_COLORS.green },

  analyticsGrid: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'stretch',
  },
  miniTabsRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: SA_COLORS.slateSoft,
    padding: 4,
    borderRadius: 11,
  },
  miniTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  miniTabActive: { backgroundColor: SA_COLORS.white },
  miniTabText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  miniTabTextActive: { color: SA_COLORS.green, fontWeight: '800' },
  completionStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: SA_COLORS.greenSoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  completionLabel: { fontSize: 12, fontWeight: '700', color: SA_COLORS.greenDark },
  completionPct: { fontSize: 14, fontWeight: '900', color: SA_COLORS.green },

  emptyActivityBox: { paddingVertical: 20, alignItems: 'center' },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  activityIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activityTitle: { fontSize: 13, fontWeight: '800', color: SA_COLORS.text },
  activityDesc: { fontSize: 11, color: SA_COLORS.muted, marginTop: 1 },
  activityMetaRight: { alignItems: 'flex-end', gap: 3, flexShrink: 0 },
  statusMiniPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  statusMiniText: { fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  activityTime: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  activityPager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  pagerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SA_COLORS.border,
    backgroundColor: SA_COLORS.white,
  },
  pagerBtnText: { fontSize: 12, fontWeight: '700', color: SA_COLORS.text },
  pagerInfo: { fontSize: 12, fontWeight: '700', color: SA_COLORS.muted },

  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  quickIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  quickTitle: { fontSize: 13, fontWeight: '800', color: SA_COLORS.text },
  quickSub: { fontSize: 11, color: SA_COLORS.muted, marginTop: 1 },

  skeletonLine: {
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
  },
});
