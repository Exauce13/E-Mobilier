import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/context/auth-context';
import { usePlatformConfig } from '@/context/platform-config-context';
import { adminApi, authApi, financeApi, getStorageBaseUrl } from '@/services/api';
import type {
  AuditLogItem,
  BackendProperty,
  GrandLivreEntry,
  OperationalMetricsData,
  PlatformSettingItem,
  PropertyDocumentItem,
  RetraitItem,
  ZonePerformanceData,
  ZoneSummary,
} from '@/types/api';
import { formatFcfa, resolveStorageUrl } from '@/types/property';
import { confirmDialog } from '@/utils/dialog';

export const SA_COLORS = {
  white: '#FFFFFF',
  bg: '#F8FBF9',
  green: '#008751',
  greenDark: '#006B40',
  greenSoft: '#EBF7F1',
  greenBorder: '#B7E4CE',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  slateSoft: '#F1F5F9',
  amberBg: '#FFFBEB',
  amberText: '#92400E',
  amberBorder: '#FDE68A',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  dangerBorder: '#FECACA',
} as const;

export type SuperAdminPageKey =
  | 'dashboard'
  | 'finance'
  | 'moderation'
  | 'visites'
  | 'demasquages'
  | 'equipe'
  | 'logs'
  | 'parametres'
  | 'securite'
  | 'profil';

