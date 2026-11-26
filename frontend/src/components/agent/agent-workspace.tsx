import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import {
  Bell,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Lock,
  LogOut,
  MapPin,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
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
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { usePlatformConfig } from '@/context/platform-config-context';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { authApi, getStorageBaseUrl, inquiriesApi, proprietesApi, visitesApi } from '@/services/api';
import type { AgentDashboardData, BackendProperty, VisiteBackendItem } from '@/types/api';
import { formatFcfa, resolveStorageUrl } from '@/types/property';
import { confirmDialog, showMessage } from '@/utils/dialog';
import { getStatusDisplay } from '@/utils/validation';

export type AgentWorkspaceSection = 'biens' | 'visites' | 'profil';

const PROPS_PER_PAGE = 8;

const VISIT_STATUS_TABS = [
  { key: 'tous', label: 'Toutes' },
  { key: 'pending', label: 'En attente' },
  { key: 'confirmed', label: 'Confirmées' },
  { key: 'completed', label: 'Terminées' },
  { key: 'cancelled', label: 'Annulées' },
] as const;

interface AgentWorkspaceProps {
  embeddedInTabs?: boolean;
  initialSection?: AgentWorkspaceSection;
}

export function AgentWorkspace({
  embeddedInTabs = false,
  initialSection = 'biens',
}: AgentWorkspaceProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    isSmallMobile,
    isMobile,
    isLargeDesktop,
    contentMaxWidth,
    horizontalPadding,
    getGridItemWidth,
  } = useResponsive();
  const {
    user,
    isAuthenticated,
    isAgentMobilier,
    isAdminStaff,
    openAuthModal,
    refreshProfile,
    logout,
  } = useAuth();
  const { tarifs } = usePlatformConfig();
  const storageBaseUrl = useMemo(() => getStorageBaseUrl(), []);

  const agentFeeLabel = tarifs ? formatFcfa(tarifs.post_agent) : 'tarif préférentiel';
  const clientFeeLabel = tarifs ? formatFcfa(tarifs.post_client) : 'tarif officiel';
  const visitFeeLabel = tarifs ? formatFcfa(tarifs.visite) : '500 F CFA';

  const [activeSection, setActiveSection] = useState<AgentWorkspaceSection>(initialSection);

  // Dashboard KPIs & visites reçues
  const [dashboard, setDashboard] = useState<AgentDashboardData | null>(null);
  const [loadingDash, setLoadingDash] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Section A : Mes biens immobiliers (pagination backend réelle via /api/mes-proprietes)
  const [myProps, setMyProps] = useState<BackendProperty[]>([]);
  const [propsPage, setPropsPage] = useState(1);
  const [propsLastPage, setPropsLastPage] = useState(1);
  const [propsTotal, setPropsTotal] = useState(0);
  const [propsLoading, setPropsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('tous');
  const [searchProp, setSearchProp] = useState('');
  const [debouncedSearchProp, setDebouncedSearchProp] = useState('');

  // Quick edit property modal
  const [editingProp, setEditingProp] = useState<BackendProperty | null>(null);
  const [editCommune, setEditCommune] = useState('');
  const [editQuartier, setEditQuartier] = useState('');
  const [editSurface, setEditSurface] = useState('');
  const [editPrix, setEditPrix] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editLocationDetails, setEditLocationDetails] = useState('');
  const [editNegotiable, setEditNegotiable] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Section B : Mes visites (reçues sur mes biens + mes visites demandées)
  const [visitSubTab, setVisitSubTab] = useState<'recues' | 'demandees'>('recues');
  const [myRequestedVisits, setMyRequestedVisits] = useState<VisiteBackendItem[]>([]);
  const [visitStatusFilter, setVisitStatusFilter] = useState<string>('tous');
  const [loadingMyVisits, setLoadingMyVisits] = useState(false);

  // Section C : Mon profil intégré
  const [profilePrenom, setProfilePrenom] = useState(user?.prenom || '');
  const [profileNom, setProfileNom] = useState(user?.nom || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchProp(searchProp.trim()), 300);
    return () => clearTimeout(t);
  }, [searchProp]);

  useEffect(() => {
    if (user) {
      setProfilePrenom(user.prenom || '');
      setProfileNom(user.nom || '');
    }
  }, [user]);

  const canAccess = isAuthenticated && (isAgentMobilier || isAdminStaff);

  const loadDashboard = useCallback(async () => {
    setLoadError(null);
    if (!canAccess) {
      setDashboard(null);
      return;
    }
    const res = await inquiriesApi.getAgentDashboard();
    if (res.success && res.data) {
      setDashboard(res.data);
    } else {
      setDashboard(null);
      setLoadError(res.message || "Impossible de charger l'Espace Agent.");
    }
  }, [canAccess]);

  const loadMyProperties = useCallback(
    async (targetPage = 1) => {
      if (!canAccess) {
        setMyProps([]);
        setPropsTotal(0);
        setPropsLastPage(1);
        return;
      }
      setPropsLoading(true);
      try {
        const res = await proprietesApi.getMyProperties(targetPage, {
          status: statusFilter === 'tous' ? undefined : statusFilter,
          search: debouncedSearchProp || undefined,
          per_page: PROPS_PER_PAGE,
        });
        if (res.success && res.data) {
          setMyProps(res.data.data || []);
          setPropsPage(res.data.current_page || targetPage);
          setPropsLastPage(res.data.last_page || 1);
          setPropsTotal(res.data.total ?? (res.data.data?.length || 0));
        } else {
          setLoadError(res.message || 'Impossible de charger vos biens immobiliers.');
        }
      } finally {
        setPropsLoading(false);
      }
    },
    [canAccess, statusFilter, debouncedSearchProp]
  );

  const loadRequestedVisits = useCallback(async () => {
    if (!canAccess) {
      setMyRequestedVisits([]);
      return;
    }
    setLoadingMyVisits(true);
    try {
      const res = await visitesApi.getMyVisits(
        visitStatusFilter === 'tous' ? undefined : visitStatusFilter
      );
      if (res.success && res.data) {
        // Filtrer uniquement les visites demandées par cet agent (client_id === user.id)
        const all = res.data.data || [];
        const own = user ? all.filter((v) => String(v.client_id) === String(user.id)) : all;
        setMyRequestedVisits(own);
      }
    } finally {
      setLoadingMyVisits(false);
    }
  }, [canAccess, visitStatusFilter, user]);

  useEffect(() => {
    let active = true;
    const init = async () => {
      setLoadingDash(true);
      await loadDashboard();
      if (active) setLoadingDash(false);
    };
    void init();
    return () => {
      active = false;
    };
  }, [loadDashboard]);

  useEffect(() => {
    void loadMyProperties(1);
  }, [loadMyProperties]);

  useEffect(() => {
    if (activeSection === 'visites' && visitSubTab === 'demandees') {
      void loadRequestedVisits();
    }
  }, [activeSection, visitSubTab, loadRequestedVisits]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadDashboard(),
      loadMyProperties(propsPage),
      activeSection === 'visites' ? loadRequestedVisits() : Promise.resolve(),
      refreshProfile(),
    ]);
    setRefreshing(false);
  };

  // Actions biens immobiliers
  const openEditModal = (prop: BackendProperty) => {
    setEditingProp(prop);
    setEditCommune(prop.commune || '');
    setEditQuartier(prop.quartier || '');
    setEditSurface(prop.surface ? String(prop.surface) : '');
    setEditPrix(String(prop.prix ?? ''));
    setEditDesc(prop.description || '');
    setEditLocationDetails(prop.location_details || '');
    setEditNegotiable(Boolean(prop.is_negotiable));
  };

  const handleSavePropertyEdit = async () => {
    if (!editingProp) return;
    if (editCommune.trim().length < 2) {
      setFeedback({ text: 'La commune doit contenir au moins 2 caractères.', type: 'error' });
      return;
    }
    const numericPrice = Number(editPrix.replace(/\s+/g, ''));
    if (Number.isNaN(numericPrice) || numericPrice <= 0) {
      setFeedback({ text: 'Veuillez saisir un prix valide en F CFA.', type: 'error' });
      return;
    }
    const isChambreLocation =
      editingProp.type === 'chambre' && editingProp.transaction_type === 'location';
    const numericSurface = editSurface.trim()
      ? Number(editSurface.replace(/\s+/g, ''))
      : undefined;
    if (!isChambreLocation && numericSurface !== undefined && (Number.isNaN(numericSurface) || numericSurface < 1)) {
      setFeedback({ text: 'Veuillez saisir une superficie valide en m².', type: 'error' });
      return;
    }

    setSavingEdit(true);
    const res = await proprietesApi.update(editingProp.id, {
      commune: editCommune.trim(),
      ...(editQuartier.trim() ? { quartier: editQuartier.trim() } : {}),
      ...(!isChambreLocation && numericSurface ? { surface: numericSurface } : {}),
      prix: numericPrice,
      description: editDesc.trim(),
      location_details: editLocationDetails.trim(),
      is_negotiable: editNegotiable,
    });
    setSavingEdit(false);

    if (res.success) {
      setEditingProp(null);
      setFeedback({ text: `Bien #${editingProp.id} mis à jour avec succès.`, type: 'success' });
      await Promise.all([loadMyProperties(propsPage), loadDashboard()]);
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
      await Promise.all([loadMyProperties(1), loadDashboard()]);
    } else {
      setFeedback({ text: res.message || 'Suppression refusée.', type: 'error' });
    }
  };

  const handleCancelRequestedVisit = async (visitId: number) => {
    const ok = await confirmDialog(
      'Annuler cette visite ?',
      'Cette action marquera votre demande de visite comme annulée.',
      'Oui, annuler',
      'Non'
    );
    if (!ok) return;
    const res = await visitesApi.cancelVisit(visitId);
    if (res.success) {
      showMessage('Visite annulée', 'Votre demande de visite a bien été annulée.');
      await loadRequestedVisits();
    } else {
      showMessage('Erreur', res.message || "Impossible d'annuler cette visite.");
    }
  };

  // Actions profil intégré
  const handleSaveProfile = async () => {
    if (profileNom.trim().length < 2 || profilePrenom.trim().length < 2) {
      showMessage('Validation', 'Le nom et le prénom doivent contenir au moins 2 caractères.');
      return;
    }
    setSavingProfile(true);
    const res = await authApi.updateProfil({
      name: profileNom.trim(),
      prenom: profilePrenom.trim(),
    });
    setSavingProfile(false);
    if (res.success) {
      await refreshProfile();
      showMessage('Profil mis à jour', res.message || 'Vos informations ont été enregistrées.');
    } else {
      showMessage('Erreur', res.message || 'Impossible de mettre à jour votre profil.');
    }
  };

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      const fileName = asset.fileName || `avatar_${Date.now()}.jpg`;
      const mimeType = asset.mimeType || 'image/jpeg';

      if (Platform.OS === 'web') {
        const resp = await fetch(asset.uri);
        const blob = await resp.blob();
        formData.append('photo', blob, fileName);
      } else {
        formData.append('photo', {
          uri: asset.uri,
          name: fileName,
          type: mimeType,
        } as any);
      }

      const res = await authApi.uploadPhotoProfil(formData);
      if (res.success) {
        await refreshProfile();
        showMessage('Photo mise à jour', res.message || 'Votre photo de profil a été enregistrée.');
      } else {
        showMessage('Erreur', res.message || "Impossible d'envoyer cette image.");
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async () => {
    const ok = await confirmDialog(
      'Supprimer la photo ?',
      'Voulez-vous retirer votre photo de profil actuelle ?',
      'Supprimer'
    );
    if (!ok) return;
    setUploadingPhoto(true);
    const res = await authApi.deletePhotoProfil();
    setUploadingPhoto(false);
    if (res.success) {
      await refreshProfile();
      showMessage('Photo supprimée', res.message || 'Photo de profil retirée.');
    } else {
      showMessage('Erreur', res.message || 'Impossible de supprimer la photo.');
    }
  };

  // Garde de rôle : Clients bloqués
  if (isAuthenticated && !isAgentMobilier && !isAdminStaff) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
        {!embeddedInTabs && <ScreenHeader title="Espace Agent" subtitle="Accès réservé" />}
        <View style={styles.centerGate}>
          <Lock size={34} color={theme.primary} strokeWidth={2.2} />
          <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, textAlign: 'center' }}>
            Espace strictement réservé aux agents immobiliers agréés
          </Text>
          <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: 'center', maxWidth: 420 }}>
            En tant que client, gérez vos annonces depuis « Mes annonces » et vos visites depuis « Mes visites ».
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

  // Non connecté
  if (!isAuthenticated) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
        {!embeddedInTabs && (
          <ScreenHeader title="Espace Agent" subtitle="Gestion professionnelle" />
        )}
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
                Centralisez vos biens immobiliers, suivez vos visites encadrées et gérez votre profil
                professionnel depuis votre Espace Agent (tarif publication {agentFeeLabel}).
              </Text>
              <View style={styles.heroActions}>
                <Pressable
                  onPress={() => openAuthModal('login')}
                  style={[styles.goldBtn, { backgroundColor: '#F59E0B' }]}>
                  <Text style={styles.goldBtnText}>Connexion Agent</Text>
                </Pressable>
                <Pressable onPress={() => openAuthModal('register')} style={styles.outlineWhiteBtn}>
                  <Text style={styles.outlineWhiteBtnText}>Devenir Agent Immobilier</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.benefitsGrid}>
              {[
                { Icon: Tag, title: `Tarif Agent ${agentFeeLabel}`, desc: 'Publication dédiée avec suivi de modération en temps réel.' },
                { Icon: Calendar, title: 'Visites centralisées', desc: 'Suivez les visites programmées sur vos biens par E-Mobilier.' },
                { Icon: ShieldCheck, title: 'Profil & KYC', desc: 'Gérez votre identité professionnelle et votre statut agréé.' },
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
  const initials = (user?.name || 'AG')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      {!embeddedInTabs ? (
        <ScreenHeader
          title="Espace Agent"
          subtitle={user?.name || 'Agent Immobilier'}
          rightAction={
            <Pressable
              onPress={() => router.push('/publish-agent' as any)}
              style={[styles.headerBtn, { backgroundColor: '#F59E0B' }]}>
              <Text style={styles.headerBtnText}>+ Publier</Text>
            </Pressable>
          }
        />
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
        contentContainerStyle={[
          styles.scroll,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: (embeddedInTabs ? BottomTabInset : 0) + insets.bottom + 80,
          },
        ]}>
        <View style={[styles.innerWrap, { maxWidth: contentMaxWidth }]}>
          {/* Top Agent Identity Banner */}
          <View style={[styles.heroCard, { backgroundColor: theme.navy }]}>
            <View style={styles.heroTopRow}>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.badgeRow}>
                  <View style={[styles.goldPill, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
                    <Briefcase size={12} color="#FDE68A" strokeWidth={2.4} />
                    <Text style={styles.goldPillText}>ESPACE AGENT IMMOBILIER</Text>
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
                  onPress={() => router.push('/' as any)}
                  style={styles.outlineWhiteBtn}>
                  <Text style={styles.outlineWhiteBtnText}>Feed public</Text>
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
              <Pressable onPress={() => void handleRefresh()}>
                <Text style={{ color: '#B91C1C', fontSize: 12, fontWeight: '800' }}>Réessayer</Text>
              </Pressable>
            </View>
          ) : null}

          {/* KPI Strip */}
          <View style={styles.kpiGrid}>
            {[
              {
                label: 'Mes biens',
                value: kpis?.total_biens ?? propsTotal,
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
                    width: getGridItemWidth(isMobile ? 2 : 4, 10),
                  },
                ]}>
                <item.Icon size={20} color={theme.primary} strokeWidth={2.2} />
                <Text style={[styles.kpiValue, { color: theme.primary }]}>{item.value}</Text>
                <Text style={[styles.kpiLabel, { color: theme.text }]}>{item.label}</Text>
                <Text style={[styles.kpiSub, { color: theme.textSecondary }]}>{item.sub}</Text>
              </View>
            ))}
          </View>

          {/* 3 Centralized Internal Sections: Mes biens immobiliers | Mes visites | Mon profil */}
          <View style={styles.tabsRow}>
            {(
              [
                { key: 'biens', label: `Mes biens immobiliers (${kpis?.total_biens ?? propsTotal})`, Icon: Building2 },
                { key: 'visites', label: `Mes visites (${dashboard?.visites.length ?? 0})`, Icon: Calendar },
                { key: 'profil', label: 'Mon profil', Icon: User },
              ] as const
            ).map((tab) => {
              const active = activeSection === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveSection(tab.key)}
                  style={[
                    styles.tabBtn,
                    {
                      backgroundColor: active ? theme.primary : theme.cardBackground,
                      borderColor: active ? theme.primary : theme.cardBorder,
                    },
                  ]}>
                  <tab.Icon size={15} color={active ? '#FFFFFF' : theme.primary} strokeWidth={2.2} />
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

          {/* =============================================================== */}
          {/* SECTION A : MES BIENS IMMOBILIERS (Pagination backend réelle)   */}
          {/* =============================================================== */}
          {activeSection === 'biens' && (
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
                  placeholder="Rechercher dans mes biens (commune, quartier, type...)"
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

              {propsLoading ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 32 }} />
              ) : myProps.length === 0 ? (
                <View
                  style={[
                    styles.emptyCard,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}>
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>
                    Aucun bien immobilier trouvé
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center' }}>
                    {statusFilter !== 'tous' || debouncedSearchProp
                      ? 'Aucun de vos biens ne correspond à ce filtre.'
                      : "Vous n'avez pas encore publié de bien immobilier."}
                  </Text>
                  <Pressable
                    onPress={() => router.push('/publish-agent' as any)}
                    style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
                    <Text style={styles.primaryBtnText}>+ Publier un bien immobilier</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={styles.cardsGrid}>
                    {myProps.map((prop) => {
                      const st = getStatusDisplay(prop.status);
                      const coverMedia = prop.media?.find((m) => m.media_type !== 'video');
                      const coverUri = resolveStorageUrl(coverMedia?.media_url, storageBaseUrl);
                      return (
                        <View
                          key={prop.id}
                            style={[
                              styles.propCard,
                              {
                                backgroundColor: theme.cardBackground,
                                borderColor: theme.cardBorder,
                                width: getGridItemWidth(isLargeDesktop ? 3 : isMobile ? 1 : 2, 12),
                              },
                            ]}>
                          {coverUri ? (
                            <Image source={{ uri: coverUri }} style={styles.propThumb} contentFit="cover" />
                          ) : null}

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
                            {prop.surface && Number(prop.surface) > 0 ? `${prop.surface} m²` : 'Superficie non requise'}
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
                                Voir détails
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
                              onPress={() => void handleDeleteProperty(prop)}
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

                  {/* Pagination backend réelle pour Mes biens */}
                  {propsLastPage > 1 && (
                    <View
                      style={[
                        styles.paginationBar,
                        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                      ]}>
                      <Pressable
                        onPress={() => void loadMyProperties(propsPage - 1)}
                        disabled={propsPage <= 1 || propsLoading}
                        style={[
                          styles.pageBtn,
                          { borderColor: theme.cardBorder, opacity: propsPage <= 1 ? 0.45 : 1 },
                        ]}>
                        <ChevronLeft size={15} color={theme.text} strokeWidth={2.2} />
                        <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>Précédent</Text>
                      </Pressable>
                      <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>
                        Page {propsPage} / {propsLastPage} ({propsTotal} biens)
                      </Text>
                      <Pressable
                        onPress={() => void loadMyProperties(propsPage + 1)}
                        disabled={propsPage >= propsLastPage || propsLoading}
                        style={[
                          styles.pageBtn,
                          { borderColor: theme.cardBorder, opacity: propsPage >= propsLastPage ? 0.45 : 1 },
                        ]}>
                        <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>Suivant</Text>
                        <ChevronRight size={15} color={theme.text} strokeWidth={2.2} />
                      </Pressable>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* =============================================================== */}
          {/* SECTION B : MES VISITES (Reçues sur mes biens + Demandées)      */}
          {/* =============================================================== */}
          {activeSection === 'visites' && (
            <View style={{ gap: 14 }}>
              <View style={[styles.subSwitch, { backgroundColor: theme.backgroundElement }]}>
                <Pressable
                  onPress={() => setVisitSubTab('recues')}
                  style={[
                    styles.subSwitchBtn,
                    visitSubTab === 'recues' && { backgroundColor: theme.cardBackground },
                  ]}>
                  <Text
                    style={{
                      color: visitSubTab === 'recues' ? theme.primary : theme.textSecondary,
                      fontWeight: '800',
                      fontSize: 13,
                    }}>
                    Visites sur mes biens ({dashboard?.visites.length ?? 0})
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setVisitSubTab('demandees')}
                  style={[
                    styles.subSwitchBtn,
                    visitSubTab === 'demandees' && { backgroundColor: theme.cardBackground },
                  ]}>
                  <Text
                    style={{
                      color: visitSubTab === 'demandees' ? theme.primary : theme.textSecondary,
                      fontWeight: '800',
                      fontSize: 13,
                    }}>
                    Mes visites demandées ({myRequestedVisits.length})
                  </Text>
                </Pressable>
              </View>

              {visitSubTab === 'recues' ? (
                <>
                  <View
                    style={[
                      styles.infoNotice,
                      { backgroundColor: theme.primaryLight },
                    ]}>
                    <Lock size={15} color={theme.primary} strokeWidth={2.2} />
                    <Text style={{ color: theme.primaryDark, fontSize: 12, fontWeight: '700', flex: 1 }}>
                      Règle de monopole E-Mobilier : seuls le prénom et le nom du visiteur sont
                      affichés. La coordination complète est assurée par l'administration E-Mobilier.
                    </Text>
                  </View>

                  {loadingDash ? (
                    <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 24 }} />
                  ) : (dashboard?.visites.length ?? 0) === 0 ? (
                    <View
                      style={[
                        styles.emptyCard,
                        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                      ]}>
                      <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: 'center' }}>
                        Aucune demande de visite physique reçue sur vos annonces pour le moment.
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
                                <Pressable onPress={() => router.push(`/property/${v.propriete!.id}` as any)}>
                                  <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700' }}>
                                    Bien #{v.propriete.id} • {v.propriete.type.toUpperCase()} —{' '}
                                    {v.propriete.commune}
                                    {v.propriete.quartier ? ` (${v.propriete.quartier})` : ''}
                                  </Text>
                                </Pressable>
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
                                Coordonnées gérées par E-Mobilier
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })
                  )}
                </>
              ) : (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {VISIT_STATUS_TABS.map((t) => {
                      const active = visitStatusFilter === t.key;
                      return (
                        <Pressable
                          key={t.key}
                          onPress={() => setVisitStatusFilter(t.key)}
                          style={[
                            styles.filterPill,
                            {
                              backgroundColor: active ? theme.primary : theme.cardBackground,
                              borderColor: active ? theme.primary : theme.cardBorder,
                            },
                          ]}>
                          <Text style={{ color: active ? '#FFFFFF' : theme.text, fontSize: 12, fontWeight: '700' }}>
                            {t.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  {loadingMyVisits ? (
                    <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 24 }} />
                  ) : myRequestedVisits.length === 0 ? (
                    <View
                      style={[
                        styles.emptyCard,
                        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                      ]}>
                      <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: 'center' }}>
                        Aucune visite demandée par votre compte dans cette catégorie.
                      </Text>
                    </View>
                  ) : (
                    myRequestedVisits.map((v) => {
                      const st = getStatusDisplay(v.status);
                      return (
                        <View
                          key={`req-vis-${v.id}`}
                          style={[
                            styles.listCard,
                            { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                          ]}>
                          <View style={styles.cardHeader}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>
                              VIS-{String(v.id).padStart(5, '0')}
                              {v.propriete ? ` • ${v.propriete.type.toUpperCase()} — ${v.propriete.commune}` : ''}
                            </Text>
                            <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                              <Text style={{ color: st.text, fontSize: 11, fontWeight: '800' }}>{st.label}</Text>
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
                              <CheckCircle2 size={13} color="#059669" strokeWidth={2.2} />
                              <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700' }}>
                                {v.is_fee_paid ? `Frais ${visitFeeLabel} acquittés` : 'Paiement requis'}
                              </Text>
                            </View>
                          </View>
                          {v.compte_rendu ? (
                            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
                              <FileText size={13} color={theme.textSecondary} strokeWidth={2} style={{ marginTop: 2 }} />
                              <Text style={{ color: theme.textSecondary, fontSize: 12, flex: 1 }}>
                                Compte-rendu : {v.compte_rendu}
                              </Text>
                            </View>
                          ) : null}
                          {(v.status === 'pending' || v.status === 'confirmed') && (
                            <Pressable
                              onPress={() => void handleCancelRequestedVisit(v.id)}
                              style={[styles.cancelBtn, { borderColor: '#FCA5A5' }]}>
                              <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 12 }}>
                                Annuler cette visite
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      );
                    })
                  )}
                </>
              )}
            </View>
          )}

          {/* =============================================================== */}
          {/* SECTION C : MON PROFIL (Intégré, SANS Paiements & Reçus)        */}
          {/* =============================================================== */}
          {activeSection === 'profil' && (
            <View style={{ gap: 14, maxWidth: 680, width: '100%', alignSelf: 'center' }}>
              {/* Avatar & Pro Info */}
              <View style={[styles.profileCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <View style={styles.avatarRow}>
                  {user?.photo_url ? (
                    <Image source={{ uri: user.photo_url }} style={styles.avatarImg} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: theme.primary }]}>
                      <Text style={styles.avatarInitials}>{initials}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: theme.text }}>{user?.name}</Text>
                    <Text style={{ fontSize: 13, color: theme.textSecondary }}>{user?.phone}</Text>
                    {user?.email ? (
                      <Text style={{ fontSize: 12, color: theme.textSecondary }}>{user.email}</Text>
                    ) : null}
                    <Text style={{ fontSize: 12, color: theme.primary, fontWeight: '700' }}>
                      {user?.roles?.join(' • ') || 'Agent mobilier'} • {user?.is_verifed ? 'KYC Agréé' : 'KYC en vérification'}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  <Pressable
                    onPress={() => void handlePickPhoto()}
                    disabled={uploadingPhoto}
                    style={[styles.profileOutlineBtn, { borderColor: theme.primary, backgroundColor: theme.primaryLight }]}>
                    {uploadingPhoto ? (
                      <ActivityIndicator size="small" color={theme.primary} />
                    ) : (
                      <>
                        <Camera size={15} color={theme.primary} strokeWidth={2.2} />
                        <Text style={{ color: theme.primaryDark, fontWeight: '800', fontSize: 13 }}>
                          Changer la photo
                        </Text>
                      </>
                    )}
                  </Pressable>
                  {user?.photo_url ? (
                    <Pressable
                      onPress={() => void handleDeletePhoto()}
                      disabled={uploadingPhoto}
                      style={[styles.profileOutlineBtn, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
                      <Trash2 size={15} color="#DC2626" strokeWidth={2.2} />
                      <Text style={{ color: '#DC2626', fontWeight: '800', fontSize: 13 }}>Retirer</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {/* Personal Info Edit */}
              <View style={[styles.profileCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <Text style={[styles.subHeading, { color: theme.text }]}>
                  Informations personnelles et professionnelles
                </Text>

                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary }}>Prénom</Text>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
                    value={profilePrenom}
                    onChangeText={setProfilePrenom}
                    placeholder="Votre prénom"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary }}>Nom</Text>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
                    value={profileNom}
                    onChangeText={setProfileNom}
                    placeholder="Votre nom"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>

                <Pressable
                  onPress={() => void handleSaveProfile()}
                  disabled={savingProfile}
                  style={[styles.primaryBtn, { backgroundColor: theme.primary, opacity: savingProfile ? 0.65 : 1 }]}>
                  <Text style={styles.primaryBtnText}>
                    {savingProfile ? 'Enregistrement...' : 'Enregistrer mon profil'}
                  </Text>
                </Pressable>
              </View>

              {/* Shortcuts (NO Paiements & Reçus for Agent!) */}
              <View style={[styles.profileCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <Text style={[styles.subHeading, { color: theme.text }]}>Paramètres du compte</Text>

                <Pressable
                  onPress={() => router.push('/notifications' as any)}
                  style={[styles.linkRow, { borderBottomColor: theme.cardBorder }]}>
                  <Bell size={17} color={theme.primary} strokeWidth={2.2} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>
                    Notifications &amp; Alertes
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push('/cgu' as any)}
                  style={[styles.linkRow, { borderBottomColor: 'transparent' }]}>
                  <ShieldCheck size={17} color={theme.primary} strokeWidth={2.2} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>
                    Conditions Générales (CGU)
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => void logout()}
                style={[styles.logoutBtn, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
                <LogOut size={16} color="#DC2626" strokeWidth={2.2} />
                <Text style={{ color: '#DC2626', fontWeight: '800', fontSize: 14 }}>Se déconnecter</Text>
              </Pressable>
            </View>
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
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 10 }}>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement },
                ]}
                placeholder="Commune (saisie libre)"
                placeholderTextColor={theme.textSecondary}
                value={editCommune}
                onChangeText={setEditCommune}
              />
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement },
                ]}
                placeholder="Quartier"
                placeholderTextColor={theme.textSecondary}
                value={editQuartier}
                onChangeText={setEditQuartier}
              />
              {!(editingProp?.type === 'chambre' && editingProp?.transaction_type === 'location') && (
                <TextInput
                  style={[
                    styles.input,
                    { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement },
                  ]}
                  placeholder="Surface (m²)"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  value={editSurface}
                  onChangeText={setEditSurface}
                />
              )}
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
            </ScrollView>

            <Pressable
              onPress={() => void handleSavePropertyEdit()}
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
  centerGate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
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
    borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  outlineWhiteBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  benefitsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  benefitCard: {
    flex: 1,
    minWidth: 210,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  benefitTitle: { fontSize: 15, fontWeight: '800' },
  benefitDesc: { fontSize: 13, lineHeight: 19 },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
  },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 4 },
  kpiValue: { fontSize: 24, fontWeight: '900' },
  kpiLabel: { fontSize: 13, fontWeight: '800' },
  kpiSub: { fontSize: 11 },
  tabsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  toolbar: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  searchInput: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  filterPill: { paddingHorizontal: 12, paddingVertical: 9, minHeight: 38, borderRadius: 14, borderWidth: 1, justifyContent: 'center' },
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  propCard: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 7 },
  propThumb: { width: '100%', aspectRatio: 16 / 10, minHeight: 135, borderRadius: 12, marginBottom: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '800', flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  rejectBox: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8 },
  rejectText: { color: '#B91C1C', fontSize: 12, fontWeight: '600' },
  actionBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  smallBtn: { flex: 1, minWidth: 74, minHeight: 40, paddingVertical: 9, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  paginationBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
  },
  subSwitch: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  subSwitchBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  infoNotice: { borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  listCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  cancelBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center', marginTop: 4 },
  emptyCard: { borderRadius: 18, borderWidth: 1, padding: 28, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  subHeading: { fontSize: 16, fontWeight: '800' },
  profileCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarImg: { width: 68, height: 68, borderRadius: 34 },
  avatarFallback: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  profileOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
  },
  primaryBtn: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.68)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: { width: '100%', maxWidth: 520, borderRadius: 20, borderWidth: 1, padding: 20, gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  input: { borderRadius: 12, borderWidth: 1, padding: 11, fontSize: 14 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
