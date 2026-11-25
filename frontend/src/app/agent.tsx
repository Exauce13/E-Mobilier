import { router } from 'expo-router';
import {
  Building2,
  Calendar,
  Check,
  Clock,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkles,
  Tag,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { usePlatformConfig } from '@/context/platform-config-context';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { inquiriesApi, proprietesApi } from '@/services/api';
import type { AgentDashboardData, BackendProperty } from '@/types/api';
import { formatFcfa } from '@/types/property';
import { confirmDialog } from '@/utils/dialog';
import { getStatusDisplay } from '@/utils/validation';

type AgentTab = 'biens' | 'visites';

export default function AgentDashboardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isMobile, contentMaxWidth, horizontalPadding } = useResponsive();
  const { user, isAuthenticated, isAgentMobilier, isAdminStaff, openAuthModal } = useAuth();
  const { tarifs } = usePlatformConfig();
  const agentFeeLabel = tarifs ? formatFcfa(tarifs.post_agent) : 'tarif préférentiel';
  const clientFeeLabel = tarifs ? formatFcfa(tarifs.post_client) : 'tarif officiel';

  const [activeTab, setActiveTab] = useState<AgentTab>('biens');
  const [statusFilter, setStatusFilter] = useState<string>('tous');
  const [searchProp, setSearchProp] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [dashboard, setDashboard] = useState<AgentDashboardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Quick edit property modal state
  const [editingProp, setEditingProp] = useState<BackendProperty | null>(null);
  const [editPrix, setEditPrix] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editLocationDetails, setEditLocationDetails] = useState('');
  const [editNegotiable, setEditNegotiable] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoadError(null);
    if (!isAuthenticated || (!isAgentMobilier && !isAdminStaff)) {
      setDashboard(null);
      return;
    }
    const res = await inquiriesApi.getAgentDashboard();
    if (res.success && res.data) {
      setDashboard(res.data);
    } else {
      setDashboard(null);
      setLoadError(res.message || 'Impossible de charger le tableau de bord agent.');
    }
  }, [isAuthenticated, isAgentMobilier, isAdminStaff]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      await loadDashboard();
      if (active) setLoading(false);
    };
    void run();
    return () => {
      active = false;
    };
  }, [loadDashboard]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  const filteredProperties = useMemo(() => {
    const list = dashboard?.proprietes || [];
    return list.filter((p) => {
      if (statusFilter !== 'tous' && p.status !== statusFilter) return false;
      if (searchProp.trim()) {
        const q = searchProp.toLowerCase();
        const hay = `${p.id} ${p.type} ${p.commune} ${p.quartier ?? ''} ${p.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [dashboard, statusFilter, searchProp]);

  const openEditModal = (prop: BackendProperty) => {
    setEditingProp(prop);
    setEditPrix(String(prop.prix ?? ''));
    setEditDesc(prop.description || '');
    setEditLocationDetails(prop.location_details || '');
    setEditNegotiable(Boolean(prop.is_negotiable));
  };

  const handleSavePropertyEdit = async () => {
    if (!editingProp) return;
    const numericPrice = Number(editPrix.replace(/\s+/g, ''));
    if (Number.isNaN(numericPrice) || numericPrice <= 0) {
      setFeedback({ text: 'Veuillez saisir un prix valide en F CFA.', type: 'error' });
      return;
    }
    setSavingEdit(true);
    const res = await proprietesApi.update(editingProp.id, {
      prix: numericPrice,
      description: editDesc.trim(),
      location_details: editLocationDetails.trim(),
      is_negotiable: editNegotiable,
    });
    setSavingEdit(false);
    if (res.success) {
      setEditingProp(null);
      setFeedback({ text: `Bien #${editingProp.id} mis à jour avec succès.`, type: 'success' });
      await loadDashboard();
    } else {
      setFeedback({ text: res.message || 'Impossible de modifier le bien.', type: 'error' });
    }
  };

  const handleDeleteProperty = async (prop: BackendProperty) => {
    const confirmed = await confirmDialog(
      'Supprimer ce bien ?',
      `Annonce #${prop.id} — ${prop.type} à ${prop.commune}`,
      'Supprimer'
    );
    if (!confirmed) return;

    const res = await proprietesApi.delete(prop.id);
    if (res.success) {
      setFeedback({ text: `Annonce #${prop.id} supprimée.`, type: 'success' });
      await loadDashboard();
    } else {
      setFeedback({ text: res.message || 'Suppression refusée.', type: 'error' });
    }
  };

  if (isAuthenticated && !isAgentMobilier && !isAdminStaff) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
        <ScreenHeader title="Espace Agent Immobilier" subtitle="Accès réservé" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
          <Lock size={34} color={theme.primary} strokeWidth={2.2} />
          <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, textAlign: 'center' }}>
            Espace strictement réservé aux agents immobiliers agréés
          </Text>
          <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: 'center', maxWidth: 420 }}>
            En tant que client, gérez vos annonces publiées depuis « Mes annonces » et vos visites
            sortantes depuis « Mes visites ».
          </Text>
          <Pressable
            onPress={() => router.replace('/my-properties' as any)}
            style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
            <Text style={styles.primaryBtnText}>Aller vers Mes annonces</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
        <ScreenHeader
          title="Espace Agent Immobilier"
          subtitle="Tableau de bord professionnel"
        />
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + 36 },
          ]}>
          <View style={[styles.innerWrap, { maxWidth: 760 }]}>
            <View style={[styles.heroCard, { backgroundColor: theme.navy }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Sparkles size={13} color="#FDE68A" strokeWidth={2.2} />
                <Text style={styles.heroEyebrow}>PORTAIL PROFESSIONNEL E-MOBILIER</Text>
              </View>
              <Text style={styles.heroTitle}>
                Développez votre activité d'agent immobilier au Bénin
              </Text>
              <Text style={styles.heroSub}>
                Publiez vos biens au tarif préférentiel de {agentFeeLabel}, suivez la modération de
                vos annonces et consultez en temps réel les visites programmées par E-Mobilier.
              </Text>
              <View style={styles.heroActions}>
                <Pressable
                  onPress={() => openAuthModal('login')}
                  style={[styles.goldBtn, { backgroundColor: '#F59E0B' }]}>
                  <Text style={styles.goldBtnText}>Connexion Agent</Text>
                </Pressable>
                <Pressable
                  onPress={() => openAuthModal('register')}
                  style={[styles.outlineWhiteBtn]}>
                  <Text style={styles.outlineWhiteBtnText}>Devenir Agent Immobilier</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.benefitsGrid}>
              {[
                { Icon: Tag, title: `Tarif Agent ${agentFeeLabel}`, desc: 'Publication accélérée avec suivi de modération en temps réel.' },
                { Icon: Calendar, title: 'Visites encadrées', desc: 'Suivez les visites programmées sur vos biens par l’équipe E-Mobilier.' },
                { Icon: ShieldCheck, title: 'Sécurité & Monopole', desc: 'Les transactions et mises en relation sont sécurisées par E-Mobilier.' },
              ].map((b) => (
                <View
                  key={b.title}
                  style={[
                    styles.benefitCard,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}>
                  <b.Icon size={22} color={theme.primary} strokeWidth={2.2} />
                  <Text style={[styles.benefitTitle, { color: theme.text }]}>{b.title}</Text>
                  <Text style={[styles.benefitDesc, { color: theme.textSecondary }]}>{b.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const kpis = dashboard?.kpis;

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Tableau de bord Agent"
        subtitle={user?.name || 'Agent Immobilier'}
        rightAction={
          <Pressable
            onPress={() => router.push('/publish-agent' as any)}
            style={[styles.headerBtn, { backgroundColor: '#F59E0B' }]}>
            <Text style={styles.headerBtnText}>+ Publier</Text>
          </Pressable>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
        contentContainerStyle={[
          styles.scroll,
          { paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + 40 },
        ]}>
        <View style={[styles.innerWrap, { maxWidth: contentMaxWidth }]}>
          {/* Top Agent Identity & CTA Banner */}
          <View style={[styles.heroCard, { backgroundColor: theme.navy }]}>
            <View style={styles.heroTopRow}>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.badgeRow}>
                  <View style={styles.goldPill}>
                    <Text style={styles.goldPillText}>
                      {isAgentMobilier
                        ? 'AGENT IMMOBILIER'
                        : isAdminStaff
                        ? 'ADMINISTRATEUR'
                        : 'PROPRIÉTAIRE / GESTIONNAIRE'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.kycPill,
                      {
                        backgroundColor: user?.is_verifed ? '#065F46' : '#78350F',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                      },
                    ]}>
                    {user?.is_verifed ? (
                      <Check size={12} color="#FFFFFF" strokeWidth={2.8} />
                    ) : (
                      <Clock size={12} color="#FFFFFF" strokeWidth={2.4} />
                    )}
                    <Text style={styles.kycPillText}>
                      {user?.is_verifed ? 'KYC Agréé' : 'KYC en cours'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.heroTitle}>{user?.name}</Text>
                <Text style={styles.heroSub}>
                  Tarif publication actif : {isAdminStaff ? 'Gratuit' : isAgentMobilier ? agentFeeLabel : clientFeeLabel} •{' '}
                  {user?.phone}
                </Text>
              </View>

              <View style={styles.heroActions}>
                <Pressable
                  onPress={() => router.push('/publish-agent' as any)}
                  style={[styles.goldBtn, { backgroundColor: '#F59E0B' }]}>
                  <Text style={styles.goldBtnText}>+ Publier un bien</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/visits' as any)}
                  style={styles.outlineWhiteBtn}>
                  <Text style={styles.outlineWhiteBtnText}>Agenda visites</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {feedback && (
            <View
              style={[
                styles.feedbackBanner,
                {
                  backgroundColor: feedback.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                  borderColor: feedback.type === 'success' ? '#A7F3D0' : '#FECACA',
                },
              ]}>
              <Text
                style={{
                  color: feedback.type === 'success' ? '#047857' : '#B91C1C',
                  fontSize: 13,
                  fontWeight: '700',
                  flex: 1,
                }}>
                {feedback.text}
              </Text>
              <Pressable onPress={() => setFeedback(null)} hitSlop={8}>
                <X size={16} color="#64748B" strokeWidth={2.2} />
              </Pressable>
            </View>
          )}

          {loadError ? (
            <View
              style={[
                styles.feedbackBanner,
                { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
              ]}>
              <Text style={{ color: '#B91C1C', fontSize: 13, fontWeight: '700', flex: 1 }}>
                {loadError}
              </Text>
              <Pressable onPress={() => void loadDashboard()}>
                <Text style={{ color: '#B91C1C', fontSize: 12, fontWeight: '800' }}>Réessayer</Text>
              </Pressable>
            </View>
          ) : null}

          {/* KPI Strip */}
          <View style={styles.kpiGrid}>
            {[
              {
                label: 'Biens gérés',
                value: kpis?.total_biens ?? 0,
                sub: `${kpis?.biens_publies ?? 0} publiés`,
                Icon: Building2,
              },
              {
                label: 'En modération',
                value: kpis?.biens_en_attente ?? 0,
                sub: `${kpis?.biens_conclus ?? 0} conclus`,
                Icon: Clock,
              },
              {
                label: 'Visites reçues',
                value: kpis?.total_visites ?? 0,
                sub: `${kpis?.visites_en_attente ?? 0} en attente`,
                Icon: Calendar,
              },
              {
                label: 'Visiteurs uniques',
                value: kpis?.total_clients ?? 0,
                sub: 'Nom & prénom uniquement',
                Icon: ShieldCheck,
              },
            ].map((item) => (
              <View
                key={item.label}
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.cardBorder,
                    width: isMobile ? '47.5%' : '23.5%',
                  },
                ]}>
                <item.Icon size={20} color={theme.primary} strokeWidth={2.2} />
                <Text style={[styles.kpiValue, { color: theme.primary }]}>{item.value}</Text>
                <Text style={[styles.kpiLabel, { color: theme.text }]}>{item.label}</Text>
                <Text style={[styles.kpiSub, { color: theme.textSecondary }]}>{item.sub}</Text>
              </View>
            ))}
          </View>

          {/* Main Section Tabs (Strict Monopole : Biens + Visites reçues sans contacts) */}
          <View style={styles.tabsRow}>
            {(
              [
                { key: 'biens', label: `Gestion des biens (${dashboard?.proprietes.length ?? 0})` },
                { key: 'visites', label: `Visites sur mes biens (${dashboard?.visites.length ?? 0})` },
              ] as const
            ).map((tab) => {
              const active = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[
                    styles.tabBtn,
                    {
                      backgroundColor: active ? theme.primary : theme.cardBackground,
                      borderColor: active ? theme.primary : theme.cardBorder,
                    },
                  ]}>
                  <Text
                    style={{
                      color: active ? '#FFFFFF' : theme.text,
                      fontSize: 13,
                      fontWeight: '800',
                    }}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 36 }} />
          ) : (
            <>
              {/* TAB 1: GESTION DES BIENS */}
              {activeTab === 'biens' && (
                <View style={{ gap: 14 }}>
                  <View style={[styles.toolbar, isMobile && { flexDirection: 'column', alignItems: 'stretch' }]}>
                    <TextInput
                      style={[
                        styles.searchInput,
                        {
                          color: theme.text,
                          backgroundColor: theme.cardBackground,
                          borderColor: theme.cardBorder,
                        },
                      ]}
                      placeholder="Filtrer mes biens (commune, quartier, type...)"
                      placeholderTextColor={theme.textSecondary}
                      value={searchProp}
                      onChangeText={setSearchProp}
                    />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {[
                        { key: 'tous', label: 'Tous' },
                        { key: 'published', label: 'Publiés' },
                        { key: 'pending', label: 'En attente' },
                        { key: 'rejected', label: 'Rejetés' },
                        { key: 'sold_rented', label: 'Conclus' },
                      ].map((f) => {
                        const active = statusFilter === f.key;
                        return (
                          <Pressable
                            key={f.key}
                            onPress={() => setStatusFilter(f.key)}
                            style={[
                              styles.filterPill,
                              {
                                backgroundColor: active ? theme.navy : theme.cardBackground,
                                borderColor: active ? theme.navy : theme.cardBorder,
                              },
                            ]}>
                            <Text
                              style={{
                                color: active ? '#FFFFFF' : theme.text,
                                fontSize: 12,
                                fontWeight: '700',
                              }}>
                              {f.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {filteredProperties.length === 0 ? (
                    <View
                      style={[
                        styles.emptyCard,
                        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                      ]}>
                      <Text style={[styles.emptyTitle, { color: theme.text }]}>
                        Aucun bien dans cette catégorie
                      </Text>
                      <Pressable
                        onPress={() => router.push('/publish-agent' as any)}
                        style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
                        <Text style={styles.primaryBtnText}>+ Publier une annonce Agent</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.cardsGrid}>
                      {filteredProperties.map((prop) => {
                        const st = getStatusDisplay(prop.status);
                        return (
                          <View
                            key={prop.id}
                            style={[
                              styles.propCard,
                              {
                                backgroundColor: theme.cardBackground,
                                borderColor: theme.cardBorder,
                                width: isMobile ? '100%' : '48.8%',
                              },
                            ]}>
                            <View style={styles.cardHeader}>
                              <Text style={[styles.cardTitle, { color: theme.text }]}>
                                #{prop.id} • {prop.type.toUpperCase()} ({prop.transaction_type})
                              </Text>
                              <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                                <Text style={{ color: st.text, fontSize: 11, fontWeight: '800' }}>
                                  {st.label}
                                </Text>
                              </View>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <MapPin size={13} color={theme.primary} strokeWidth={2.2} />
                              <Text style={{ color: theme.textSecondary, fontSize: 13, flex: 1 }}>
                                {[prop.quartier, prop.arrondissement, prop.commune].filter(Boolean).join(', ')}
                              </Text>
                            </View>
                            <Text style={{ color: theme.primary, fontSize: 17, fontWeight: '900' }}>
                              {formatFcfa(prop.prix)}
                              {prop.transaction_type === 'location' ? '/mois' : ''}
                            </Text>
                            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                              {prop.surface} m²
                              {prop.nombres_chambres ? ` • ${prop.nombres_chambres} ch.` : ''}
                              {prop.is_negotiable ? ' • Négociable' : ''}
                            </Text>

                            {prop.motif_rejet ? (
                              <View style={styles.rejectBox}>
                                <Text style={styles.rejectText}>Motif rejet : {prop.motif_rejet}</Text>
                              </View>
                            ) : null}

                            <View style={styles.actionBtns}>
                              <Pressable
                                onPress={() => router.push(`/property/${prop.id}` as any)}
                                style={[styles.smallBtn, { backgroundColor: theme.backgroundElement }]}>
                                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>
                                  Fiche
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => openEditModal(prop)}
                                style={[styles.smallBtn, { backgroundColor: theme.primaryLight }]}>
                                <Text style={{ color: theme.primaryDark, fontWeight: '700', fontSize: 12 }}>
                                  Modifier
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => handleDeleteProperty(prop)}
                                style={[styles.smallBtn, { backgroundColor: '#FEE2E2' }]}>
                                <Text style={{ color: '#B91C1C', fontWeight: '700', fontSize: 12 }}>
                                  Supprimer
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* TAB 2: VISITES REÇUES SUR MES BIENS (MONOPOLE E-MOBILIER : NOM & PRÉNOM UNIQUEMENT) */}
              {activeTab === 'visites' && (
                <View style={{ gap: 14 }}>
                  <View
                    style={[
                      styles.propStrip,
                      {
                        backgroundColor: theme.primaryLight,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        padding: 12,
                      },
                    ]}>
                    <Lock size={15} color={theme.primary} strokeWidth={2.2} />
                    <Text style={{ color: theme.primaryDark, fontSize: 12, fontWeight: '700', flex: 1 }}>
                      Règle de monopole E-Mobilier : seuls le nom et le prénom du visiteur sont
                      affichés. La coordination et les coordonnées complètes sont gérées
                      exclusivement par l'administration E-Mobilier.
                    </Text>
                  </View>

                  <Text style={[styles.subHeading, { color: theme.text }]}>
                    Visites programmées sur vos biens ({dashboard?.visites.length ?? 0})
                  </Text>

                  {(dashboard?.visites.length ?? 0) === 0 ? (
                    <View
                      style={[
                        styles.emptyCard,
                        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                      ]}>
                      <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: 'center' }}>
                        Aucune demande de visite physique enregistrée sur vos annonces pour le moment.
                      </Text>
                    </View>
                  ) : (
                    dashboard?.visites.map((v) => {
                      const st = getStatusDisplay(v.status);
                      const clientFullName = v.client
                        ? `${v.client.prenom ?? ''} ${v.client.name ?? ''}`.trim() || 'Client E-Mobilier'
                        : 'Client E-Mobilier';
                      return (
                        <View
                          key={`ag-vis-${v.id}`}
                          style={[
                            styles.listCard,
                            { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                          ]}>
                          <View style={styles.cardHeader}>
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={[styles.cardTitle, { color: theme.text }]}>
                                VIS-{String(v.id).padStart(5, '0')} • {clientFullName}
                              </Text>
                              {v.propriete ? (
                                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                                  Bien #{v.propriete.id} • {v.propriete.type.toUpperCase()} —{' '}
                                  {v.propriete.commune}
                                  {v.propriete.quartier ? ` (${v.propriete.quartier})` : ''}
                                </Text>
                              ) : null}
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                              <Text style={{ color: st.text, fontSize: 11, fontWeight: '800' }}>
                                {st.label}
                              </Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <Calendar size={13} color={theme.primary} strokeWidth={2.2} />
                              <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>
                                {new Date(v.scheduled_date).toLocaleString('fr-FR')}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <Lock size={13} color={theme.textSecondary} strokeWidth={2} />
                              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                                Coordonnées réservées à E-Mobilier
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Quick Property Edit Modal */}
      <Modal
        visible={Boolean(editingProp)}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingProp(null)}>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
            ]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Modifier l'annonce #{editingProp?.id}
            </Text>
            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement },
              ]}
              placeholder="Prix (F CFA)"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
              value={editPrix}
              onChangeText={setEditPrix}
            />
            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement },
              ]}
              placeholder="Repères d'accès"
              placeholderTextColor={theme.textSecondary}
              value={editLocationDetails}
              onChangeText={setEditLocationDetails}
            />
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.cardBorder,
                  backgroundColor: theme.backgroundElement,
                  minHeight: 84,
                  textAlignVertical: 'top',
                },
              ]}
              placeholder="Description du bien"
              placeholderTextColor={theme.textSecondary}
              multiline
              value={editDesc}
              onChangeText={setEditDesc}
            />
            <View style={styles.switchRow}>
              <Text style={{ color: theme.text, fontWeight: '700' }}>Prix négociable</Text>
              <Switch
                value={editNegotiable}
                onValueChange={setEditNegotiable}
                trackColor={{ true: theme.primary }}
              />
            </View>
            <Pressable
              onPress={handleSavePropertyEdit}
              disabled={savingEdit}
              style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
              <Text style={styles.primaryBtnText}>
                {savingEdit ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </Text>
            </Pressable>
            <Pressable onPress={() => setEditingProp(null)} style={{ alignItems: 'center', padding: 8 }}>
              <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9 },
  headerBtnText: { color: '#0F172A', fontSize: 12, fontWeight: '900' },
  scroll: { paddingTop: Spacing.three },
  innerWrap: { width: '100%', alignSelf: 'center', gap: 16 },
  heroCard: { borderRadius: 22, padding: 20, gap: 14 },
  heroTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  goldPill: { backgroundColor: 'rgba(245, 158, 11, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  goldPillText: { color: '#FDE68A', fontSize: 11, fontWeight: '800' },
  kycPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  kycPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  heroEyebrow: { color: '#FDE68A', fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  heroSub: { color: '#CBD5E1', fontSize: 13, lineHeight: 20 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goldBtn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12 },
  goldBtnText: { color: '#0F172A', fontSize: 13, fontWeight: '900' },
  outlineWhiteBtn: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.32)',
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 12,
  },
  outlineWhiteBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  feedbackBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  kpiCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 3 },
  kpiValue: { fontSize: 24, fontWeight: '900' },
  kpiLabel: { fontSize: 13, fontWeight: '800' },
  kpiSub: { fontSize: 11 },
  tabsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 13,
  },
  filterPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  propCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 8 },
  listCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '800', flex: 1 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  rejectBox: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8 },
  rejectText: { color: '#B91C1C', fontSize: 12, fontWeight: '600' },
  propStrip: { borderRadius: 10, padding: 10 },
  actionBtns: { flexDirection: 'row', gap: 8, marginTop: 4 },
  smallBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  statusActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  statusActionChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9 },
  subHeading: { fontSize: 16, fontWeight: '900' },
  benefitsGrid: { gap: 12 },
  benefitCard: { borderRadius: 18, borderWidth: 1, padding: 18, gap: 6 },
  benefitTitle: { fontSize: 16, fontWeight: '800' },
  benefitDesc: { fontSize: 13, lineHeight: 19 },
  emptyCard: { borderRadius: 18, borderWidth: 1, padding: 28, alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  primaryBtn: { borderRadius: 12, paddingHorizontal: 18, paddingVertical: 13, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  input: { borderRadius: 12, borderWidth: 1, padding: 11, fontSize: 14 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