function showFeedback(title: string, msg: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${msg}`);
  } else {
    Alert.alert(title, msg);
  }
}

/* ============================================================================
 * 1. TABLEAU DE BORD (VUE GLOBALE)
 * ========================================================================== */
export function SuperAdminDashboardSection({
  onNavigate,
}: {
  onNavigate: (page: SuperAdminPageKey) => void;
}) {
  const { isFinancialOwner } = useAuth();
  const [loading, setLoading] = useState(true);
  const [solde, setSolde] = useState<number>(0);
  const [pendingPostsCount, setPendingPostsCount] = useState<number>(0);
  const [totalPostsCount, setTotalPostsCount] = useState<number>(0);
  const [pendingDemasquagesCount, setPendingDemasquagesCount] = useState<number>(0);
  const [logsCount, setLogsCount] = useState<number>(0);
  const [globalMetrics, setGlobalMetrics] = useState<OperationalMetricsData | null>(null);
  const [zones, setZones] = useState<ZoneSummary[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<number | undefined>(undefined);
  const [zonePerf, setZonePerf] = useState<ZonePerformanceData | null>(null);

  const loadZonePerf = useCallback(async (zoneId?: number) => {
    const zoneRes: any = await adminApi.getZonePerformance(zoneId).catch(() => null);
    if (zoneRes?.success && zoneRes.zone) {
      setZonePerf({
        zone: zoneRes.zone,
        performance_operationnelle: zoneRes.performance_operationnelle || {},
      });
    } else {
      setZonePerf(null);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [finRes, allPostsRes, pendingPostsRes, demRes, logsRes, opsRes, zonesRes] =
        await Promise.all([
          isFinancialOwner ? financeApi.getTableauDeBord().catch(() => null) : Promise.resolve(null),
          adminApi.getAllProprietes({ per_page: 1 }).catch(() => null),
          adminApi.getProprietesEnAttente(1).catch(() => null),
          adminApi.enAttenteDemasquage(1).catch(() => null),
          adminApi.getAuditLogs({ per_page: 1 }).catch(() => null),
          adminApi.getOperationsGlobales().catch(() => null),
          adminApi.getZones({ is_active: true }).catch(() => null),
        ]);

      if (finRes?.success && finRes.data) {
        const d: any = finRes.data;
        setSolde(
          Number(
            d.solde_disponible ??
              d.tresorerie?.solde_disponible ??
              d.resume_financier?.solde_net_disponible ??
              0
          )
        );
      }
      if (allPostsRes?.success) {
        setTotalPostsCount(allPostsRes.pagination?.total ?? (allPostsRes.data?.length || 0));
      }
      if (pendingPostsRes?.success) {
        setPendingPostsCount(pendingPostsRes.pagination?.total ?? (pendingPostsRes.data?.length || 0));
      }
      if (demRes?.success && demRes.data) {
        setPendingDemasquagesCount(demRes.data.total ?? (demRes.data.data?.length || 0));
      }
      if (logsRes?.success && logsRes.data) {
        setLogsCount(logsRes.data.total ?? (logsRes.data.data?.length || 0));
      }
      if (opsRes?.success) {
        const o: any = opsRes;
        if (o.indicateurs_visites_terrain) {
          setGlobalMetrics(o as OperationalMetricsData);
        }
      }
      let firstZoneId = selectedZoneId;
      if (zonesRes?.success && Array.isArray(zonesRes.data)) {
        setZones(zonesRes.data);
        if (!firstZoneId && zonesRes.data.length > 0) {
          firstZoneId = zonesRes.data[0].id;
          setSelectedZoneId(firstZoneId);
        }
      }
      await loadZonePerf(firstZoneId);
    } finally {
      setLoading(false);
    }
  }, [isFinancialOwner, selectedZoneId, loadZonePerf]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <View style={styles.centerLoader}>
        <ActivityIndicator size="large" color={SA_COLORS.green} />
        <Text style={styles.mutedText}>Chargement du tableau de bord...</Text>
      </View>
    );
  }

  return (
    <View style={styles.sectionGap}>
      {/* KPI Grid */}
      <View style={styles.kpiGrid}>
        {isFinancialOwner && (
          <Pressable onPress={() => onNavigate('finance')} style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Solde Coffre-Fort</Text>
            <Text style={[styles.kpiValue, { color: SA_COLORS.green }]}>{formatFcfa(solde)}</Text>
            <Text style={styles.kpiSub}>Intégrité HMAC protégée ✓</Text>
          </Pressable>
        )}

        <Pressable onPress={() => onNavigate('moderation')} style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Posts Clients &amp; Agents</Text>
          <Text style={styles.kpiValue}>{totalPostsCount} annonces</Text>
          <Text style={styles.kpiLink}>{pendingPostsCount} en attente de validation →</Text>
        </Pressable>

        <Pressable onPress={() => onNavigate('demasquages')} style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Démasquages TTL</Text>
          <Text style={styles.kpiValue}>{pendingDemasquagesCount} en attente</Text>
          <Text style={styles.kpiLink}>Arbitrer maintenant →</Text>
        </Pressable>

        <Pressable onPress={() => onNavigate('logs')} style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Journalisation Globale</Text>
          <Text style={styles.kpiValue}>{logsCount} événements</Text>
          <Text style={styles.kpiLink}>Consulter le journal →</Text>
        </Pressable>
      </View>

      {/* Métriques opérationnelles globales du mois */}
      {globalMetrics && (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>
              Indicateurs opérationnels — {globalMetrics.periode?.mois || 'Mois en cours'}
            </Text>
            <View style={styles.greenPill}>
              <Text style={styles.greenPillText}>Temps réel BDD</Text>
            </View>
          </View>
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Visites terrain</Text>
              <Text style={styles.kpiValue}>
                {globalMetrics.indicateurs_visites_terrain?.visites_effectuees ?? 0} /{' '}
                {globalMetrics.indicateurs_visites_terrain?.total_visites ?? 0}
              </Text>
              <Text style={styles.kpiSub}>
                Taux complétion : {globalMetrics.indicateurs_visites_terrain?.taux_completion_pourcentage ?? 0}%
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Demandes recherche</Text>
              <Text style={styles.kpiValue}>
                {globalMetrics.indicateurs_demandes_recherche?.demandes_satisfaites ?? 0} /{' '}
                {globalMetrics.indicateurs_demandes_recherche?.total_demandes ?? 0}
              </Text>
              <Text style={styles.kpiSub}>
                Transformation : {globalMetrics.indicateurs_demandes_recherche?.taux_transformation_pourcentage ?? 0}%
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Catalogue actif</Text>
              <Text style={styles.kpiValue}>
                {globalMetrics.catalogue_immobilier?.annonces_en_ligne ?? 0} en ligne
              </Text>
              <Text style={styles.kpiSub}>
                {globalMetrics.catalogue_immobilier?.biens_vendus_ou_loues_ce_mois ?? 0} conclus ce mois
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Two-Column Summary */}
      <View style={styles.twoColGrid}>
        {/* Performance par zone */}
        <View style={[styles.card, { flex: 2, minWidth: 280 }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Performance opérationnelle par zone</Text>
            <Pressable onPress={() => void loadDashboard()}>
              <Text style={styles.greenLink}>Actualiser</Text>
            </Pressable>
          </View>

          {zones.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {zones.map((z) => {
                const active = selectedZoneId === z.id;
                return (
                  <Pressable
                    key={z.id}
                    onPress={() => {
                      setSelectedZoneId(z.id);
                      void loadZonePerf(z.id);
                    }}
                    style={active ? styles.subPillActive : styles.subPill}>
                    <Text style={active ? styles.subPillTextActive : styles.subPillText}>
                      {z.nom} ({z.code})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {!zonePerf ? (
            <Text style={styles.mutedText}>Aucune donnée de zone disponible pour le moment.</Text>
          ) : (
            <View style={{ gap: 8 }}>
              <View style={styles.listDividerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowBold}>
                    {zonePerf.zone.nom} ({zonePerf.zone.code})
                  </Text>
                  <Text style={styles.rowSub}>
                    Visites : {zonePerf.performance_operationnelle.visites_realisees ?? 0} /{' '}
                    {zonePerf.performance_operationnelle.total_visites_secteur ?? 0} • Biens actifs :{' '}
                    {zonePerf.performance_operationnelle.biens_actifs_secteur ?? 0} • Conclus :{' '}
                    {zonePerf.performance_operationnelle.biens_conclus_secteur ?? 0}
                  </Text>
                </View>
                <View style={styles.greenPill}>
                  <Text style={styles.greenPillText}>
                    {zonePerf.performance_operationnelle.taux_completion_pourcentage ?? 0}%
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Accès rapides */}
        <View style={[styles.card, { flex: 1, minWidth: 250 }]}>
          <Text style={styles.cardTitle}>Accès rapides</Text>
          {isFinancialOwner && (
            <Pressable onPress={() => onNavigate('finance')} style={styles.quickActionCard}>
              <Text style={styles.rowBold}>Initier un retrait sécurisé (OTP)</Text>
              <Text style={styles.rowSub}>Décaissement vers compte officiel</Text>
            </Pressable>
          )}
          <Pressable onPress={() => onNavigate('moderation')} style={styles.quickActionCard}>
            <Text style={styles.rowBold}>Voir les posts Clients &amp; Agents</Text>
            <Text style={styles.rowSub}>Filtrer par auteur et modérer</Text>
          </Pressable>
          <Pressable onPress={() => onNavigate('logs')} style={styles.quickActionCard}>
            <Text style={styles.rowBold}>Journalisation de la plateforme</Text>
            <Text style={styles.rowSub}>Traçabilité complète des actions</Text>
          </Pressable>
          <Pressable onPress={() => onNavigate('parametres')} style={styles.quickActionCard}>
            <Text style={styles.rowBold}>Paramètres &amp; Tarifs</Text>
            <Text style={styles.rowSub}>Configuration dynamique en base</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* ============================================================================
 * 2. COFFRE-FORT FINANCIER & RETRAITS OTP
 * ========================================================================== */
const CATEGORY_LABELS: Record<string, string> = {
  encaissement_visite: 'Visite physique',
  encaissement_deblocage: 'Déblocage fiche',
  encaissement_hebergement: 'Publication annonce',
  retrait_payout: 'Retrait trésorerie',
};

export function SuperAdminFinanceSection() {
  const { tarifs } = usePlatformConfig();
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'ledger' | 'webhooks' | 'notifs'>('ledger');
  const [dashboard, setDashboard] = useState<any>(null);
  const [transactions, setTransactions] = useState<GrandLivreEntry[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txLastPage, setTxLastPage] = useState(1);
  const [retraits, setRetraits] = useState<RetraitItem[]>([]);
  const [minPayout, setMinPayout] = useState<number>(1000);
  const [secStatut, setSecStatut] = useState<any>(null);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [notifAudit, setNotifAudit] = useState<any[]>([]);
  const [notifTotaux, setNotifTotaux] = useState<Record<string, number> | null>(null);
  const [txFilter, setTxFilter] = useState<
    'all' | 'encaissement_visite' | 'encaissement_deblocage' | 'encaissement_hebergement' | 'retrait_payout'
  >('all');

  // Retrait OTP Modal
  const [retraitModalOpen, setRetraitModalOpen] = useState(false);
  const [montant, setMontant] = useState('');
  const [canal, setCanal] = useState<'mobile_money' | 'virement_bancaire'>('mobile_money');
  const [pendingRetraitId, setPendingRetraitId] = useState<number | null>(null);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Freeze Modal
  const [freezeModalOpen, setFreezeModalOpen] = useState(false);
  const [freezeMotif, setFreezeMotif] = useState('');

  const loadFinance = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, txRes, retRes, secRes, whRes, notifRes] = await Promise.all([
        financeApi.getTableauDeBord().catch(() => null),
        financeApi.getTransactions({ page: 1 }).catch(() => null),
        financeApi.getRetraits(1).catch(() => null),
        financeApi.getSecurityStatut().catch(() => null),
        financeApi.getWebhooks(1).catch(() => null),
        financeApi.getNotificationsAudit({ page: 1 }).catch(() => null),
      ]);
      if (dashRes?.success) setDashboard(dashRes.data);
      if (txRes?.success && txRes.data) {
        const td: any = txRes.data;
        setTransactions(Array.isArray(td) ? td : td.data || []);
        setTxPage(td.current_page || 1);
        setTxLastPage(td.last_page || 1);
      }
      if (retRes?.success && retRes.data) {
        const rd: any = retRes.data;
        setRetraits(Array.isArray(rd) ? rd : rd.data || []);
        if ((retRes as any).retrait_montant_minimum) {
          setMinPayout(Number((retRes as any).retrait_montant_minimum));
        }
      }
      if (secRes?.success) setSecStatut(secRes.data);
      if (whRes?.success && whRes.data) {
        const wd: any = whRes.data;
        setWebhooks(Array.isArray(wd) ? wd : wd.data || []);
      }
      if (notifRes?.success) {
        setNotifAudit(Array.isArray(notifRes.data) ? notifRes.data : []);
        setNotifTotaux((notifRes as any).totaux || null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFinance();
  }, [loadFinance]);

  const loadMoreTransactions = async () => {
    if (txPage >= txLastPage) return;
    const nextPage = txPage + 1;
    const txRes = await financeApi.getTransactions({
      page: nextPage,
      categorie: txFilter === 'all' ? undefined : txFilter,
    });
    if (txRes.success && txRes.data) {
      const td: any = txRes.data;
      const items = Array.isArray(td) ? td : td.data || [];
      setTransactions((prev) => [...prev, ...items]);
      setTxPage(td.current_page || nextPage);
      setTxLastPage(td.last_page || txLastPage);
    }
  };

  const soldeDisponible = Number(dashboard?.tresorerie?.solde_disponible ?? dashboard?.solde_disponible ?? 0);
  const soldeEnCours = Number(dashboard?.tresorerie?.solde_en_cours_retrait ?? 0);
  const flux = dashboard?.flux_globaux || {};
  const beneficiaire = dashboard?.compte_beneficiaire_officiel || null;
  const ventilation: Array<{ categorie: string; total_net: number; nombre: number }> = Object.values(
    dashboard?.ventilation_recettes || {}
  );
  const isFrozen = Boolean(secStatut?.retraits_geles ?? secStatut?.est_gele ?? false);

  const handleVerifyHmac = async () => {
    const res = await financeApi.verifierIntegrite();
    showFeedback(
      res.success ? 'Intégrité HMAC vérifiée' : 'Alerte Intégrité',
      res.message || (res.success ? 'Chaînage cryptographique 100% valide.' : 'Anomalie détectée.')
    );
  };

  const handleExportLedger = async () => {
    const res: any = await financeApi.exportTransactions();
    if (!res.success) {
      showFeedback('Erreur Export', res.message || 'Impossible de générer l’export comptable.');
      return;
    }
    const rows: GrandLivreEntry[] = Array.isArray(res.data) ? res.data : [];
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof Blob !== 'undefined') {
      const header = 'Reference;Type;Categorie;MontantBrut;FraisAgregateur;MontantNet;SoldeApres;Description;Date\n';
      const csvBody = rows
        .map((r) =>
          [
            r.reference_unique,
            r.type_mouvement,
            r.categorie,
            r.montant_brut,
            r.frais_agregateur ?? 0,
            r.montant_net,
            r.solde_apres,
            String(r.description || '').replace(/;/g, ','),
            r.created_at,
          ].join(';')
        )
        .join('\n');
      const blob = new Blob([header + csvBody], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `grand-livre-emobilier-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    showFeedback(
      'Export comptable généré',
      `${res.total_ecritures ?? rows.length} écriture(s) exportée(s) — Solde final : ${formatFcfa(res.solde_final ?? soldeDisponible)}.`
    );
  };

  const handleToggleFreeze = async () => {
    if (isFrozen) {
      const res = await financeApi.degelerRetraits();
      showFeedback(res.success ? 'Retraits dégelés' : 'Erreur', res.message || '');
      await loadFinance();
    } else {
      setFreezeMotif('');
      setFreezeModalOpen(true);
    }
  };

  const handleConfirmFreeze = async () => {
    if (freezeMotif.trim().length < 5) {
      showFeedback('Motif requis', 'Saisissez un motif clair d’au moins 5 caractères.');
      return;
    }
    const res = await financeApi.gelerRetraits(freezeMotif.trim());
    setFreezeModalOpen(false);
    showFeedback(res.success ? 'Coupe-circuit activé' : 'Erreur', res.message || '');
    await loadFinance();
  };

  const handleInitRetrait = async () => {
    const num = Number(montant.replace(/\s+/g, ''));
    if (!num || num < minPayout) {
      showFeedback('Montant insuffisant', `Le montant minimum de retrait est de ${formatFcfa(minPayout)}.`);
      return;
    }
    setSubmitting(true);
    const res = await financeApi.initierRetrait(num, canal);
    setSubmitting(false);
    if (res.success && res.data) {
      const d: any = res.data;
      const id = d.retrait?.id ?? d.id;
      setPendingRetraitId(id || null);
      setDevOtpHint(d.test_otp_code ? String(d.test_otp_code) : null);
      showFeedback(
        'Code OTP envoyé',
        `${res.message || 'Saisissez le code OTP reçu.'}${d.test_otp_code ? `\n(Code OTP dev : ${d.test_otp_code})` : ''}`
      );
      await loadFinance();
    } else {
      showFeedback('Erreur retrait', res.message || "Impossible d'initier le retrait.");
    }
  };

  const handleConfirmOtp = async () => {
    if (!pendingRetraitId || otpCode.trim().length !== 6) {
      showFeedback('OTP invalide', 'Veuillez saisir les 6 chiffres du code OTP.');
      return;
    }
    setSubmitting(true);
    const res = await financeApi.confirmerOtpRetrait(pendingRetraitId, otpCode.trim());
    setSubmitting(false);
    if (res.success) {
      showFeedback('Retrait confirmé', res.message || 'Décaissement exécuté.');
      setRetraitModalOpen(false);
      setPendingRetraitId(null);
      setDevOtpHint(null);
      setOtpCode('');
      setMontant('');
      await loadFinance();
    } else {
      showFeedback('OTP invalide', res.message || 'Vérifiez le code OTP.');
    }
  };

  const handleCancelRetrait = async (retrait: RetraitItem) => {
    const ok = await confirmDialog(
      'Annuler ce retrait ?',
      `Annuler la demande ${retrait.reference_retrait} de ${formatFcfa(retrait.montant)} ?`,
      'Annuler le retrait'
    );
    if (!ok) return;
    const res = await financeApi.annulerRetrait(retrait.id, 'Annulé depuis le Coffre-Fort Super Admin');
    showFeedback(res.success ? 'Retrait annulé' : 'Erreur', res.message || '');
    if (res.success) await loadFinance();
  };

  const filteredTx = transactions.filter((t) => {
    if (txFilter === 'all') return true;
    return String(t.categorie || '') === txFilter;
  });

  if (loading) {
    return (
      <View style={styles.centerLoader}>
        <ActivityIndicator size="large" color={SA_COLORS.green} />
        <Text style={styles.mutedText}>Chargement du coffre-fort financier...</Text>
      </View>
    );
  }

  return (
    <View style={styles.sectionGap}>
      {/* Hero Balance */}
      <View style={styles.financeHero}>
        <View style={{ flex: 1 }}>
          <View style={[styles.greenPill, { alignSelf: 'flex-start', marginBottom: 8 }]}>
            <Text style={styles.greenPillText}>Accès Exclusif • Propriétaire Financier</Text>
          </View>
          <Text style={styles.mutedText}>Solde net disponible en trésorerie</Text>
          <Text style={styles.financeBigAmount}>{formatFcfa(soldeDisponible)}</Text>
          {soldeEnCours > 0 && (
            <Text style={[styles.rowSub, { color: SA_COLORS.amberText, fontWeight: '700' }]}>
              En cours de retrait : {formatFcfa(soldeEnCours)}
            </Text>
          )}
          <Text style={styles.rowSub}>
            {tarifs
              ? `Déblocages (${tarifs.deblocage_coordonnees} F) • Visites (${tarifs.visite} F) • Publications (${tarifs.post_agent} F / ${tarifs.post_client} F)`
              : 'Tarifs officiels chargés dynamiquement depuis la base de données'}
          </Text>
        </View>
        <View style={styles.rowWrap}>
          <Pressable
            onPress={() => {
              setPendingRetraitId(null);
              setDevOtpHint(null);
              setOtpCode('');
              setRetraitModalOpen(true);
            }}
            style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>+ Initier un retrait OTP</Text>
          </Pressable>
          <Pressable onPress={handleExportLedger} style={styles.softGreenBtn}>
            <Text style={styles.softGreenBtnText}>Exporter Grand Livre</Text>
          </Pressable>
          <Pressable onPress={() => void loadFinance()} style={styles.outlineBtn}>
            <Text style={styles.outlineBtnText}>Actualiser</Text>
          </Pressable>
        </View>
      </View>

      {/* Flux globaux & Compte bénéficiaire */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Chiffre d'affaires brut</Text>
          <Text style={styles.kpiValue}>{formatFcfa(flux.total_chiffre_affaires_brut ?? 0)}</Text>
          <Text style={styles.kpiSub}>Total encaissements bruts</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Commissions passerelle</Text>
          <Text style={styles.kpiValue}>{formatFcfa(flux.total_commissions_prelevees ?? 0)}</Text>
          <Text style={styles.kpiSub}>Frais agrégateur</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Net encaissé</Text>
          <Text style={[styles.kpiValue, { color: SA_COLORS.green }]}>
            {formatFcfa(flux.total_net_encaisse ?? 0)}
          </Text>
          <Text style={styles.kpiSub}>Crédit Grand Livre</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Total retraits virés</Text>
          <Text style={styles.kpiValue}>{formatFcfa(flux.total_retraits_vires ?? 0)}</Text>
          <Text style={styles.kpiSub}>Décaissements exécutés</Text>
        </View>
      </View>

      {(beneficiaire || ventilation.length > 0) && (
        <View style={styles.twoColGrid}>
          {beneficiaire && (
            <View style={[styles.card, { flex: 1, minWidth: 260 }]}>
              <Text style={styles.cardTitle}>Compte bénéficiaire officiel</Text>
              <Text style={styles.rowBold}>{beneficiaire.titulaire}</Text>
              <Text style={styles.rowSub}>Mobile Money : {beneficiaire.mobile_money}</Text>
              <Text style={styles.rowSub}>RIB bancaire : {beneficiaire.rib_bancaire}</Text>
            </View>
          )}
          {ventilation.length > 0 && (
            <View style={[styles.card, { flex: 1, minWidth: 260 }]}>
              <Text style={styles.cardTitle}>Ventilation des recettes</Text>
              {ventilation.map((v) => (
                <View key={v.categorie} style={styles.listDividerRow}>
                  <Text style={styles.rowBold}>
                    {CATEGORY_LABELS[v.categorie] || v.categorie} ({v.nombre})
                  </Text>
                  <Text style={[styles.rowBold, { color: SA_COLORS.green }]}>
                    {formatFcfa(v.total_net)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Security Controls */}
      <View style={styles.twoColGrid}>
        <View style={[styles.card, styles.spaceBetweenRow, { flex: 1, minWidth: 260 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowBold}>Intégrité Grand Livre (HMAC SHA-256)</Text>
            <Text style={styles.rowSub}>Vérification cryptographique de toutes les écritures</Text>
          </View>
          <Pressable onPress={handleVerifyHmac} style={styles.softGreenBtn}>
            <Text style={styles.softGreenBtnText}>Vérifier</Text>
          </Pressable>
        </View>

        <View style={[styles.card, styles.spaceBetweenRow, { flex: 1, minWidth: 260 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowBold}>Coupe-circuit des retraits</Text>
            <Text style={[styles.rowSub, { color: isFrozen ? SA_COLORS.danger : SA_COLORS.green, fontWeight: '700' }]}>
              {isFrozen ? 'GELÉ : Retraits bloqués' : 'Actif : Retraits autorisés'}
            </Text>
          </View>
          <Pressable
            onPress={handleToggleFreeze}
            style={isFrozen ? styles.primaryBtnSmall : styles.dangerOutlineBtn}>
            <Text style={isFrozen ? styles.primaryBtnText : styles.dangerOutlineBtnText}>
              {isFrozen ? 'Dégeler' : 'Geler retraits'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Sub-navigation Coffre-Fort */}
      <View style={styles.rowWrap}>
        {(
          [
            { k: 'ledger', l: `Grand Livre & Retraits (${transactions.length})` },
            { k: 'webhooks', l: `Webhooks financiers (${webhooks.length})` },
            { k: 'notifs', l: `Audit Notifications (${notifAudit.length})` },
          ] as const
        ).map((tab) => (
          <Pressable
            key={tab.k}
            onPress={() => setSubTab(tab.k)}
            style={subTab === tab.k ? styles.filterPillActive : styles.filterPill}>
            <Text style={subTab === tab.k ? styles.filterPillTextActive : styles.filterPillText}>
              {tab.l}
            </Text>
          </Pressable>
        ))}
      </View>

      {subTab === 'ledger' && (
        <>
          {/* Transactions Grand Livre */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Écritures du Grand Livre ({filteredTx.length})</Text>
              <View style={styles.rowWrap}>
                {(
                  [
                    { k: 'all', l: 'Toutes' },
                    { k: 'encaissement_visite', l: 'Visites' },
                    { k: 'encaissement_deblocage', l: 'Déblocages' },
                    { k: 'encaissement_hebergement', l: 'Publications' },
                    { k: 'retrait_payout', l: 'Retraits' },
                  ] as const
                ).map((f) => (
                  <Pressable
                    key={f.k}
                    onPress={() => setTxFilter(f.k)}
                    style={txFilter === f.k ? styles.filterPillActive : styles.filterPill}>
                    <Text style={txFilter === f.k ? styles.filterPillTextActive : styles.filterPillText}>
                      {f.l}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {filteredTx.length === 0 ? (
              <Text style={styles.mutedText}>Aucune écriture comptable pour ce filtre.</Text>
            ) : (
              <>
                {filteredTx.map((t, idx) => {
                  const isDebit = String(t.type_mouvement || '').toLowerCase() === 'debit';
                  return (
                    <View key={t.id || idx} style={styles.listDividerRow}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.rowBold}>
                          {t.reference_unique || `GL-${t.id}`} • {CATEGORY_LABELS[t.categorie] || t.categorie}
                        </Text>
                        <Text style={styles.rowSub} numberOfLines={2}>
                          {t.description}
                        </Text>
                        <Text style={styles.mutedText}>
                          {t.created_at ? new Date(t.created_at).toLocaleString('fr-FR') : ''}
                          {t.client ? ` • ${t.client.prenom || ''} ${t.client.name || ''}` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <Text
                          style={[
                            styles.rowBold,
                            { color: isDebit ? SA_COLORS.danger : SA_COLORS.green },
                          ]}>
                          {isDebit ? '-' : '+'}
                          {formatFcfa(t.montant_net ?? t.montant_brut ?? 0)}
                        </Text>
                        <Text style={styles.mutedText}>Solde : {formatFcfa(t.solde_apres ?? 0)}</Text>
                      </View>
                    </View>
                  );
                })}
                {txPage < txLastPage && (
                  <Pressable onPress={() => void loadMoreTransactions()} style={[styles.outlineBtn, { alignSelf: 'center' }]}>
                    <Text style={styles.outlineBtnText}>Charger plus d'écritures</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>

          {/* Retraits récents */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Historique des retraits OTP ({retraits.length})</Text>
            {retraits.length === 0 ? (
              <Text style={styles.mutedText}>Aucun ordre de retrait enregistré.</Text>
            ) : (
              retraits.map((r, idx) => {
                const isPendingOtp = r.statut === 'en_attente_otp';
                return (
                  <View key={r.id || idx} style={styles.listDividerRow}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.rowBold}>
                        {r.reference_retrait || `Retrait #${r.id}`} •{' '}
                        {r.type_compte === 'virement_bancaire' ? 'Virement bancaire' : 'Mobile Money'}
                      </Text>
                      <Text style={styles.rowSub}>{r.compte_beneficiaire || 'Compte officiel'}</Text>
                      <Text style={styles.mutedText}>
                        {r.created_at ? new Date(r.created_at).toLocaleString('fr-FR') : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Text style={styles.rowBold}>-{formatFcfa(r.montant ?? 0)}</Text>
                      <View style={isPendingOtp ? styles.amberPill : styles.slatePill}>
                        <Text style={isPendingOtp ? styles.amberPillText : styles.slatePillText}>
                          {r.statut}
                        </Text>
                      </View>
                      {isPendingOtp && (
                        <View style={styles.rowWrap}>
                          <Pressable
                            onPress={() => {
                              setPendingRetraitId(r.id);
                              setOtpCode('');
                              setDevOtpHint(null);
                              setRetraitModalOpen(true);
                            }}
                            style={styles.primaryBtnSmall}>
                            <Text style={styles.primaryBtnText}>Saisir OTP</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => void handleCancelRetrait(r)}
                            style={styles.dangerOutlineBtn}>
                            <Text style={styles.dangerOutlineBtnText}>Annuler</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </>
      )}

      {subTab === 'webhooks' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Journal des webhooks financiers ({webhooks.length})</Text>
          {webhooks.length === 0 ? (
            <Text style={styles.mutedText}>Aucun webhook financier enregistré.</Text>
          ) : (
            webhooks.map((w: any, idx: number) => (
              <View key={w.id || idx} style={styles.listDividerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowBold}>
                    {w.gateway || 'kkiapay'} • {w.gateway_transaction_id || w.event_type || `#${w.id}`}
                  </Text>
                  <Text style={styles.rowSub}>
                    Statut : {w.reconciliation_status} • HTTP {w.status_http} • Signature :{' '}
                    {w.is_signature_valid ? 'Valide' : 'Invalide'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.rowBold}>{formatFcfa(w.montant ?? 0)}</Text>
                  <Text style={styles.mutedText}>
                    {w.created_at ? new Date(w.created_at).toLocaleString('fr-FR') : ''}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {subTab === 'notifs' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Audit des notifications financières</Text>
          {notifTotaux && (
            <Text style={styles.rowSub}>
              Expédiées : {notifTotaux.total_expedies ?? 0} • Replis SMS : {notifTotaux.total_replis_sms ?? 0} •
              Échecs : {notifTotaux.total_echecs ?? 0}
            </Text>
          )}
          {notifAudit.length === 0 ? (
            <Text style={styles.mutedText}>Aucune notification financière enregistrée.</Text>
          ) : (
            notifAudit.map((n: any, idx: number) => (
              <View key={n.id || idx} style={styles.listDividerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowBold}>
                    {n.sujet || n.reference_evenement || `Notif #${n.id}`}
                  </Text>
                  <Text style={styles.rowSub}>
                    Canal : {n.canal} • Statut : {n.statut} • Tentatives : {n.tentatives ?? 1}
                  </Text>
                </View>
                <Text style={styles.mutedText}>
                  {n.created_at ? new Date(n.created_at).toLocaleString('fr-FR') : ''}
                </Text>
              </View>
            ))
          )}
        </View>
      )}

      {/* Modal Retrait OTP */}
      <Modal visible={retraitModalOpen} transparent animationType="fade" onRequestClose={() => setRetraitModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>
              {pendingRetraitId ? `Confirmer le retrait #${pendingRetraitId} par OTP` : 'Initier un retrait sécurisé'}
            </Text>

            {!pendingRetraitId ? (
              <>
                <Text style={styles.rowSub}>
                  Minimum : {formatFcfa(minPayout)} • Disponible : {formatFcfa(soldeDisponible)}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder={`Montant en FCFA (min ${minPayout})`}
                  placeholderTextColor={SA_COLORS.muted}
                  keyboardType="numeric"
                  value={montant}
                  onChangeText={setMontant}
                />
                <View style={styles.rowWrap}>
                  {(['mobile_money', 'virement_bancaire'] as const).map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setCanal(c)}
                      style={canal === c ? styles.filterPillActive : styles.filterPill}>
                      <Text style={canal === c ? styles.filterPillTextActive : styles.filterPillText}>
                        {c === 'mobile_money' ? 'Mobile Money' : 'Virement Bancaire'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable onPress={handleInitRetrait} disabled={submitting} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>
                    {submitting ? 'Envoi OTP...' : 'Demander le code OTP'}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                {devOtpHint ? (
                  <View style={styles.greenPill}>
                    <Text style={styles.greenPillText}>Code OTP dev : {devOtpHint}</Text>
                  </View>
                ) : null}
                <TextInput
                  style={styles.input}
                  placeholder="Code OTP à 6 chiffres"
                  placeholderTextColor={SA_COLORS.muted}
                  keyboardType="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChangeText={setOtpCode}
                />
                <Pressable onPress={handleConfirmOtp} disabled={submitting} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>
                    {submitting ? 'Validation...' : 'Confirmer le décaissement'}
                  </Text>
                </Pressable>
              </>
            )}

            <Pressable onPress={() => setRetraitModalOpen(false)} style={styles.cancelLink}>
              <Text style={styles.mutedText}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal Gel Retraits */}
      <Modal visible={freezeModalOpen} transparent animationType="fade" onRequestClose={() => setFreezeModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>Geler les retraits (Coupe-circuit)</Text>
            <TextInput
              style={[styles.input, { minHeight: 74, textAlignVertical: 'top' }]}
              multiline
              placeholder="Indiquez le motif du gel d'urgence..."
              placeholderTextColor={SA_COLORS.muted}
              value={freezeMotif}
              onChangeText={setFreezeMotif}
            />
            <View style={styles.rowWrap}>
              <Pressable onPress={() => setFreezeModalOpen(false)} style={[styles.outlineBtn, { flex: 1 }]}>
                <Text style={styles.outlineBtnText}>Annuler</Text>
              </Pressable>
              <Pressable onPress={() => void handleConfirmFreeze()} style={[styles.dangerBtn, { flex: 1 }]}>
                <Text style={styles.primaryBtnText}>Activer le gel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ============================================================================
 * 3. POSTS CLIENTS & AGENTS IMMOBILIERS (MODÉRATION + VUE COMPLÈTE)
 * ========================================================================== */
export function SuperAdminPostsSection() {
  const storageBaseUrl = getStorageBaseUrl();
  const [authorRole, setAuthorRole] = useState<'all' | 'client' | 'agent'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [posts, setPosts] = useState<BackendProperty[]>([]);
  const [postsPage, setPostsPage] = useState(1);
  const [postsLastPage, setPostsLastPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [rejectModalId, setRejectModalId] = useState<number | null>(null);
  const [rejectMotif, setRejectMotif] = useState('');
  const [docsModal, setDocsModal] = useState<{ propertyId: number; docs: PropertyDocumentItem[] } | null>(null);

  const loadPosts = useCallback(
    async (targetPage = 1, replace = true) => {
      if (replace) setLoading(true);
      try {
        const res = await adminApi.getAllProprietes({
          author_role: authorRole,
          status: statusFilter,
          search: search.trim() || undefined,
          page: targetPage,
          per_page: 25,
        });
        if (res.success && Array.isArray(res.data)) {
          setPosts((prev) => (replace ? res.data! : [...prev, ...res.data!]));
          setPostsPage(res.pagination?.current_page || targetPage);
          setPostsLastPage(res.pagination?.last_page || 1);
        } else if (replace) {
          setPosts([]);
        }
      } finally {
        if (replace) setLoading(false);
      }
    },
    [authorRole, statusFilter, search]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPosts(1, true);
    }, 250);
    return () => clearTimeout(timer);
  }, [loadPosts]);

  const handleValidate = async (id: number) => {
    const res = await adminApi.validerPropriete(id);
    showFeedback(res.success ? 'Annonce validée' : 'Erreur', res.message || '');
    if (res.success) await loadPosts(1, true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectModalId || rejectMotif.trim().length < 5) {
      showFeedback('Motif requis', 'Indiquez un motif d’au moins 5 caractères.');
      return;
    }
    const res = await adminApi.rejeterPropriete(rejectModalId, rejectMotif.trim());
    showFeedback(res.success ? 'Annonce rejetée' : 'Erreur', res.message || '');
    setRejectModalId(null);
    setRejectMotif('');
    if (res.success) await loadPosts(1, true);
  };

  const handleOpenDocs = async (id: number) => {
    const res: any = await adminApi.getProprieteDocuments(id);
    const docs: PropertyDocumentItem[] = res?.documents || res?.data || [];
    if (!docs.length) {
      showFeedback('Documents', 'Aucun document justificatif joint à ce post.');
      return;
    }
    setDocsModal({ propertyId: id, docs });
  };

  const isAgentAuthor = (p: any) => {
    const roles: any[] = p?.user?.roles || [];
    return roles.some((r) => (typeof r === 'string' ? r : r?.name) === 'Agent mobilier');
  };

  return (
    <View style={styles.sectionGap}>
      {/* Filters Bar */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.rowWrap}>
            {(
              [
                { k: 'all', l: 'Tous les posts' },
                { k: 'client', l: 'Posts Clients' },
                { k: 'agent', l: 'Posts Agents Immobiliers' },
              ] as const
            ).map((item) => (
              <Pressable
                key={item.k}
                onPress={() => setAuthorRole(item.k)}
                style={authorRole === item.k ? styles.filterPillActive : styles.filterPill}>
                <Text style={authorRole === item.k ? styles.filterPillTextActive : styles.filterPillText}>
                  {item.l}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {[
            { k: 'all', l: 'Tous statuts' },
            { k: 'pending', l: 'En attente' },
            { k: 'published', l: 'Publiés' },
            { k: 'conclu', l: 'Conclus' },
            { k: 'rejected', l: 'Rejetés' },
          ].map((s) => (
            <Pressable
              key={s.k}
              onPress={() => setStatusFilter(s.k)}
              style={statusFilter === s.k ? styles.subPillActive : styles.subPill}>
              <Text style={statusFilter === s.k ? styles.subPillTextActive : styles.subPillText}>{s.l}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <TextInput
          style={styles.input}
          placeholder="Rechercher par commune, quartier, auteur ou type de bien..."
          placeholderTextColor={SA_COLORS.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator color={SA_COLORS.green} />
        </View>
      ) : posts.length === 0 ? (
        <View style={[styles.card, { alignItems: 'center', paddingVertical: 32 }]}>
          <Text style={styles.rowBold}>Aucun post trouvé</Text>
          <Text style={styles.rowSub}>Modifiez vos filtres pour voir d’autres publications.</Text>
        </View>
      ) : (
        posts.map((p) => {
          const agent = isAgentAuthor(p);
          const authorName = p.user
            ? `${p.user.prenom ?? ''} ${p.user.name ?? ''}`.trim() || `User #${p.user_id}`
            : `User #${p.user_id}`;
          const isPending = p.status === 'pending' || p.status === 'pending_payment';

          return (
            <View key={p.id} style={styles.card}>
              <View style={styles.spaceBetweenRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.rowWrap}>
                    <View style={agent ? styles.greenPill : styles.slatePill}>
                      <Text style={agent ? styles.greenPillText : styles.slatePillText}>
                        {agent ? 'Agent Immobilier' : 'Client Propriétaire'}
                      </Text>
                    </View>
                    <Text style={styles.rowSub}>{authorName}</Text>
                    {p.created_at ? (
                      <Text style={styles.rowSub}>• {new Date(p.created_at).toLocaleDateString('fr-FR')}</Text>
                    ) : null}
                  </View>

                  <Text style={styles.postTitle}>
                    {String(p.type || 'Bien').toUpperCase()} ({p.transaction_type}) — {p.commune}
                    {p.quartier ? `, ${p.quartier}` : ''}
                  </Text>
                  <Text style={styles.rowSub}>
                    Prix : <Text style={{ color: SA_COLORS.green, fontWeight: '800' }}>{formatFcfa(p.prix)}</Text>
                    {p.surface ? ` • ${p.surface} m²` : ''}
                  </Text>
                </View>

                <View
                  style={
                    isPending
                      ? styles.amberPill
                      : p.status === 'published'
                      ? styles.greenPill
                      : p.status === 'rejected'
                      ? styles.dangerPill
                      : styles.slatePill
                  }>
                  <Text
                    style={
                      isPending
                        ? styles.amberPillText
                        : p.status === 'published'
                        ? styles.greenPillText
                        : p.status === 'rejected'
                        ? styles.dangerPillText
                        : styles.slatePillText
                    }>
                    {String(p.status).toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.cardFooterRow}>
                <View style={styles.rowWrap}>
                  <Pressable onPress={() => handleOpenDocs(p.id)}>
                    <Text style={styles.greenLink}>Justificatifs / TF</Text>
                  </Pressable>
                  <Pressable onPress={() => router.push(`/property/${p.id}` as any)}>
                    <Text style={[styles.greenLink, { color: SA_COLORS.muted }]}>Voir la fiche</Text>
                  </Pressable>
                </View>

                <View style={styles.rowWrap}>
                  {isPending && (
                    <>
                      <Pressable
                        onPress={() => {
                          setRejectModalId(p.id);
                          setRejectMotif('');
                        }}
                        style={styles.dangerOutlineBtn}>
                        <Text style={styles.dangerOutlineBtnText}>Rejeter</Text>
                      </Pressable>
                      <Pressable onPress={() => handleValidate(p.id)} style={styles.primaryBtnSmall}>
                        <Text style={styles.primaryBtnText}>Valider &amp; Publier</Text>
                      </Pressable>
                    </>
                  )}
                  {p.status === 'published' && (
                    <Pressable
                      onPress={async () => {
                        const r = await adminApi.marquerProprieteConclue(p.id);
                        showFeedback(r.success ? 'Marqué conclu' : 'Erreur', r.message || '');
                        if (r.success) await loadPosts();
                      }}
                      style={styles.outlineBtnSmall}>
                      <Text style={styles.outlineBtnText}>Marquer conclu</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          );
        })
      )}

      {postsPage < postsLastPage && (
        <Pressable
          onPress={() => void loadPosts(postsPage + 1, false)}
          style={[styles.outlineBtn, { alignSelf: 'center' }]}>
          <Text style={styles.outlineBtnText}>Charger plus de posts</Text>
        </Pressable>
      )}

      {/* Documents Modal (tous les justificatifs du post) */}
      <Modal visible={Boolean(docsModal)} transparent animationType="fade" onRequestClose={() => setDocsModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>
              Documents justificatifs — Bien #{docsModal?.propertyId}
            </Text>
            {(docsModal?.docs || []).map((doc) => {
              const url = resolveStorageUrl(doc.url_consultation || doc.document_url, storageBaseUrl);
              return (
                <Pressable
                  key={doc.id}
                  onPress={() => url && void WebBrowser.openBrowserAsync(url)}
                  style={styles.quickActionCard}>
                  <Text style={styles.rowBold}>
                    {(doc.type || doc.document_type || 'Document').replace(/_/g, ' ').toUpperCase()}
                  </Text>
                  <Text style={styles.greenLink}>{doc.nom || 'Ouvrir le fichier →'}</Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => setDocsModal(null)} style={styles.cancelLink}>
              <Text style={styles.mutedText}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Reject Motif Modal */}
      <Modal visible={rejectModalId !== null} transparent animationType="fade" onRequestClose={() => setRejectModalId(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>Motif de rejet du post #{rejectModalId}</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              multiline
              placeholder="Expliquez la raison du rejet (ex: Titre foncier illisible)..."
              placeholderTextColor={SA_COLORS.muted}
              value={rejectMotif}
              onChangeText={setRejectMotif}
            />
            <View style={styles.rowWrap}>
              <Pressable onPress={() => setRejectModalId(null)} style={[styles.outlineBtn, { flex: 1 }]}>
                <Text style={styles.outlineBtnText}>Annuler</Text>
              </Pressable>
              <Pressable onPress={handleRejectSubmit} style={[styles.dangerBtn, { flex: 1 }]}>
                <Text style={styles.primaryBtnText}>Confirmer le rejet</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ============================================================================
 * 4. JOURNALISATION GLOBALE DE TOUTE LA PLATEFORME
 * ========================================================================== */
export function SuperAdminLogsSection() {
  const { isFinancialOwner } = useAuth();
  const [moduleFilter, setModuleFilter] = useState<'all' | 'auth' | 'posts' | 'finance' | 'visites' | 'securite'>('all');
  const [search, setSearch] = useState('');
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAuditLogs({
        module: moduleFilter,
        search: search.trim() || undefined,
        per_page: 50,
      });
      if (res.success && res.data) {
        setLogs(res.data.data || []);
      } else {
        setLogs([]);
      }
    } finally {
      setLoading(false);
    }
  }, [moduleFilter, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadLogs();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadLogs]);

  return (
    <View style={styles.sectionGap}>
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.rowWrap}>
            {(
              [
                { k: 'all', l: 'Tout' },
                { k: 'auth', l: 'Auth & 2FA' },
                { k: 'posts', l: 'Posts & Modération' },
                ...(isFinancialOwner ? [{ k: 'finance' as const, l: 'Finance' }] : []),
                { k: 'visites', l: 'Visites' },
                { k: 'securite', l: 'Sécurité & TTL' },
              ] as const
            ).map((m) => (
              <Pressable
                key={m.k}
                onPress={() => setModuleFilter(m.k)}
                style={moduleFilter === m.k ? styles.filterPillActive : styles.filterPill}>
                <Text style={moduleFilter === m.k ? styles.filterPillTextActive : styles.filterPillText}>
                  {m.l}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={loadLogs} style={styles.outlineBtnSmall}>
            <Text style={styles.outlineBtnText}>Actualiser</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Rechercher un utilisateur, une IP ou une action..."
          placeholderTextColor={SA_COLORS.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Journal chronologique ({logs.length})</Text>
        {loading ? (
          <ActivityIndicator color={SA_COLORS.green} style={{ marginVertical: 20 }} />
        ) : logs.length === 0 ? (
          <Text style={styles.mutedText}>Aucun événement enregistré pour ce filtre.</Text>
        ) : (
          logs.map((log) => {
            const actor = log.user
              ? `${log.user.prenom ?? ''} ${log.user.name ?? ''}`.trim() || log.user.email
              : 'Système';
            const isAlert =
              String(log.action).toLowerCase().includes('rejet') ||
              String(log.action).toLowerCase().includes('revoqu') ||
              String(log.action).toLowerCase().includes('gel') ||
              String(log.action).toLowerCase().includes('echec');

            return (
              <View key={log.id} style={styles.listDividerRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.rowWrap}>
                    <Text style={styles.rowBold}>{log.action}</Text>
                    {log.is_financial && (
                      <View style={styles.greenPill}>
                        <Text style={styles.greenPillText}>Finance</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.rowSub}>
                    {actor} {log.ip_address ? `• IP ${log.ip_address}` : ''}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end', gap: 3 }}>
                  <View style={isAlert ? styles.dangerPill : styles.greenPill}>
                    <Text style={isAlert ? styles.dangerPillText : styles.greenPillText}>
                      {isAlert ? 'Alerte' : 'Audit'}
                    </Text>
                  </View>
                  <Text style={[styles.rowSub, { fontSize: 10 }]}>
                    {new Date(log.created_at).toLocaleString('fr-FR')}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

/* ============================================================================
 * 5. MON PROFIL & CHANGEMENT DE PHOTO DE PROFIL
 * ========================================================================== */
export function SuperAdminProfileSection() {
  const { user, isFinancialOwner, refreshProfile, logout } = useAuth();
  const [nom, setNom] = useState(user?.nom || '');
  const [prenom, setPrenom] = useState(user?.prenom || '');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const initials = (user?.name || 'JM')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handlePickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      const fileName = asset.fileName || `avatar_${Date.now()}.jpg`;
      const mimeType = asset.mimeType || 'image/jpeg';

      if (Platform.OS === 'web') {
        if ((asset as any).file) {
          formData.append('photo', (asset as any).file, fileName);
        } else {
          const blob = await (await fetch(asset.uri)).blob();
          formData.append('photo', blob, fileName);
        }
      } else {
        formData.append('photo', {
          uri: asset.uri,
          name: fileName,
          type: mimeType,
        } as any);
      }

      const apiRes = await authApi.uploadPhotoProfil(formData);
      if (apiRes.success) {
        await refreshProfile();
        showFeedback('Photo mise à jour', 'Votre photo de profil a été enregistrée.');
      } else {
        showFeedback('Erreur', apiRes.message || 'Impossible de télécharger la photo.');
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async () => {
    setUploadingPhoto(true);
    try {
      const res = await authApi.deletePhotoProfil();
      if (res.success) {
        await refreshProfile();
        showFeedback('Photo supprimée', 'Votre photo de profil a été réinitialisée.');
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveInfo = async () => {
    setSaving(true);
    try {
      const res = await authApi.updateProfil({
        name: nom.trim() || undefined,
        prenom: prenom.trim() || undefined,
      });
      if (res.success) {
        await refreshProfile();
        showFeedback('Profil enregistré', 'Vos informations ont été mises à jour.');
      } else {
        showFeedback('Erreur', res.message || 'Impossible de mettre à jour le profil.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.sectionGap, { maxWidth: 680 }]}>
      <View style={styles.card}>
        <View style={styles.profileTopRow}>
          {user?.photo_url ? (
            <Image source={{ uri: user.photo_url }} style={styles.avatarBigImg} contentFit="cover" />
          ) : (
            <View style={styles.avatarBigCircle}>
              <Text style={styles.avatarBigText}>{initials}</Text>
            </View>
          )}

          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.postTitle}>{user?.name || 'Super Admin Principal'}</Text>
            <Text style={{ color: SA_COLORS.green, fontSize: 12, fontWeight: '700' }}>
              {isFinancialOwner ? 'Super Admin Principal • Propriétaire Financier' : 'Super Admin Principal'}
            </Text>
            <Text style={styles.rowSub}>
              {user?.email || ''} {user?.phone ? `• ${user.phone}` : ''}
            </Text>

            <View style={[styles.rowWrap, { marginTop: 8 }]}>
              <Pressable onPress={handlePickPhoto} disabled={uploadingPhoto} style={styles.primaryBtnSmall}>
                <Text style={styles.primaryBtnText}>
                  {uploadingPhoto ? 'Chargement...' : 'Changer la photo de profil'}
                </Text>
              </Pressable>
              {user?.photo_url && (
                <Pressable onPress={handleDeletePhoto} disabled={uploadingPhoto} style={styles.outlineBtnSmall}>
                  <Text style={styles.outlineBtnText}>Supprimer</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.twoColGrid}>
          <View style={{ flex: 1, minWidth: 200 }}>
            <Text style={styles.fieldLabel}>Nom</Text>
            <TextInput style={styles.input} value={nom} onChangeText={setNom} />
          </View>
          <View style={{ flex: 1, minWidth: 200 }}>
            <Text style={styles.fieldLabel}>Prénom</Text>
            <TextInput style={styles.input} value={prenom} onChangeText={setPrenom} />
          </View>
        </View>

        <View style={styles.twoColGrid}>
          <View style={{ flex: 1, minWidth: 200 }}>
            <Text style={styles.fieldLabel}>Téléphone</Text>
            <View style={styles.readOnlyBox}>
              <Text style={styles.rowBold}>{user?.phone || 'Non renseigné'}</Text>
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 200 }}>
            <Text style={styles.fieldLabel}>Double Authentification (2FA OTP)</Text>
            <View style={[styles.readOnlyBox, { backgroundColor: SA_COLORS.greenSoft, borderColor: SA_COLORS.greenBorder }]}>
              <Text style={{ color: SA_COLORS.green, fontSize: 12, fontWeight: '800' }}>
                Activée &amp; Obligatoire ✓
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardFooterRow}>
          <Pressable onPress={() => void logout()} style={styles.dangerOutlineBtn}>
            <Text style={styles.dangerOutlineBtnText}>Se déconnecter</Text>
          </Pressable>
          <Pressable onPress={handleSaveInfo} disabled={saving} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionGap: { gap: 16 },
  centerLoader: { paddingVertical: 48, alignItems: 'center', gap: 10 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCard: {
    flex: 1,
    minWidth: 132,
    backgroundColor: SA_COLORS.white,
    borderWidth: 1,
    borderColor: SA_COLORS.border,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  kpiLabel: { fontSize: 12, fontWeight: '600', color: SA_COLORS.muted },
  kpiValue: { fontSize: 20, fontWeight: '900', color: SA_COLORS.text },
  kpiSub: { fontSize: 11, color: SA_COLORS.muted },
  kpiLink: { fontSize: 11, fontWeight: '700', color: SA_COLORS.green },
  twoColGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card: {
    backgroundColor: SA_COLORS.white,
    borderWidth: 1,
    borderColor: SA_COLORS.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: SA_COLORS.text },
  spaceBetweenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  listDividerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: SA_COLORS.slateSoft,
  },
  cardFooterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: SA_COLORS.slateSoft,
  },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  rowBold: { fontSize: 13, fontWeight: '700', color: SA_COLORS.text },
  rowSub: { fontSize: 12, color: SA_COLORS.muted },
  mutedText: { fontSize: 12, color: SA_COLORS.muted },
  postTitle: { fontSize: 15, fontWeight: '800', color: SA_COLORS.text },
  greenLink: { fontSize: 12, fontWeight: '700', color: SA_COLORS.green },
  quickActionCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SA_COLORS.border,
    backgroundColor: SA_COLORS.white,
    gap: 2,
  },
  financeHero: {
    backgroundColor: SA_COLORS.white,
    borderWidth: 2,
    borderColor: SA_COLORS.green,
    borderRadius: 18,
    padding: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  financeBigAmount: { fontSize: 28, fontWeight: '900', color: SA_COLORS.text, marginVertical: 4 },
  primaryBtn: {
    backgroundColor: SA_COLORS.green,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnSmall: {
    backgroundColor: SA_COLORS.green,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: SA_COLORS.white, fontSize: 12, fontWeight: '800' },
  outlineBtn: {
    borderWidth: 1,
    borderColor: SA_COLORS.border,
    backgroundColor: SA_COLORS.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  outlineBtnSmall: {
    borderWidth: 1,
    borderColor: SA_COLORS.border,
    backgroundColor: SA_COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
  },
  outlineBtnText: { color: SA_COLORS.text, fontSize: 12, fontWeight: '700' },
  softGreenBtn: {
    backgroundColor: SA_COLORS.greenSoft,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
  },
  softGreenBtnText: { color: SA_COLORS.green, fontSize: 12, fontWeight: '800' },
  dangerBtn: {
    backgroundColor: SA_COLORS.danger,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  dangerOutlineBtn: {
    borderWidth: 1,
    borderColor: SA_COLORS.dangerBorder,
    backgroundColor: SA_COLORS.dangerBg,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  dangerOutlineBtnText: { color: SA_COLORS.danger, fontSize: 12, fontWeight: '800' },
  greenPill: { backgroundColor: SA_COLORS.greenSoft, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  greenPillText: { color: SA_COLORS.green, fontSize: 10, fontWeight: '800' },
  slatePill: { backgroundColor: SA_COLORS.slateSoft, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  slatePillText: { color: SA_COLORS.text, fontSize: 10, fontWeight: '700' },
  amberPill: {
    backgroundColor: SA_COLORS.amberBg,
    borderWidth: 1,
    borderColor: SA_COLORS.amberBorder,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  amberPillText: { color: SA_COLORS.amberText, fontSize: 10, fontWeight: '800' },
  dangerPill: { backgroundColor: SA_COLORS.dangerBg, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  dangerPillText: { color: SA_COLORS.danger, fontSize: 10, fontWeight: '800' },
  filterPill: {
    backgroundColor: SA_COLORS.slateSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  filterPillActive: {
    backgroundColor: SA_COLORS.green,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  filterPillText: { color: SA_COLORS.text, fontSize: 12, fontWeight: '600' },
  filterPillTextActive: { color: SA_COLORS.white, fontSize: 12, fontWeight: '700' },
  subPill: {
    borderWidth: 1,
    borderColor: SA_COLORS.border,
    backgroundColor: SA_COLORS.white,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  subPillActive: {
    borderWidth: 1,
    borderColor: SA_COLORS.green,
    backgroundColor: SA_COLORS.greenSoft,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  subPillText: { color: SA_COLORS.muted, fontSize: 11, fontWeight: '600' },
  subPillTextActive: { color: SA_COLORS.green, fontSize: 11, fontWeight: '800' },
  input: {
    borderWidth: 1,
    borderColor: SA_COLORS.border,
    backgroundColor: SA_COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: SA_COLORS.text,
  },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: SA_COLORS.muted, marginBottom: 4 },
  readOnlyBox: {
    borderWidth: 1,
    borderColor: SA_COLORS.border,
    backgroundColor: SA_COLORS.slateSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  profileTopRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 },
  avatarBigCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: SA_COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: SA_COLORS.greenSoft,
  },
  avatarBigImg: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: SA_COLORS.greenSoft,
  },
  avatarBigText: { color: SA_COLORS.white, fontSize: 24, fontWeight: '900' },
  divider: { height: 1, backgroundColor: SA_COLORS.slateSoft, marginVertical: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: SA_COLORS.white,
    borderRadius: 18,
    padding: 20,
    gap: 12,
  },
  cancelLink: { alignItems: 'center', paddingVertical: 6 },
});

const SETTING_GROUP_LABELS: Record<string, { title: string; subtitle: string }> = {
  tarifs: {
    title: 'Tarifs officiels (FCFA)',
    subtitle: 'Montants facturés sur Kkiapay — modification réservée au propriétaire financier',
  },
  finance: {
    title: 'Coffre-fort & Compte bénéficiaire',
    subtitle: 'Liste blanche des décaissements et seuil minimum — accès exclusif M. Justin MAGNIDE',
  },
  securite: {
    title: 'Sécurité & Anti-contournement',
    subtitle: 'Durées de validité (TTL) des démasquages temporaires',
  },
  contact: {
    title: 'Coordonnées publiques & Support',
    subtitle: 'Informations affichées sur le site public et le pied de page',
  },
  general: {
    title: 'Identité de la plateforme',
    subtitle: 'Nom commercial et raison sociale imprimés sur les reçus officiels',
  },
};

export function SuperAdminSettingsSection() {
  const { refresh: refreshPublicConfig } = usePlatformConfig();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canEditFinancial, setCanEditFinancial] = useState(false);
  const [items, setItems] = useState<PlatformSettingItem[]>([]);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await adminApi.getSettings();
    if (res.success && res.data) {
      setCanEditFinancial(Boolean(res.data.can_edit_financial));
      setItems(res.data.items || []);
      const initial: Record<string, string> = {};
      (res.data.items || []).forEach((s) => {
        initial[s.cle] = s.valeur_brute ?? String(s.valeur ?? '');
      });
      setDraftValues(initial);
    } else {
      setError(res.message || 'Impossible de charger les paramètres de la plateforme.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const dirtyEntries = items
    .filter((item) => item.editable)
    .filter((item) => (draftValues[item.cle] ?? '') !== (item.valeur_brute ?? String(item.valeur ?? '')))
    .map((item) => ({
      cle: item.cle,
      valeur:
        item.type === 'integer'
          ? Number(draftValues[item.cle])
          : item.type === 'boolean'
          ? draftValues[item.cle] === 'true' || draftValues[item.cle] === '1'
          : draftValues[item.cle],
    }));

  const handleSave = async () => {
    if (dirtyEntries.length === 0) {
      showFeedback('Aucun changement', 'Aucune valeur modifiée à enregistrer.');
      return;
    }

    setSaving(true);
    const res = await adminApi.updateSettings(dirtyEntries);
    setSaving(false);

    if (res.success) {
      showFeedback('Paramètres enregistrés', res.message || 'Configuration mise à jour avec succès.');
      await Promise.all([loadSettings(), refreshPublicConfig()]);
    } else {
      showFeedback('Erreur de mise à jour', res.message || 'Impossible d’enregistrer ces paramètres.');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerLoader}>
        <ActivityIndicator size="large" color={SA_COLORS.green} />
        <Text style={styles.mutedText}>Chargement des paramètres dynamiques...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Erreur de chargement</Text>
        <Text style={styles.rowSub}>{error}</Text>
        <Pressable onPress={() => void loadSettings()} style={[styles.primaryBtn, { alignSelf: 'flex-start' }]}>
          <Text style={styles.primaryBtnText}>Réessayer</Text>
        </Pressable>
      </View>
    );
  }

  const groupOrder = ['tarifs', 'finance', 'securite', 'contact', 'general'];
  const presentGroups = Array.from(new Set(items.map((i) => i.groupe))).sort(
    (a, b) => (groupOrder.indexOf(a) === -1 ? 99 : groupOrder.indexOf(a)) - (groupOrder.indexOf(b) === -1 ? 99 : groupOrder.indexOf(b))
  );

  return (
    <View style={styles.sectionGap}>
      <View style={[styles.card, styles.spaceBetweenRow]}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.cardTitle}>Paramètres administrables en base de données</Text>
          <Text style={styles.rowSub}>
            {canEditFinancial
              ? 'Accès complet (Propriétaire financier) : tarifs, bénéficiaire officiel, sécurité et contact.'
              : 'Accès gouvernance : les tarifs sont en lecture seule et le groupe finance est masqué.'}
          </Text>
        </View>
        <View style={styles.rowWrap}>
          <Pressable onPress={() => void loadSettings()} style={styles.outlineBtn}>
            <Text style={styles.outlineBtnText}>Actualiser</Text>
          </Pressable>
          <Pressable
            onPress={() => void handleSave()}
            disabled={saving || dirtyEntries.length === 0}
            style={[styles.primaryBtn, (saving || dirtyEntries.length === 0) && { opacity: 0.55 }]}>
            <Text style={styles.primaryBtnText}>
              {saving ? 'Enregistrement...' : `Enregistrer (${dirtyEntries.length})`}
            </Text>
          </Pressable>
        </View>
      </View>

      {presentGroups.map((groupe) => {
        const meta = SETTING_GROUP_LABELS[groupe] || { title: groupe, subtitle: '' };
        const groupItems = items.filter((i) => i.groupe === groupe);
        return (
          <View key={groupe} style={styles.card}>
            <View style={{ gap: 2 }}>
              <Text style={styles.cardTitle}>{meta.title}</Text>
              {meta.subtitle ? <Text style={styles.rowSub}>{meta.subtitle}</Text> : null}
            </View>

            <View style={{ gap: 12 }}>
              {groupItems.map((setting) => {
                const value = draftValues[setting.cle] ?? '';
                const isModified = value !== (setting.valeur_brute ?? String(setting.valeur ?? ''));
                return (
                  <View key={setting.cle} style={{ gap: 4 }}>
                    <View style={styles.spaceBetweenRow}>
                      <Text style={styles.rowBold}>{setting.label}</Text>
                      <View style={styles.rowWrap}>
                        {setting.is_public ? (
                          <View style={styles.greenPill}>
                            <Text style={styles.greenPillText}>Public</Text>
                          </View>
                        ) : (
                          <View style={styles.slatePill}>
                            <Text style={styles.slatePillText}>Interne</Text>
                          </View>
                        )}
                        {!setting.editable ? (
                          <View style={styles.amberPill}>
                            <Text style={styles.amberPillText}>Lecture seule</Text>
                          </View>
                        ) : isModified ? (
                          <View style={styles.greenPill}>
                            <Text style={styles.greenPillText}>Modifié</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    {setting.description ? (
                      <Text style={styles.rowSub}>{setting.description}</Text>
                    ) : null}
                    {setting.editable ? (
                      <TextInput
                        style={styles.input}
                        value={value}
                        keyboardType={setting.type === 'integer' ? 'numeric' : 'default'}
                        onChangeText={(txt) =>
                          setDraftValues((prev) => ({ ...prev, [setting.cle]: txt }))
                        }
                      />
                    ) : (
                      <View style={styles.readOnlyBox}>
                        <Text style={styles.rowBold}>{value}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}
