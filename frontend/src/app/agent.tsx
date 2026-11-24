import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { inquiriesApi, proprietesApi } from '@/services/api';
import type { AgentDashboardData, BackendProperty, PropertyInquiryItem } from '@/types/api';
import { formatFcfa } from '@/types/property';
import { getInquiryTypeLabel, getStatusDisplay } from '@/utils/validation';

type AgentTab = 'biens' | 'demandes' | 'clients';

export default function AgentDashboardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isMobile, contentMaxWidth, horizontalPadding } = useResponsive();
  const { user, isAuthenticated, isAgentMobilier, isAdminStaff, openAuthModal } = useAuth();

  const [activeTab, setActiveTab] = useState<AgentTab>('biens');
  const [statusFilter, setStatusFilter] = useState<string>('tous');
  const [searchProp, setSearchProp] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [dashboard, setDashboard] = useState<AgentDashboardData | null>(null);

  // Quick edit property modal state
  const [editingProp, setEditingProp] = useState<BackendProperty | null>(null);
  const [editPrix, setEditPrix] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editLocationDetails, setEditLocationDetails] = useState('');
  const [editNegotiable, setEditNegotiable] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!isAuthenticated) {
      setDashboard(null);
      return;
    }
    const res = await inquiriesApi.getAgentDashboard();
    if (res.success && res.data) {
      setDashboard(res.data);
    }
  }, [isAuthenticated]);

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

  const handleDeleteProperty = (prop: BackendProperty) => {
    Alert.alert(
      'Supprimer ce bien ?',
      `Annonce #${prop.id} — ${prop.type} à ${prop.commune}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const res = await proprietesApi.delete(prop.id);
            if (res.success) {
              setFeedback({ text: `Annonce #${prop.id} supprimée.`, type: 'success' });
              await loadDashboard();
            } else {
              setFeedback({ text: res.message || 'Suppression refusée.', type: 'error' });
            }
          },
        },
      ]
    );
  };

  const handleUpdateInquiryStatus = async (
    inq: PropertyInquiryItem,
    status: 'en_cours' | 'confirme' | 'traite' | 'annule'
  ) => {
    const res = await inquiriesApi.updateStatus(inq.id, status);
    if (res.success) {
      setFeedback({
        text: `Demande #${inq.id} marquée comme "${getStatusDisplay(status).label}".`,
        type: 'success',
      });
      await loadDashboard();
    } else {
      setFeedback({ text: res.message || 'Mise à jour du statut impossible.', type: 'error' });
    }
  };

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
              <Text style={styles.heroEyebrow}>✦ PORTAIL PROFESSIONNEL E-MOBILIER</Text>
              <Text style={styles.heroTitle}>
                Développez votre activité d'agent immobilier au Bénin
              </Text>
              <Text style={styles.heroSub}>
                Publiez vos biens au tarif préférentiel de 100 F CFA, recevez des demandes de visites
                qualifiées, gérez vos rendez-vous et suivez vos prospects depuis un seul tableau de bord.
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
                { icon: '🏷️', title: 'Tarif Agent 100 F CFA', desc: 'Publication accélérée avec suivi de modération en temps réel.' },
                { icon: '📅', title: 'Visites & Rendez-vous', desc: 'Centralisez toutes les demandes de visite et rendez-vous sur vos biens.' },
                { icon: '👥', title: 'Fichier Clients CRM', desc: 'Retrouvez automatiquement l’historique de vos contacts et prospects.' },
              ].map((b) => (
                <View
                  key={b.title}
                  style={[
                    styles.benefitCard,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}>
                  <Text style={{ fontSize: 24 }}>{b.icon}</Text>
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
                      { backgroundColor: user?.is_verifed ? '#065F46' : '#78350F' },
                    ]}>
                    <Text style={styles.kycPillText}>
                      {user?.is_verifed ? '✓ KYC Agréé' : '⏳ KYC en cours'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.heroTitle}>{user?.name}</Text>
                <Text style={styles.heroSub}>
                  Tarif publication actif : {isAdminStaff ? 'Gratuit' : isAgentMobilier ? '100 F CFA' : '500 F CFA'} •{' '}
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
              <Pressable onPress={() => setFeedback(null)}>
                <Text style={{ fontWeight: '800', color: '#64748B' }}>✕</Text>
              </Pressable>
            </View>
          )}

          {/* KPI Strip */}
          <View style={styles.kpiGrid}>
            {[
              {
                label: 'Biens gérés',
                value: kpis?.total_biens ?? 0,
                sub: `${kpis?.biens_publies ?? 0} publiés`,
                icon: '🏘️',
              },
              {
                label: 'En modération',
                value: kpis?.biens_en_attente ?? 0,
                sub: `${kpis?.biens_conclus ?? 0} conclus`,
                icon: '⏳',
              },
              {
                label: 'Demandes & Visites',
                value: (kpis?.total_demandes ?? 0) + (kpis?.total_visites ?? 0),
                sub: `${kpis?.demandes_nouvelles ?? 0} nouvelles`,
                icon: '📩',
              },
              {
                label: 'Clients & Prospects',
                value: kpis?.total_clients ?? 0,
                sub: 'Contacts enregistrés',
                icon: '👥',
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
                <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                <Text style={[styles.kpiValue, { color: theme.primary }]}>{item.value}</Text>
                <Text style={[styles.kpiLabel, { color: theme.text }]}>{item.label}</Text>
                <Text style={[styles.kpiSub, { color: theme.textSecondary }]}>{item.sub}</Text>
              </View>
            ))}
          </View>

          {/* Main Section Tabs */}
          <View style={styles.tabsRow}>
            {(
              [
                { key: 'biens', label: `Gestion des biens (${dashboard?.proprietes.length ?? 0})` },
                {
                  key: 'demandes',
                  label: `Demandes & Visites (${(dashboard?.inquiries.length ?? 0) + (dashboard?.visites.length ?? 0)})`,
                },
                { key: 'clients', label: `Clients (${dashboard?.clients.length ?? 0})` },
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

                            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                              📍 {[prop.quartier, prop.arrondissement, prop.commune].filter(Boolean).join(', ')}
                            </Text>
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

              {/* TAB 2: DEMANDES & VISITES */}
              {activeTab === 'demandes' && (
                <View style={{ gap: 14 }}>
                  <Text style={[styles.subHeading, { color: theme.text }]}>
                    Demandes de visite, Rendez-vous & Messages reçus ({dashboard?.inquiries.length ?? 0})
                  </Text>

                  {(dashboard?.inquiries.length ?? 0) === 0 ? (
                    <View
                      style={[
                        styles.emptyCard,
                        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                      ]}>
                      <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
                        Aucune demande client reçue sur vos biens pour le moment.
                      </Text>
                    </View>
                  ) : (
                    dashboard?.inquiries.map((inq) => {
                      const st = getStatusDisplay(inq.status);
                      return (
                        <View
                          key={`ag-inq-${inq.id}`}
                          style={[
                            styles.listCard,
                            { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                          ]}>
                          <View style={styles.cardHeader}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.cardTitle, { color: theme.text }]}>
                                {getInquiryTypeLabel(inq.type)} — {inq.prenom} {inq.nom}
                              </Text>
                              <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                                📞 {inq.telephone} • ✉️ {inq.email}
                              </Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                              <Text style={{ color: st.text, fontSize: 11, fontWeight: '800' }}>
                                {st.label}
                              </Text>
                            </View>
                          </View>

                          {inq.propriete ? (
                            <Pressable
                              onPress={() => router.push(`/property/${inq.propriete!.id}` as any)}
                              style={[styles.propStrip, { backgroundColor: theme.backgroundElement }]}>
                              <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>
                                Bien #{inq.propriete.id} • {inq.propriete.type.toUpperCase()} —{' '}
                                {inq.propriete.commune} ({formatFcfa(inq.propriete.prix)})
                              </Text>
                            </Pressable>
                          ) : null}

                          {inq.scheduled_date ? (
                            <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '700' }}>
                              📅 Souhaité le {new Date(inq.scheduled_date).toLocaleString('fr-FR')}
                              {inq.meeting_mode ? ` (${inq.meeting_mode.replace('_', ' ')})` : ''}
                            </Text>
                          ) : null}

                          {inq.message ? (
                            <Text style={{ color: theme.text, fontSize: 13, lineHeight: 19 }}>
                              « {inq.message} »
                            </Text>
                          ) : null}

                          <View style={styles.statusActionsRow}>
                            {(
                              [
                                { key: 'en_cours', label: 'En cours' },
                                { key: 'confirme', label: 'Confirmer' },
                                { key: 'traite', label: 'Clôturer / Traité' },
                                { key: 'annule', label: 'Annuler' },
                              ] as const
                            ).map((act) => (
                              <Pressable
                                key={act.key}
                                onPress={() => handleUpdateInquiryStatus(inq, act.key)}
                                style={[
                                  styles.statusActionChip,
                                  {
                                    backgroundColor:
                                      inq.status === act.key ? theme.primary : theme.backgroundElement,
                                  },
                                ]}>
                                <Text
                                  style={{
                                    color: inq.status === act.key ? '#FFFFFF' : theme.text,
                                    fontSize: 11,
                                    fontWeight: '700',
                                  }}>
                                  {act.label}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      );
                    })
                  )}

                  {/* Visites physiques officielles */}
                  <Text style={[styles.subHeading, { color: theme.text, marginTop: 8 }]}>
                    Visites physiques encadrées E-Mobilier ({dashboard?.visites.length ?? 0})
                  </Text>
                  {(dashboard?.visites.length ?? 0) === 0 ? (
                    <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                      Aucune visite physique payée programmée sur vos annonces.
                    </Text>
                  ) : (
                    dashboard?.visites.map((v) => {
                      const st = getStatusDisplay(v.status);
                      return (
                        <View
                          key={`ag-vis-${v.id}`}
                          style={[
                            styles.listCard,
                            { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                          ]}>
                          <View style={styles.cardHeader}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>
                              VIS-{String(v.id).padStart(5, '0')} •{' '}
                              {v.client ? `${v.client.prenom ?? ''} ${v.client.name ?? ''}`.trim() : 'Client'}
                            </Text>
                            <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                              <Text style={{ color: st.text, fontSize: 11, fontWeight: '800' }}>
                                {st.label}
                              </Text>
                            </View>
                          </View>
                          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                            📅 {new Date(v.scheduled_date).toLocaleString('fr-FR')} • 🔒 Coordonnées encadrées par E-Mobilier
                          </Text>
                        </View>
                      );
                    })
                  )}
                </View>
              )}

              {/* TAB 3: CLIENTS & PROSPECTS */}
              {activeTab === 'clients' && (
                <View style={{ gap: 12 }}>
                  {(dashboard?.clients.length ?? 0) === 0 ? (
                    <View
                      style={[
                        styles.emptyCard,
                        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                      ]}>
                      <Text style={[styles.emptyTitle, { color: theme.text }]}>
                        Aucun client / prospect enregistré
                      </Text>
                      <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center' }}>
                        Dès qu’un client vous contacte ou prend rendez-vous sur l’un de vos biens, sa
                        fiche apparaît automatiquement ici.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.cardsGrid}>
                      {dashboard?.clients.map((cl) => {
                        const st = getStatusDisplay(cl.dernier_statut);
                        return (
                          <View
                            key={cl.key}
                            style={[
                              styles.propCard,
                              {
                                backgroundColor: theme.cardBackground,
                                borderColor: theme.cardBorder,
                                width: isMobile ? '100%' : '48.8%',
                              },
                            ]}>
                            <View style={styles.cardHeader}>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.cardTitle, { color: theme.text }]}>
                                  {cl.prenom} {cl.nom}
                                </Text>
                                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                                  {cl.total_demandes} interaction{cl.total_demandes > 1 ? 's' : ''} •{' '}
                                  {getInquiryTypeLabel(cl.dernier_type)}
                                </Text>
                              </View>
                              <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                                <Text style={{ color: st.text, fontSize: 11, fontWeight: '800' }}>
                                  {st.label}
                                </Text>
                              </View>
                            </View>

                            <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>
                              📞 {cl.telephone}
                            </Text>
                            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                              ✉️ {cl.email}
                            </Text>

                            <View style={styles.actionBtns}>
                              <Pressable
                                onPress={() => Linking.openURL(`tel:${cl.telephone}`)}
                                style={[styles.smallBtn, { backgroundColor: theme.primaryLight }]}>
                                <Text style={{ color: theme.primaryDark, fontWeight: '800', fontSize: 12 }}>
                                  Appeler
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => Linking.openURL(`mailto:${cl.email}`)}
                                style={[styles.smallBtn, { backgroundColor: theme.backgroundElement }]}>
                                <Text style={{ color: theme.text, fontWeight: '800', fontSize: 12 }}>
                                  Envoyer un e-mail
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
