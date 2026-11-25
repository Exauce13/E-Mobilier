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
import { adminApi, authApi, financeApi, getStorageBaseUrl } from '@/services/api';
import type { AuditLogItem, BackendProperty } from '@/types/api';
import { formatFcfa, resolveStorageUrl } from '@/types/property';

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
  const [zonesPerf, setZonesPerf] = useState<any[]>([]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [finRes, allPostsRes, pendingPostsRes, demRes, logsRes, zoneRes] = await Promise.all([
        isFinancialOwner ? financeApi.getTableauDeBord().catch(() => null) : Promise.resolve(null),
        adminApi.getAllProprietes({ per_page: 1 }).catch(() => null),
        adminApi.getProprietesEnAttente(1).catch(() => null),
        adminApi.enAttenteDemasquage(1).catch(() => null),
        adminApi.getAuditLogs({ per_page: 1 }).catch(() => null),
        adminApi.getZonePerformance().catch(() => null),
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
      if (zoneRes?.success && zoneRes.data) {
        const zData: any = zoneRes.data;
        setZonesPerf(Array.isArray(zData) ? zData : zData.zones || zData.par_zone || []);
      }
    } finally {
      setLoading(false);
    }
  }, [isFinancialOwner]);

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

      {/* Two-Column Summary */}
      <View style={styles.twoColGrid}>
        {/* Performance par zone */}
        <View style={[styles.card, { flex: 2, minWidth: 280 }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Performance opérationnelle par zone</Text>
            <Pressable onPress={loadDashboard}>
              <Text style={styles.greenLink}>Actualiser</Text>
            </Pressable>
          </View>
          {zonesPerf.length === 0 ? (
            <Text style={styles.mutedText}>Aucune donnée de zone disponible pour le moment.</Text>
          ) : (
            zonesPerf.map((z: any, idx: number) => (
              <View key={z.id || z.zone_id || idx} style={styles.listDividerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowBold}>{z.nom || z.zone_nom || `Zone #${z.zone_id ?? idx + 1}`}</Text>
                  <Text style={styles.rowSub}>
                    {z.total_visites ?? z.visites_total ?? 0} visites • {z.total_biens ?? z.proprietes_count ?? 0} biens
                  </Text>
                </View>
                <View style={styles.greenPill}>
                  <Text style={styles.greenPillText}>{z.taux_traitement ? `${z.taux_traitement}%` : 'Actif'}</Text>
                </View>
              </View>
            ))
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
          <Pressable onPress={() => onNavigate('profil')} style={styles.quickActionCard}>
            <Text style={styles.rowBold}>Changer ma photo de profil</Text>
            <Text style={styles.rowSub}>Paramètres du compte Super Admin</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* ============================================================================
 * 2. COFFRE-FORT FINANCIER & RETRAITS OTP
 * ========================================================================== */
export function SuperAdminFinanceSection() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [retraits, setRetraits] = useState<any[]>([]);
  const [secStatut, setSecStatut] = useState<any>(null);
  const [txFilter, setTxFilter] = useState<'all' | 'visit_fee' | 'unlock_fee' | 'retrait'>('all');

  // Retrait OTP Modal
  const [retraitModalOpen, setRetraitModalOpen] = useState(false);
  const [montant, setMontant] = useState('');
  const [canal, setCanal] = useState<'mobile_money' | 'virement_bancaire'>('mobile_money');
  const [pendingRetraitId, setPendingRetraitId] = useState<number | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadFinance = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, txRes, retRes, secRes] = await Promise.all([
        financeApi.getTableauDeBord().catch(() => null),
        financeApi.getTransactions({ page: 1 }).catch(() => null),
        financeApi.getRetraits(1).catch(() => null),
        financeApi.getSecurityStatut().catch(() => null),
      ]);
      if (dashRes?.success) setDashboard(dashRes.data);
      if (txRes?.success && txRes.data) {
        const td: any = txRes.data;
        setTransactions(Array.isArray(td) ? td : td.data || []);
      }
      if (retRes?.success && retRes.data) {
        const rd: any = retRes.data;
        setRetraits(Array.isArray(rd) ? rd : rd.data || []);
      }
      if (secRes?.success) setSecStatut(secRes.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFinance();
  }, [loadFinance]);

  const soldeDisponible = Number(
    dashboard?.solde_disponible ??
      dashboard?.tresorerie?.solde_disponible ??
      dashboard?.resume_financier?.solde_net_disponible ??
      0
  );
  const isFrozen = Boolean(secStatut?.retraits_geles ?? secStatut?.est_gele ?? false);

  const handleVerifyHmac = async () => {
    const res = await financeApi.verifierIntegrite();
    showFeedback(
      res.success ? 'Intégrité HMAC vérifiée' : 'Alerte Intégrité',
      res.message || (res.success ? 'Chaînage cryptographique 100% valide.' : 'Anomalie détectée.')
    );
  };

  const handleToggleFreeze = async () => {
    const res = isFrozen
      ? await financeApi.degelerRetraits()
      : await financeApi.gelerRetraits('Gel préventif depuis le portail Super Admin Principal');
    showFeedback(res.success ? 'Coupe-circuit mis à jour' : 'Erreur', res.message || '');
    await loadFinance();
  };

  const handleInitRetrait = async () => {
    const num = Number(montant.replace(/\s+/g, ''));
    if (!num || num <= 0) {
      showFeedback('Montant requis', 'Veuillez saisir un montant valide en FCFA.');
      return;
    }
    setSubmitting(true);
    const res = await financeApi.initierRetrait(num, canal);
    setSubmitting(false);
    if (res.success && res.data) {
      const id = (res.data as any).retrait?.id ?? (res.data as any).id;
      setPendingRetraitId(id || null);
      showFeedback('Code OTP envoyé', res.message || 'Saisissez le code OTP reçu pour confirmer.');
    } else {
      showFeedback('Erreur retrait', res.message || "Impossible d'initier le retrait.");
    }
  };

  const handleConfirmOtp = async () => {
    if (!pendingRetraitId || !otpCode.trim()) return;
    setSubmitting(true);
    const res = await financeApi.confirmerOtpRetrait(pendingRetraitId, otpCode.trim());
    setSubmitting(false);
    if (res.success) {
      showFeedback('Retrait confirmé', res.message || 'Décaissement exécuté.');
      setRetraitModalOpen(false);
      setPendingRetraitId(null);
      setOtpCode('');
      setMontant('');
      await loadFinance();
    } else {
      showFeedback('OTP invalide', res.message || 'Vérifiez le code OTP.');
    }
  };

  const filteredTx = transactions.filter((t) => {
    if (txFilter === 'all') return true;
    return String(t.payment_type || t.type || '').includes(txFilter);
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
            <Text style={styles.greenPillText}>Accès Exclusif • Super Admin Principal</Text>
          </View>
          <Text style={styles.mutedText}>Solde disponible en trésorerie</Text>
          <Text style={styles.financeBigAmount}>
            {formatFcfa(soldeDisponible)}
          </Text>
          <Text style={styles.rowSub}>
            Déblocages (50 F) • Visites (500 F) • Publications (100 F / 500 F)
          </Text>
        </View>
        <View style={styles.rowWrap}>
          <Pressable onPress={() => setRetraitModalOpen(true)} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>+ Initier un retrait OTP</Text>
          </Pressable>
          <Pressable onPress={loadFinance} style={styles.outlineBtn}>
            <Text style={styles.outlineBtnText}>Actualiser</Text>
          </Pressable>
        </View>
      </View>

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

      {/* Transactions */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Transactions Kkiapay ({filteredTx.length})</Text>
          <View style={styles.rowWrap}>
            {(
              [
                { k: 'all', l: 'Toutes' },
                { k: 'visit_fee', l: 'Visites' },
                { k: 'unlock_fee', l: 'Déblocages' },
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
          <Text style={styles.mutedText}>Aucune transaction enregistrée.</Text>
        ) : (
          filteredTx.slice(0, 20).map((t, idx) => (
            <View key={t.id || idx} style={styles.listDividerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowBold}>
                  {t.transaction_reference || `TX-${t.id}`} • {t.payment_type || t.type || 'Paiement'}
                </Text>
                <Text style={styles.rowSub}>
                  {t.created_at ? new Date(t.created_at).toLocaleString('fr-FR') : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.rowBold, { color: SA_COLORS.green }]}>
                  +{formatFcfa(t.amount ?? t.montant ?? 0)}
                </Text>
                <Text style={styles.rowSub}>{t.status || 'validé'}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Retraits récents */}
      {retraits.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Historique des retraits OTP ({retraits.length})</Text>
          {retraits.slice(0, 10).map((r, idx) => (
            <View key={r.id || idx} style={styles.listDividerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowBold}>
                  Retrait #{r.id} • {r.canal || 'Mobile Money'}
                </Text>
                <Text style={styles.rowSub}>{r.compte_destination || ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.rowBold}>-{formatFcfa(r.montant ?? 0)}</Text>
                <Text style={styles.rowSub}>{r.statut || r.status}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Modal Retrait OTP */}
      <Modal visible={retraitModalOpen} transparent animationType="fade" onRequestClose={() => setRetraitModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>
              {pendingRetraitId ? 'Confirmer le retrait par OTP' : 'Initier un retrait sécurisé'}
            </Text>

            {!pendingRetraitId ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Montant en FCFA (ex: 50000)"
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
                <TextInput
                  style={styles.input}
                  placeholder="Code OTP à 6 chiffres"
                  placeholderTextColor={SA_COLORS.muted}
                  keyboardType="numeric"
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
  const [loading, setLoading] = useState(true);

  const [rejectModalId, setRejectModalId] = useState<number | null>(null);
  const [rejectMotif, setRejectMotif] = useState('');

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAllProprietes({
        author_role: authorRole,
        status: statusFilter,
        search: search.trim() || undefined,
        per_page: 40,
      });
      if (res.success && Array.isArray(res.data)) {
        setPosts(res.data);
      } else {
        setPosts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [authorRole, statusFilter, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPosts();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadPosts]);

  const handleValidate = async (id: number) => {
    const res = await adminApi.validerPropriete(id);
    showFeedback(res.success ? 'Annonce validée' : 'Erreur', res.message || '');
    if (res.success) await loadPosts();
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
    if (res.success) await loadPosts();
  };

  const handleOpenDocs = async (id: number) => {
    const res = await adminApi.getProprieteDocuments(id);
    const docs = res.data || [];
    if (!docs.length) {
      showFeedback('Documents', 'Aucun document justificatif joint à ce post.');
      return;
    }
    const firstUrl = resolveStorageUrl(docs[0].document_url || docs[0].url_consultation, storageBaseUrl);
    if (firstUrl) {
      await WebBrowser.openBrowserAsync(firstUrl);
    }
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
    minWidth: 165,
    backgroundColor: SA_COLORS.white,
    borderWidth: 1,
    borderColor: SA_COLORS.border,
    borderRadius: 16,
    padding: 16,
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
