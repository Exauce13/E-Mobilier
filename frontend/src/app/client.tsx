import { router } from 'expo-router';
import {
  ArrowRight,
  Bell,
  Building2,
  Calendar,
  FileText,
  Heart,
  Home,
  Mail,
  Search,
  Sparkles,
  Target,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import {
  demandesRechercheApi,
  inquiriesApi,
  proprietesApi,
  visitesApi,
} from '@/services/api';
import { favoritesStorage } from '@/services/local-store';
import type {
  BackendProperty,
  DemandeRechercheItem,
  PropertyInquiryItem,
  VisiteBackendItem,
} from '@/types/api';
import { formatFcfa } from '@/types/property';
import { getInquiryTypeLabel, getStatusDisplay } from '@/utils/validation';

type ClientSectionTab = 'overview' | 'inquiries' | 'requests' | 'properties';

export default function ClientSpaceScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isMobile, contentMaxWidth, horizontalPadding } = useResponsive();
  const { user, isAuthenticated, openAuthModal, unreadNotificationsCount } = useAuth();

  const [activeTab, setActiveTab] = useState<ClientSectionTab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [myProperties, setMyProperties] = useState<BackendProperty[]>([]);
  const [myRequests, setMyRequests] = useState<DemandeRechercheItem[]>([]);
  const [myVisits, setMyVisits] = useState<VisiteBackendItem[]>([]);
  const [myInquiries, setMyInquiries] = useState<PropertyInquiryItem[]>([]);
  const [favoritesCount, setFavoritesCount] = useState(0);

  const loadClientData = useCallback(async () => {
    const favs = await favoritesStorage.getAll();
    setFavoritesCount(favs.size);

    if (!isAuthenticated) {
      setMyInquiries([]);
      setMyProperties([]);
      setMyRequests([]);
      setMyVisits([]);
      return;
    }

    const [propRes, reqRes, visRes, inqRes] = await Promise.all([
      proprietesApi.getMyProperties(1),
      demandesRechercheApi.getMyRequests({ page: 1 }),
      visitesApi.getMyVisits(undefined, 1),
      inquiriesApi.getMyInquiries({ page: 1 }),
    ]);

    if (propRes.success && propRes.data) {
      setMyProperties(propRes.data.data || []);
    }
    if (reqRes.success && reqRes.data) {
      setMyRequests(reqRes.data.data || []);
    }
    if (visRes.success && visRes.data) {
      setMyVisits(visRes.data.data || []);
    }
    if (inqRes.success && inqRes.data?.data) {
      setMyInquiries(inqRes.data.data);
    } else {
      setMyInquiries([]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      await loadClientData();
      if (active) setLoading(false);
    };
    void run();
    return () => {
      active = false;
    };
  }, [loadClientData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadClientData();
    setRefreshing(false);
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Espace Client"
        subtitle={
          isAuthenticated && user
            ? `Bienvenue, ${user.prenom || user.name}`
            : 'Gérez vos projets immobiliers au Bénin'
        }
        rightAction={
          <Pressable
            onPress={() => router.push('/client-form' as any)}
            style={[styles.headerCta, { backgroundColor: '#F59E0B' }]}>
            <Text style={styles.headerCtaText}>+ Formulaire</Text>
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
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: insets.bottom + 36,
          },
        ]}>
        <View style={[styles.innerWrap, { maxWidth: contentMaxWidth }]}>
          {/* Hero / Identity Welcome Banner */}
          <View style={[styles.heroCard, { backgroundColor: theme.navy }]}>
            <View style={styles.heroTopRow}>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={13} color="#FDE68A" strokeWidth={2.2} />
                  <Text style={styles.heroEyebrow}>MON ESPACE CLIENT & PROPRIÉTAIRE</Text>
                </View>
                <Text style={styles.heroTitle}>
                  {isAuthenticated && user ? user.name : 'Pilotez votre projet immobilier'}
                </Text>
                <Text style={styles.heroSub}>
                  {isAuthenticated && user
                    ? `${user.phone}${user.email ? ` • ${user.email}` : ''}`
                    : 'Connectez-vous pour synchroniser vos recherches, visites, annonces et rendez-vous.'}
                </Text>
              </View>
              {!isAuthenticated ? (
                <View style={styles.authBtnsRow}>
                  <Pressable
                    onPress={() => openAuthModal('login')}
                    style={[styles.heroBtn, { backgroundColor: theme.primary }]}>
                    <Text style={styles.heroBtnText}>Se connecter</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => openAuthModal('register')}
                    style={[styles.heroBtn, { backgroundColor: '#F59E0B' }]}>
                    <Text style={[styles.heroBtnText, { color: '#0F172A' }]}>S'inscrire</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => router.push('/notifications' as any)}
                  style={[styles.notifChip, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                  <Bell size={14} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.notifChipText}>
                    {unreadNotificationsCount} alerte{unreadNotificationsCount > 1 ? 's' : ''}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Quick Action Tiles */}
            <View style={styles.quickGrid}>
              {[
                {
                  Icon: Search,
                  label: 'Rechercher une maison',
                  route: '/explore',
                  accent: theme.primary,
                },
                {
                  Icon: FileText,
                  label: 'Formulaire Client',
                  route: '/client-form',
                  accent: '#F59E0B',
                },
                {
                  Icon: Home,
                  label: 'Publier un bien (Client)',
                  route: '/publish-client',
                  accent: '#0284C7',
                },
                {
                  Icon: Calendar,
                  label: 'Mes Visites & RDV',
                  route: '/visits',
                  accent: '#7C3AED',
                },
              ].map((action) => (
                <Pressable
                  key={action.label}
                  onPress={() => router.push(action.route as any)}
                  style={[
                    styles.quickTile,
                    { width: isMobile ? '48%' : '23.5%' },
                  ]}>
                  <View style={[styles.quickIconDot, { backgroundColor: action.accent }]}>
                    <action.Icon size={17} color="#FFFFFF" strokeWidth={2.2} />
                  </View>
                  <Text style={styles.quickTileLabel}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* KPI Summary Cards */}
          <View style={styles.kpiGrid}>
            {[
              { label: 'Mes annonces', value: myProperties.length, Icon: Building2 },
              { label: 'Visites programmées', value: myVisits.length, Icon: Calendar },
              { label: 'Recherches actives', value: myRequests.length, Icon: Target },
              { label: 'Demandes & Contacts', value: myInquiries.length, Icon: Mail },
              { label: 'Biens favoris', value: favoritesCount, Icon: Heart },
            ].map((kpi) => (
              <View
                key={kpi.label}
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.cardBorder,
                    width: isMobile ? '47.5%' : '18.5%',
                  },
                ]}>
                <kpi.Icon size={18} color={theme.primary} strokeWidth={2.2} />
                <Text style={[styles.kpiValue, { color: theme.primary }]}>{kpi.value}</Text>
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>{kpi.label}</Text>
              </View>
            ))}
          </View>

          {/* Navigation Tabs inside Client Space */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsBar}>
            {(
              [
                { key: 'overview', label: 'Vue d’ensemble' },
                { key: 'inquiries', label: `Demandes & RDV (${myInquiries.length + myVisits.length})` },
                { key: 'requests', label: `Recherches (${myRequests.length})` },
                { key: 'properties', label: `Mes biens (${myProperties.length})` },
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
                      fontWeight: '700',
                    }}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {loading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 32 }} />
          ) : (
            <>
              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <View style={[styles.twoColGrid, isMobile && styles.oneColGrid]}>
                  {/* Recent Inquiries & Visits */}
                  <View
                    style={[
                      styles.panelCard,
                      { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                    ]}>
                    <View style={styles.panelHeader}>
                      <Text style={[styles.panelTitle, { color: theme.text }]}>
                        Dernières visites & contacts
                      </Text>
                      <Pressable onPress={() => setActiveTab('inquiries')}>
                        <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '800' }}>
                          Tout voir
                        </Text>
                      </Pressable>
                    </View>

                    {myInquiries.length === 0 && myVisits.length === 0 ? (
                      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                        Aucune visite ni prise de contact enregistrée pour l’instant. Parcourez le catalogue
                        pour réserver une visite ou contacter un agent.
                      </Text>
                    ) : (
                      <View style={{ gap: 10 }}>
                        {myInquiries.slice(0, 3).map((inq) => {
                          const st = getStatusDisplay(inq.status);
                          return (
                            <View
                              key={`ov-inq-${inq.id}`}
                              style={[styles.itemRow, { backgroundColor: theme.backgroundElement }]}>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.itemTitle, { color: theme.text }]}>
                                  {getInquiryTypeLabel(inq.type)}
                                </Text>
                                <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                                  {inq.sujet || inq.commune || 'Demande E-Mobilier'}
                                </Text>
                              </View>
                              <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                                <Text style={{ color: st.text, fontSize: 11, fontWeight: '800' }}>
                                  {st.label}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                        {myVisits.slice(0, 2).map((v) => {
                          const st = getStatusDisplay(v.status);
                          return (
                            <View
                              key={`ov-vis-${v.id}`}
                              style={[styles.itemRow, { backgroundColor: theme.backgroundElement }]}>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.itemTitle, { color: theme.text }]}>
                                  Visite #{v.id} — {v.propriete?.commune || 'Bien'}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                                  <Calendar size={12} color={theme.textSecondary} strokeWidth={2} />
                                  <Text style={[styles.itemSub, { color: theme.textSecondary, marginTop: 0 }]}>
                                    {new Date(v.scheduled_date).toLocaleString('fr-FR')}
                                  </Text>
                                </View>
                              </View>
                              <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                                <Text style={{ color: st.text, fontSize: 11, fontWeight: '800' }}>
                                  {st.label}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  {/* Services & Shortcuts */}
                  <View
                    style={[
                      styles.panelCard,
                      { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                    ]}>
                    <Text style={[styles.panelTitle, { color: theme.text }]}>
                      Services & Outils Client
                    </Text>
                    <View style={{ gap: 8 }}>
                      {[
                        {
                          title: 'Déposer une demande de recherche',
                          sub: 'Décrivez le bien idéal et recevez nos propositions ciblées',
                          route: '/search-requests',
                        },
                        {
                          title: 'Remplir le formulaire client complet',
                          sub: 'Bénéficiez d’un accompagnement personnalisé par nos conseillers',
                          route: '/client-form',
                        },
                        {
                          title: 'Gérer mes annonces publiées',
                          sub: 'Modifier le prix, suivre la modération ou retirer un bien',
                          route: '/my-properties',
                        },
                        {
                          title: 'Quittances & Paiements Kkiapay',
                          sub: 'Consultez vos justificatifs de paiement officiels',
                          route: '/transactions',
                        },
                      ].map((srv) => (
                        <Pressable
                          key={srv.title}
                          onPress={() => router.push(srv.route as any)}
                          style={[styles.shortcutRow, { borderColor: theme.cardBorder }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.itemTitle, { color: theme.text }]}>{srv.title}</Text>
                            <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                              {srv.sub}
                            </Text>
                          </View>
                          <ArrowRight size={16} color={theme.primary} strokeWidth={2.4} />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {/* INQUIRIES & VISITS TAB */}
              {activeTab === 'inquiries' && (
                <View style={{ gap: 12 }}>
                  {myInquiries.length === 0 && myVisits.length === 0 ? (
                    <View
                      style={[
                        styles.emptyCard,
                        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                      ]}>
                      <Text style={[styles.emptyTitle, { color: theme.text }]}>
                        Aucune demande ni visite enregistrée
                      </Text>
                      <Pressable
                        onPress={() => router.push('/explore' as any)}
                        style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
                        <Text style={styles.primaryBtnText}>Explorer le catalogue</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      {myInquiries.map((inq) => {
                        const st = getStatusDisplay(inq.status);
                        return (
                          <View
                            key={`inq-${inq.id}`}
                            style={[
                              styles.detailCard,
                              { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                            ]}>
                            <View style={styles.panelHeader}>
                              <Text style={[styles.itemTitle, { color: theme.text }]}>
                                {getInquiryTypeLabel(inq.type)}
                              </Text>
                              <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                                <Text style={{ color: st.text, fontSize: 11, fontWeight: '800' }}>
                                  {st.label}
                                </Text>
                              </View>
                            </View>
                            <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                              Demandeur : {inq.prenom} {inq.nom} • {inq.telephone} • {inq.email}
                            </Text>
                            {inq.scheduled_date ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <Calendar size={13} color={theme.primary} strokeWidth={2.2} />
                                <Text style={[styles.itemSub, { color: theme.primary, marginTop: 0 }]}>
                                  Créneau : {new Date(inq.scheduled_date).toLocaleString('fr-FR')}
                                </Text>
                              </View>
                            ) : null}
                            {inq.message ? (
                              <Text style={{ color: theme.text, fontSize: 13 }}>{inq.message}</Text>
                            ) : null}
                          </View>
                        );
                      })}
                      {myVisits.map((v) => {
                        const st = getStatusDisplay(v.status);
                        return (
                          <Pressable
                            key={`vis-${v.id}`}
                            onPress={() => v.propriete && router.push(`/property/${v.propriete.id}` as any)}
                            style={[
                              styles.detailCard,
                              { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                            ]}>
                            <View style={styles.panelHeader}>
                              <Text style={[styles.itemTitle, { color: theme.text }]}>
                                Visite terrain VIS-{String(v.id).padStart(5, '0')}
                              </Text>
                              <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                                <Text style={{ color: st.text, fontSize: 11, fontWeight: '800' }}>
                                  {st.label}
                                </Text>
                              </View>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <Calendar size={13} color={theme.textSecondary} strokeWidth={2} />
                              <Text style={[styles.itemSub, { color: theme.textSecondary, marginTop: 0, flex: 1 }]}>
                                {new Date(v.scheduled_date).toLocaleString('fr-FR')} •{' '}
                                {v.propriete ? `${v.propriete.commune} (${formatFcfa(v.propriete.prix)})` : ''}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </>
                  )}
                </View>
              )}

              {/* SEARCH REQUESTS TAB */}
              {activeTab === 'requests' && (
                <View style={{ gap: 12 }}>
                  <View style={styles.panelHeader}>
                    <Text style={[styles.panelTitle, { color: theme.text }]}>
                      Mes demandes de recherche
                    </Text>
                    <Pressable
                      onPress={() => router.push('/search-requests' as any)}
                      style={[styles.smallBtn, { backgroundColor: theme.primary }]}>
                      <Text style={styles.smallBtnText}>+ Gérer / Créer</Text>
                    </Pressable>
                  </View>
                  {myRequests.length === 0 ? (
                    <View
                      style={[
                        styles.emptyCard,
                        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                      ]}>
                      <Text style={[styles.emptyTitle, { color: theme.text }]}>
                        Aucune recherche personnalisée
                      </Text>
                      <Pressable
                        onPress={() => router.push('/search-requests' as any)}
                        style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
                        <Text style={styles.primaryBtnText}>Créer une demande de recherche</Text>
                      </Pressable>
                    </View>
                  ) : (
                    myRequests.map((req) => {
                      const st = getStatusDisplay(req.status);
                      return (
                        <View
                          key={`req-${req.id}`}
                          style={[
                            styles.detailCard,
                            { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                          ]}>
                          <View style={styles.panelHeader}>
                            <Text style={[styles.itemTitle, { color: theme.text }]}>
                              {req.property_type.toUpperCase()} ({req.transaction_type}) — {req.target_commune}
                            </Text>
                            <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                              <Text style={{ color: st.text, fontSize: 11, fontWeight: '800' }}>
                                {st.label}
                              </Text>
                            </View>
                          </View>
                          <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 14 }}>
                            Budget max : {formatFcfa(req.budget_max)}
                          </Text>
                          {req.criteria_details ? (
                            <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                              {req.criteria_details}
                            </Text>
                          ) : null}
                        </View>
                      );
                    })
                  )}
                </View>
              )}

              {/* MY PROPERTIES TAB */}
              {activeTab === 'properties' && (
                <View style={{ gap: 12 }}>
                  <View style={styles.panelHeader}>
                    <Text style={[styles.panelTitle, { color: theme.text }]}>Mes biens publiés</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable
                        onPress={() => router.push('/my-properties' as any)}
                        style={[styles.smallBtn, { backgroundColor: theme.navy }]}>
                        <Text style={styles.smallBtnText}>Gérer tout</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => router.push('/publish-client' as any)}
                        style={[styles.smallBtn, { backgroundColor: theme.primary }]}>
                        <Text style={styles.smallBtnText}>+ Publier</Text>
                      </Pressable>
                    </View>
                  </View>

                  {myProperties.length === 0 ? (
                    <View
                      style={[
                        styles.emptyCard,
                        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                      ]}>
                      <Text style={[styles.emptyTitle, { color: theme.text }]}>
                        Vous n’avez encore publié aucun bien
                      </Text>
                      <Pressable
                        onPress={() => router.push('/publish-client' as any)}
                        style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
                        <Text style={styles.primaryBtnText}>Publier une annonce Client</Text>
                      </Pressable>
                    </View>
                  ) : (
                    myProperties.map((prop) => {
                      const st = getStatusDisplay(prop.status);
                      return (
                        <Pressable
                          key={`prop-${prop.id}`}
                          onPress={() => router.push(`/property/${prop.id}` as any)}
                          style={[
                            styles.detailCard,
                            { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                          ]}>
                          <View style={styles.panelHeader}>
                            <Text style={[styles.itemTitle, { color: theme.text }]}>
                              #{prop.id} • {prop.type.toUpperCase()} ({prop.transaction_type})
                            </Text>
                            <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                              <Text style={{ color: st.text, fontSize: 11, fontWeight: '800' }}>
                                {st.label}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                            {[prop.quartier, prop.commune].filter(Boolean).join(', ')} • {prop.surface} m²
                          </Text>
                          <Text style={{ color: theme.primary, fontWeight: '900', fontSize: 15 }}>
                            {formatFcfa(prop.prix)}
                          </Text>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerCta: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9 },
  headerCtaText: { color: '#0F172A', fontSize: 12, fontWeight: '800' },
  scroll: { paddingTop: Spacing.three },
  innerWrap: { width: '100%', alignSelf: 'center', gap: 18 },
  heroCard: { borderRadius: 22, padding: 20, gap: 16 },
  heroTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  heroEyebrow: { color: '#FDE68A', fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  heroSub: { color: '#CBD5E1', fontSize: 13 },
  authBtnsRow: { flexDirection: 'row', gap: 8 },
  heroBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 11 },
  heroBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  notifChip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  notifChipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  quickTile: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  quickIconDot: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTileLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  kpiCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 4,
    alignItems: 'flex-start',
  },
  kpiValue: { fontSize: 24, fontWeight: '900' },
  kpiLabel: { fontSize: 12, fontWeight: '600' },

  tabsBar: { gap: 8 },
  tabBtn: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 1,
  },

  twoColGrid: { flexDirection: 'row', gap: 16 },
  oneColGrid: { flexDirection: 'column' },
  panelCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  panelTitle: { fontSize: 16, fontWeight: '900' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  itemTitle: { fontSize: 14, fontWeight: '800' },
  itemSub: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  detailCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyText: { fontSize: 13, lineHeight: 20 },
  primaryBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  smallBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});
