import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import {
  AlertTriangle,
  Bell,
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Phone,
  PlusCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
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
import { useThemeMode } from '@/context/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import {
  authApi,
  demandesRechercheApi,
  getStorageBaseUrl,
  proprietesApi,
  visitesApi,
} from '@/services/api';
import type { BackendProperty, DemandeRechercheItem, VisiteBackendItem } from '@/types/api';
import { formatFcfa, resolveStorageUrl } from '@/types/property';
import { confirmDialog, showMessage } from '@/utils/dialog';
import { getStatusDisplay, isValidEmail, isValidPersonName, isValidPhone } from '@/utils/validation';

export type ClientWorkspaceSection = 'annonces' | 'recherches' | 'visites' | 'profil';

const PROPS_PER_PAGE = 8;
const REQUESTS_PER_PAGE = 8;

const VISIT_STATUS_TABS = [
  { key: 'tous', label: 'Toutes' },
  { key: 'pending', label: 'En attente' },
  { key: 'confirmed', label: 'Confirmées' },
  { key: 'completed', label: 'Effectuées' },
  { key: 'cancelled', label: 'Annulées' },
] as const;

interface ClientWorkspaceProps {
  embeddedInTabs?: boolean;
  initialSection?: ClientWorkspaceSection;
}

export function ClientWorkspace({
  embeddedInTabs = false,
  initialSection = 'annonces',
}: ClientWorkspaceProps) {
  const theme = useTheme();
  const { isDark } = useThemeMode();
  const insets = useSafeAreaInsets();
  const {
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
    unreadNotificationsCount,
    openAuthModal,
    refreshProfile,
    logout,
  } = useAuth();
  const { tarifs } = usePlatformConfig();
  const visitFeeLabel = tarifs ? formatFcfa(tarifs.visite) : '500 F CFA';
  const storageBaseUrl = useMemo(() => getStorageBaseUrl(), []);

  const [activeSection, setActiveSection] = useState<ClientWorkspaceSection>(initialSection);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // =========================================================================
  // SECTION 3 : MES VISITES PHYSIQUES (Pagination backend réelle via /api/mes-visites)
  // =========================================================================
  const [myVisits, setMyVisits] = useState<VisiteBackendItem[]>([]);
  const [visitsPage, setVisitsPage] = useState(1);
  const [visitsLastPage, setVisitsLastPage] = useState(1);
  const [visitsTotal, setVisitsTotal] = useState(0);
  const [visitsLoading, setVisitsLoading] = useState(true);
  const [visitsError, setVisitsError] = useState<string | null>(null);
  const [visitStatusFilter, setVisitStatusFilter] = useState<string>('tous');

  // =========================================================================
  // SECTION 1 : MES ANNONCES (Pagination backend réelle via /api/mes-proprietes)
  // =========================================================================
  const [myProps, setMyProps] = useState<BackendProperty[]>([]);
  const [propsPage, setPropsPage] = useState(1);
  const [propsLastPage, setPropsLastPage] = useState(1);
  const [propsTotal, setPropsTotal] = useState(0);
  const [propsLoading, setPropsLoading] = useState(true);
  const [propsError, setPropsError] = useState<string | null>(null);
  const [propStatusFilter, setPropStatusFilter] = useState<string>('tous');
  const [propSearch, setPropSearch] = useState('');
  const [debouncedPropSearch, setDebouncedPropSearch] = useState('');

  // Modal d'édition d'une annonce
  const [editingProp, setEditingProp] = useState<BackendProperty | null>(null);
  const [editPrix, setEditPrix] = useState('');
  const [editCommune, setEditCommune] = useState('');
  const [editArrondissement, setEditArrondissement] = useState('');
  const [editQuartier, setEditQuartier] = useState('');
  const [editSurface, setEditSurface] = useState('');
  const [editAccess, setEditAccess] = useState('');
  const [editEau, setEditEau] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [editNegotiable, setEditNegotiable] = useState(false);
  const [editPropError, setEditPropError] = useState<string | null>(null);
  const [savingProp, setSavingProp] = useState(false);

  // =========================================================================
  // SECTION 2 : MES RECHERCHES (Pagination backend réelle via /api/mes-demandes-recherche)
  // =========================================================================
  const [myRequests, setMyRequests] = useState<DemandeRechercheItem[]>([]);
  const [reqPage, setReqPage] = useState(1);
  const [reqLastPage, setReqLastPage] = useState(1);
  const [reqTotal, setReqTotal] = useState(0);
  const [reqLoading, setReqLoading] = useState(true);
  const [reqError, setReqError] = useState<string | null>(null);
  const [reqStatusFilter, setReqStatusFilter] = useState<string>('tous');
  const [reqSearch, setReqSearch] = useState('');
  const [debouncedReqSearch, setDebouncedReqSearch] = useState('');

  // Modal création / édition d'une demande de recherche (Commune en saisie libre)
  const [reqFormOpen, setReqFormOpen] = useState(false);
  const [editingReq, setEditingReq] = useState<DemandeRechercheItem | null>(null);
  const [reqPropertyType, setReqPropertyType] = useState<'parcelle' | 'maison' | 'chambre'>('maison');
  const [reqTransactionType, setReqTransactionType] = useState<'location' | 'vente'>('location');
  const [reqCommune, setReqCommune] = useState('');
  const [reqArrondissement, setReqArrondissement] = useState('');
  const [reqQuartier, setReqQuartier] = useState('');
  const [reqBudgetMax, setReqBudgetMax] = useState('');
  const [reqDetails, setReqDetails] = useState('');
  const [reqFormError, setReqFormError] = useState<string | null>(null);
  const [savingReq, setSavingReq] = useState(false);
  const [deletingReqId, setDeletingReqId] = useState<number | null>(null);

  // =========================================================================
  // SECTION 3 : MON PROFIL (Informations personnelles, coordonnées & avatar)
  // =========================================================================
  const [profilePrenom, setProfilePrenom] = useState(user?.prenom || '');
  const [profileNom, setProfileNom] = useState(user?.nom || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const isAgentBlocked = isAuthenticated && isAgentMobilier && !isAdminStaff;
  const canLoadClientData = isAuthenticated && !isAgentBlocked;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPropSearch(propSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [propSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedReqSearch(reqSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [reqSearch]);

  useEffect(() => {
    if (user) {
      setProfilePrenom(user.prenom || '');
      setProfileNom(user.nom || '');
      setProfilePhone(user.phone || '');
      setProfileEmail(user.email || '');
    }
  }, [user]);

  const loadMyProperties = useCallback(
    async (targetPage = 1) => {
      if (!canLoadClientData) {
        setMyProps([]);
        setPropsTotal(0);
        setPropsLastPage(1);
        setPropsLoading(false);
        return;
      }
      setPropsLoading(true);
      setPropsError(null);
      try {
        const res = await proprietesApi.getMyProperties(targetPage, {
          status: propStatusFilter === 'tous' ? undefined : propStatusFilter,
          search: debouncedPropSearch || undefined,
          per_page: PROPS_PER_PAGE,
        });
        if (res.success && res.data) {
          setMyProps(res.data.data || []);
          setPropsPage(res.data.current_page || targetPage);
          setPropsLastPage(res.data.last_page || 1);
          setPropsTotal(res.data.total ?? (res.data.data?.length || 0));
        } else {
          setPropsError(res.message || 'Impossible de charger vos annonces.');
        }
      } finally {
        setPropsLoading(false);
      }
    },
    [canLoadClientData, propStatusFilter, debouncedPropSearch]
  );

  const loadMyRequests = useCallback(
    async (targetPage = 1) => {
      if (!canLoadClientData) {
        setMyRequests([]);
        setReqTotal(0);
        setReqLastPage(1);
        setReqLoading(false);
        return;
      }
      setReqLoading(true);
      setReqError(null);
      try {
        const res = await demandesRechercheApi.getMyRequests({
          status: reqStatusFilter === 'tous' ? undefined : reqStatusFilter,
          search: debouncedReqSearch || undefined,
          page: targetPage,
          per_page: REQUESTS_PER_PAGE,
        });
        if (res.success && res.data) {
          setMyRequests(res.data.data || []);
          setReqPage(res.data.current_page || targetPage);
          setReqLastPage(res.data.last_page || 1);
          setReqTotal(res.data.total ?? (res.data.data?.length || 0));
        } else {
          setReqError(res.message || 'Impossible de charger vos demandes de recherche.');
        }
      } finally {
        setReqLoading(false);
      }
    },
    [canLoadClientData, reqStatusFilter, debouncedReqSearch]
  );

  const loadMyVisits = useCallback(
    async (targetPage = 1) => {
      if (!canLoadClientData) {
        setMyVisits([]);
        setVisitsTotal(0);
        setVisitsLastPage(1);
        setVisitsLoading(false);
        return;
      }
      setVisitsLoading(true);
      setVisitsError(null);
      try {
        const res = await visitesApi.getMyVisits(
          visitStatusFilter === 'tous' ? undefined : visitStatusFilter,
          targetPage
        );
        if (res.success && res.data) {
          setMyVisits(res.data.data || []);
          setVisitsPage(res.data.current_page || targetPage);
          setVisitsLastPage(res.data.last_page || 1);
          setVisitsTotal(res.data.total ?? (res.data.data?.length || 0));
        } else {
          setVisitsError(res.message || 'Impossible de charger vos visites physiques.');
        }
      } finally {
        setVisitsLoading(false);
      }
    },
    [canLoadClientData, visitStatusFilter]
  );

  useEffect(() => {
    void loadMyProperties(1);
  }, [loadMyProperties]);

  useEffect(() => {
    void loadMyRequests(1);
  }, [loadMyRequests]);

  useEffect(() => {
    void loadMyVisits(1);
  }, [loadMyVisits]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadMyProperties(propsPage),
      loadMyRequests(reqPage),
      loadMyVisits(visitsPage),
      refreshProfile(),
    ]);
    setRefreshing(false);
  };

  const handleCancelVisit = async (visitId: number) => {
    const ok = await confirmDialog(
      'Annuler cette visite ?',
      'Cette action marquera votre demande de visite comme annulée.',
      'Oui, annuler',
      'Non'
    );
    if (!ok) return;
    const res = await visitesApi.cancelVisit(visitId);
    if (res.success) {
      setFeedback({ text: `Visite VIS-${String(visitId).padStart(5, '0')} annulée.`, type: 'success' });
      await loadMyVisits(visitsPage);
    } else {
      showMessage('Erreur', res.message || "Impossible d'annuler cette visite.");
    }
  };

  // =========================================================================
  // ACTIONS : MES ANNONCES
  // =========================================================================
  const openEditProp = (item: BackendProperty) => {
    setEditingProp(item);
    setEditPrix(String(item.prix ?? ''));
    setEditCommune(item.commune || '');
    setEditArrondissement(item.arrondissement || '');
    setEditQuartier(item.quartier || '');
    setEditSurface(item.surface ? String(item.surface) : '');
    setEditAccess(item.accessibilite || '');
    setEditEau(item.eau_courant || '');
    setEditDesc(item.description || '');
    setEditDetails(item.location_details || '');
    setEditNegotiable(Boolean(item.is_negotiable));
    setEditPropError(null);
  };

  const handleSavePropEdit = async () => {
    if (!editingProp) return;
    setEditPropError(null);

    if (editCommune.trim().length < 2) {
      setEditPropError('La commune est obligatoire (au moins 2 caractères).');
      return;
    }
    const numericPrice = Number(editPrix.replace(/\s+/g, ''));
    if (Number.isNaN(numericPrice) || numericPrice <= 0) {
      setEditPropError('Veuillez saisir un prix valide supérieur à 0 F CFA.');
      return;
    }
    const isChambreLocation =
      editingProp.type === 'chambre' && editingProp.transaction_type === 'location';
    const numericSurface = editSurface.trim()
      ? Number(editSurface.replace(/\s+/g, ''))
      : undefined;
    if (!isChambreLocation && numericSurface !== undefined && (Number.isNaN(numericSurface) || numericSurface <= 0)) {
      setEditPropError('Veuillez saisir une superficie valide en m².');
      return;
    }

    setSavingProp(true);
    const res = await proprietesApi.update(editingProp.id, {
      prix: numericPrice,
      commune: editCommune.trim(),
      arrondissement: editArrondissement.trim(),
      quartier: editQuartier.trim(),
      ...(!isChambreLocation && numericSurface ? { surface: numericSurface } : {}),
      ...(editAccess.trim() ? { accessibilite: editAccess.trim() } : {}),
      ...(editEau.trim() ? { eau_courant: editEau.trim() } : {}),
      description: editDesc.trim(),
      location_details: editDetails.trim(),
      is_negotiable: editNegotiable,
    });
    setSavingProp(false);

    if (res.success) {
      setEditingProp(null);
      setFeedback({ text: `Annonce #${editingProp.id} mise à jour avec succès.`, type: 'success' });
      await loadMyProperties(propsPage);
    } else {
      setEditPropError(res.message || 'Impossible de modifier cette annonce.');
    }
  };

  const handleDeleteProp = async (item: BackendProperty) => {
    const ok = await confirmDialog(
      'Supprimer cette annonce ?',
      `Annonce #${item.id} (${item.commune})`,
      'Supprimer',
      'Annuler'
    );
    if (!ok) return;

    const res = await proprietesApi.delete(item.id);
    if (res.success) {
      setFeedback({ text: `Annonce #${item.id} supprimée avec succès.`, type: 'success' });
      await loadMyProperties(1);
    } else {
      setFeedback({ text: res.message || 'Suppression refusée.', type: 'error' });
    }
  };

  // =========================================================================
  // ACTIONS : MES RECHERCHES (Champ Commune en saisie libre)
  // =========================================================================
  const handleSelectReqPropertyType = (nextType: 'parcelle' | 'maison' | 'chambre') => {
    setReqPropertyType(nextType);
    if (nextType === 'parcelle' && reqTransactionType === 'location') {
      setReqTransactionType('vente');
    }
  };

  const openCreateReq = () => {
    setEditingReq(null);
    setReqPropertyType('maison');
    setReqTransactionType('location');
    setReqCommune('');
    setReqArrondissement('');
    setReqQuartier('');
    setReqBudgetMax('');
    setReqDetails('');
    setReqFormError(null);
    setReqFormOpen(true);
  };

  const openEditReq = (item: DemandeRechercheItem) => {
    setEditingReq(item);
    setReqPropertyType(item.property_type);
    setReqTransactionType(item.transaction_type);
    setReqCommune(item.target_commune || '');
    setReqArrondissement(item.target_arrondissement || '');
    setReqQuartier(item.target_quartier || '');
    setReqBudgetMax(String(item.budget_max ?? ''));
    setReqDetails(item.criteria_details || '');
    setReqFormError(null);
    setReqFormOpen(true);
  };

  const handleSaveReq = async () => {
    setReqFormError(null);

    if (reqPropertyType === 'parcelle' && reqTransactionType === 'location') {
      setReqFormError('Une parcelle ne peut pas faire l’objet d’une demande de location.');
      return;
    }
    if (reqCommune.trim().length < 2) {
      setReqFormError('Veuillez saisir le nom de votre commune (au moins 2 caractères).');
      return;
    }
    const parsedBudget = Number(reqBudgetMax.replace(/\s+/g, ''));
    if (!reqBudgetMax.trim() || Number.isNaN(parsedBudget) || parsedBudget <= 0) {
      setReqFormError('Veuillez saisir un budget maximum valide supérieur à 0 F CFA.');
      return;
    }

    setSavingReq(true);
    const payload = {
      property_type: reqPropertyType,
      transaction_type: reqTransactionType,
      target_commune: reqCommune.trim(),
      target_arrondissement: reqArrondissement.trim() || null,
      target_quartier: reqQuartier.trim() || null,
      budget_max: parsedBudget,
      criteria_details: reqDetails.trim() || null,
    };

    const res = editingReq
      ? await demandesRechercheApi.update(editingReq.id, payload)
      : await demandesRechercheApi.create(payload);

    setSavingReq(false);
    if (res.success) {
      setReqFormOpen(false);
      setFeedback({
        text: editingReq
          ? `Votre demande DEM-${String(editingReq.id).padStart(5, '0')} a été mise à jour.`
          : 'Votre demande de recherche a été publiée avec succès.',
        type: 'success',
      });
      await loadMyRequests(editingReq ? reqPage : 1);
    } else {
      setReqFormError(res.message || "Impossible d'enregistrer votre demande.");
    }
  };

  const handleDeleteReq = async (item: DemandeRechercheItem) => {
    if (deletingReqId === item.id) return;
    const ok = await confirmDialog(
      'Supprimer cette demande ?',
      `DEM-${String(item.id).padStart(5, '0')} — ${item.target_commune}`,
      'Oui, supprimer',
      'Annuler'
    );
    if (!ok) return;

    setDeletingReqId(item.id);
    try {
      const res = await demandesRechercheApi.delete(item.id);
      if (res.success) {
        setFeedback({
          text: `Demande DEM-${String(item.id).padStart(5, '0')} supprimée avec succès.`,
          type: 'success',
        });
        await loadMyRequests(1);
      } else {
        setFeedback({ text: res.message || 'Suppression refusée.', type: 'error' });
      }
    } finally {
      setDeletingReqId(null);
    }
  };

  // =========================================================================
  // ACTIONS : MON PROFIL
  // =========================================================================
  const handleSaveProfile = async () => {
    setProfileError(null);
    if (!isValidPersonName(profilePrenom)) {
      setProfileError('Le prénom doit contenir au moins 2 lettres valides.');
      return;
    }
    if (!isValidPersonName(profileNom)) {
      setProfileError('Le nom doit contenir au moins 2 lettres valides.');
      return;
    }
    if (!isValidPhone(profilePhone, true)) {
      setProfileError('Numéro béninois requis (10 chiffres commençant par 01, ex: 0197001122).');
      return;
    }
    if (profileEmail.trim() && !isValidEmail(profileEmail)) {
      setProfileError('Veuillez saisir une adresse e-mail valide.');
      return;
    }

    setSavingProfile(true);
    const res = await authApi.updateProfil({
      name: profileNom.trim(),
      prenom: profilePrenom.trim(),
      telephone: profilePhone.trim(),
      email: profileEmail.trim() ? profileEmail.trim().toLowerCase() : null,
    });
    setSavingProfile(false);

    if (res.success) {
      await refreshProfile();
      setFeedback({ text: res.message || 'Profil mis à jour avec succès.', type: 'success' });
      showMessage('Profil mis à jour', res.message || 'Vos informations ont été enregistrées.');
    } else {
      setProfileError(res.message || 'Impossible de mettre à jour votre profil.');
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
        setFeedback({ text: 'Photo de profil mise à jour.', type: 'success' });
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
      'Supprimer',
      'Annuler'
    );
    if (!ok) return;
    setUploadingPhoto(true);
    const res = await authApi.deletePhotoProfil();
    setUploadingPhoto(false);
    if (res.success) {
      await refreshProfile();
      setFeedback({ text: 'Photo de profil retirée.', type: 'success' });
    } else {
      showMessage('Erreur', res.message || 'Impossible de supprimer la photo.');
    }
  };

  // Garde de rôle : Les Agents mobiliers disposent de leur Espace Agent dédié
  if (isAgentBlocked) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
        {!embeddedInTabs && <ScreenHeader title="Espace Client" subtitle="Accès réservé aux clients" />}
        <View style={styles.centerGate}>
          <Lock size={34} color={theme.primary} strokeWidth={2.2} />
          <Text style={[styles.gateTitle, { color: theme.text }]}>
            Vous êtes connecté en tant qu’Agent immobilier
          </Text>
          <Text style={[styles.gateDesc, { color: theme.textSecondary }]}>
            Retrouvez vos biens immobiliers, vos visites et votre profil professionnel directement
            dans votre Espace Agent dédié.
          </Text>
          <Pressable
            onPress={() => router.replace('/agent-space' as any)}
            style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
            <Text style={styles.primaryBtnText}>Ouvrir mon Espace Agent</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Non authentifié
  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
        {!embeddedInTabs && <ScreenHeader title="Espace Client" subtitle="Compte personnel E-Mobilier" />}
        <View style={styles.centerGate}>
          <User size={36} color={theme.primary} strokeWidth={2.2} />
          <Text style={[styles.gateTitle, { color: theme.text }]}>
            Connectez-vous à votre Espace Client
          </Text>
          <Text style={[styles.gateDesc, { color: theme.textSecondary }]}>
            Centralisez vos annonces publiées, vos demandes de recherche immobilière et vos
            informations personnelles au même endroit.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => openAuthModal('login')}
              style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
              <Text style={styles.primaryBtnText}>Se connecter</Text>
            </Pressable>
            <Pressable
              onPress={() => openAuthModal('register')}
              style={[styles.primaryBtn, { backgroundColor: '#F59E0B' }]}>
              <Text style={[styles.primaryBtnText, { color: '#0F172A' }]}>S’inscrire</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const initials = (user.name || 'CL')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      {!embeddedInTabs && (
        <ScreenHeader
          title="Espace Client"
          subtitle={user.name || 'Mon espace personnel'}
          rightAction={
            <Pressable
              onPress={() => router.push('/publish-client' as any)}
              style={[styles.headerBtn, { backgroundColor: '#F59E0B' }]}>
              <Text style={styles.headerBtnText}>+ Publier</Text>
            </Pressable>
          }
        />
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
        contentContainerStyle={[
          styles.scroll,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: (embeddedInTabs ? BottomTabInset : 0) + insets.bottom + 84,
          },
        ]}>
        <View style={[styles.innerWrap, { maxWidth: contentMaxWidth }]}>
          {/* Identity Hero Banner */}
          <View style={[styles.heroCard, { backgroundColor: theme.navy }]}>
            <View style={styles.heroTopRow}>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={13} color="#FDE68A" strokeWidth={2.2} />
                  <Text style={styles.heroEyebrow}>MON ESPACE CLIENT</Text>
                </View>
                <Text style={styles.heroTitle}>{user.name}</Text>
                <Text style={styles.heroSub}>
                  {user.phone}
                  {user.email ? ` • ${user.email}` : ''}
                </Text>
              </View>

              <View style={styles.heroActions}>
                <Pressable
                  onPress={() => router.push('/publish-client' as any)}
                  style={[styles.goldBtn, { backgroundColor: '#F59E0B' }]}>
                  <Text style={styles.goldBtnText}>+ Publier un bien</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setActiveSection('recherches');
                    openCreateReq();
                  }}
                  style={styles.outlineWhiteBtn}>
                  <Text style={styles.outlineWhiteBtnText}>+ Nouvelle recherche</Text>
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

          {/* KPI Summary Strip */}
          <View style={styles.kpiGrid}>
            {[
              {
                label: 'Mes annonces',
                value: propsTotal,
                Icon: Building2,
                onPress: () => setActiveSection('annonces'),
              },
              {
                label: 'Mes recherches',
                value: reqTotal,
                Icon: Target,
                onPress: () => setActiveSection('recherches'),
              },
              {
                label: 'Mes visites',
                value: visitsTotal,
                Icon: Calendar,
                onPress: () => setActiveSection('visites'),
              },
              {
                label: 'Alertes non lues',
                value: unreadNotificationsCount,
                Icon: Bell,
                onPress: () => router.push('/notifications' as any),
              },
            ].map((item) => (
              <Pressable
                key={item.label}
                onPress={item.onPress}
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.cardBorder,
                    width: getGridItemWidth(isMobile ? 2 : 4, 10),
                  },
                ]}>
                <item.Icon size={19} color={theme.primary} strokeWidth={2.2} />
                <Text style={[styles.kpiValue, { color: theme.primary }]}>{item.value}</Text>
                <Text style={[styles.kpiLabel, { color: theme.text }]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* 4 Centralized Navigation Tabs: Mes annonces | Mes recherches | Mes visites | Mon profil */}
          <View style={styles.tabsRow}>
            {(
              [
                { key: 'annonces', label: `Mes annonces (${propsTotal})`, Icon: Building2 },
                { key: 'recherches', label: `Mes recherches (${reqTotal})`, Icon: Search },
                { key: 'visites', label: `Mes visites (${visitsTotal})`, Icon: Calendar },
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
          {/* ONGLET 1 : MES ANNONCES                                         */}
          {/* =============================================================== */}
          {activeSection === 'annonces' && (
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
                  placeholder="Rechercher dans mes annonces (commune, quartier, type...)"
                  placeholderTextColor={theme.textSecondary}
                  value={propSearch}
                  onChangeText={setPropSearch}
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {[
                    { key: 'tous', label: 'Tous' },
                    { key: 'published', label: 'Publiés' },
                    { key: 'pending', label: 'En attente' },
                    { key: 'rejected', label: 'Rejetés' },
                    { key: 'sold_rented', label: 'Conclus' },
                  ].map((f) => {
                    const active = propStatusFilter === f.key;
                    return (
                      <Pressable
                        key={f.key}
                        onPress={() => setPropStatusFilter(f.key)}
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

              {propsError ? (
                <View style={[styles.feedbackBanner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                  <Text style={{ color: '#B91C1C', fontSize: 13, fontWeight: '700', flex: 1 }}>
                    {propsError}
                  </Text>
                  <Pressable onPress={() => void loadMyProperties(propsPage)}>
                    <Text style={{ color: '#B91C1C', fontSize: 12, fontWeight: '800' }}>Réessayer</Text>
                  </Pressable>
                </View>
              ) : null}

              {propsLoading ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 32 }} />
              ) : myProps.length === 0 ? (
                <View
                  style={[
                    styles.emptyCard,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}>
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>
                    Aucune annonce publiée
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center', maxWidth: 420 }}>
                    {propStatusFilter !== 'tous' || debouncedPropSearch
                      ? 'Aucune de vos annonces ne correspond aux filtres sélectionnés.'
                      : 'Publiez votre maison, chambre ou parcelle pour la rendre visible sur E-Mobilier.'}
                  </Text>
                  <Pressable
                    onPress={() => router.push('/publish-client' as any)}
                    style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
                    <Text style={styles.primaryBtnText}>+ Publier une annonce</Text>
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
                              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>Voir</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => openEditProp(prop)}
                              style={[styles.smallBtn, { backgroundColor: theme.primaryLight }]}>
                              <Text style={{ color: theme.primaryDark, fontWeight: '700', fontSize: 12 }}>
                                Modifier
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => void handleDeleteProp(prop)}
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
                        Page {propsPage} / {propsLastPage} ({propsTotal} annonce{propsTotal > 1 ? 's' : ''})
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
          {/* ONGLET 2 : MES RECHERCHES (CRUD complet + Commune saisie libre) */}
          {/* =============================================================== */}
          {activeSection === 'recherches' && (
            <View style={{ gap: 14 }}>
              <View style={styles.sectionActionBar}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.subHeading, { color: theme.text }]}>
                    Mes demandes de recherche
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                    Décrivez le bien idéal et suivez son traitement par nos conseillers E-Mobilier.
                  </Text>
                </View>
                <Pressable
                  onPress={openCreateReq}
                  style={[styles.createBtn, { backgroundColor: theme.primary }]}>
                  <PlusCircle size={15} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.createBtnText}>Nouvelle recherche</Text>
                </Pressable>
              </View>

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
                  placeholder="Filtrer mes recherches (commune, quartier, critères...)"
                  placeholderTextColor={theme.textSecondary}
                  value={reqSearch}
                  onChangeText={setReqSearch}
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {[
                    { key: 'tous', label: 'Toutes' },
                    { key: 'active', label: 'Actives' },
                    { key: 'fulfilled', label: 'Satisfaites' },
                    { key: 'closed', label: 'Clôturées' },
                  ].map((f) => {
                    const active = reqStatusFilter === f.key;
                    return (
                      <Pressable
                        key={f.key}
                        onPress={() => setReqStatusFilter(f.key)}
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

              {reqError ? (
                <View style={[styles.feedbackBanner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                  <Text style={{ color: '#B91C1C', fontSize: 13, fontWeight: '700', flex: 1 }}>
                    {reqError}
                  </Text>
                  <Pressable onPress={() => void loadMyRequests(reqPage)}>
                    <Text style={{ color: '#B91C1C', fontSize: 12, fontWeight: '800' }}>Réessayer</Text>
                  </Pressable>
                </View>
              ) : null}

              {reqLoading ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 32 }} />
              ) : myRequests.length === 0 ? (
                <View
                  style={[
                    styles.emptyCard,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}>
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>
                    Aucune demande de recherche enregistrée
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center', maxWidth: 420 }}>
                    {reqStatusFilter !== 'tous' || debouncedReqSearch
                      ? 'Aucune demande ne correspond à votre filtre actuel.'
                      : 'Indiquez votre commune, votre type de bien et votre budget pour recevoir des propositions ciblées.'}
                  </Text>
                  <Pressable
                    onPress={openCreateReq}
                    style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
                    <Text style={styles.primaryBtnText}>Déposer une demande de recherche</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={{ gap: 12 }}>
                    {myRequests.map((item) => {
                      const st = getStatusDisplay(item.status);
                      const refCode = `DEM-${String(item.id).padStart(5, '0')}`;
                      return (
                        <View
                          key={`req-${item.id}`}
                          style={[
                            styles.listCard,
                            { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                          ]}>
                          <View style={styles.cardHeader}>
                            <Text style={{ color: theme.gold, fontSize: 11, fontWeight: '800' }}>
                              {refCode}
                            </Text>
                            <View style={styles.cardHeaderRight}>
                              <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                                <Text style={{ color: st.text, fontSize: 11, fontWeight: '800' }}>
                                  {st.label}
                                </Text>
                              </View>
                              <View style={styles.cardIconActions}>
                                <SearchCardActionIcon
                                  variant="edit"
                                  tooltip="Modifier"
                                  ariaLabel={`Modifier la demande ${refCode}`}
                                  onPress={() => openEditReq(item)}
                                  isMobile={isMobile}
                                  isDark={isDark}
                                  primaryColor={theme.primary}
                                />
                                <SearchCardActionIcon
                                  variant="delete"
                                  tooltip="Supprimer"
                                  ariaLabel={`Supprimer la demande ${refCode}`}
                                  onPress={() => void handleDeleteReq(item)}
                                  loading={deletingReqId === item.id}
                                  disabled={deletingReqId === item.id}
                                  isMobile={isMobile}
                                  isDark={isDark}
                                  primaryColor={theme.primary}
                                />
                              </View>
                            </View>
                          </View>

                          <Text style={[styles.cardTitle, { color: theme.text, fontSize: 15 }]}>
                            {item.property_type.toUpperCase()} ({item.transaction_type}) —{' '}
                            {[item.target_quartier, item.target_arrondissement, item.target_commune]
                              .filter(Boolean)
                              .join(', ')}
                          </Text>

                          <Text style={{ color: theme.primary, fontSize: 16, fontWeight: '900' }}>
                            Budget max : {formatFcfa(item.budget_max)}
                          </Text>

                          {item.criteria_details ? (
                            <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19 }}>
                              {item.criteria_details}
                            </Text>
                          ) : null}

                          {item.matched_propriete ? (
                            <Pressable
                              onPress={() => router.push(`/property/${item.matched_propriete!.id}` as any)}
                              style={[
                                styles.matchedBox,
                                { backgroundColor: theme.primaryLight, borderColor: theme.primary },
                              ]}>
                              <Text style={{ color: theme.primaryDark, fontSize: 12, fontWeight: '800' }}>
                                Bien proposé : #{item.matched_propriete.id} — {item.matched_propriete.type.toUpperCase()} à{' '}
                                {item.matched_propriete.commune} ({formatFcfa(item.matched_propriete.prix)})
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>

                  {reqLastPage > 1 && (
                    <View
                      style={[
                        styles.paginationBar,
                        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                      ]}>
                      <Pressable
                        onPress={() => void loadMyRequests(reqPage - 1)}
                        disabled={reqPage <= 1 || reqLoading}
                        style={[
                          styles.pageBtn,
                          { borderColor: theme.cardBorder, opacity: reqPage <= 1 ? 0.45 : 1 },
                        ]}>
                        <ChevronLeft size={15} color={theme.text} strokeWidth={2.2} />
                        <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>Précédent</Text>
                      </Pressable>
                      <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>
                        Page {reqPage} / {reqLastPage} ({reqTotal} demande{reqTotal > 1 ? 's' : ''})
                      </Text>
                      <Pressable
                        onPress={() => void loadMyRequests(reqPage + 1)}
                        disabled={reqPage >= reqLastPage || reqLoading}
                        style={[
                          styles.pageBtn,
                          { borderColor: theme.cardBorder, opacity: reqPage >= reqLastPage ? 0.45 : 1 },
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
          {/* ONGLET 3 : MES VISITES PHYSIQUES (visite_clients uniquement)    */}
          {/* =============================================================== */}
          {activeSection === 'visites' && (
            <View style={{ gap: 14 }}>
              <View style={styles.sectionActionBar}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.subHeading, { color: theme.text }]}>
                    Mes visites physiques programmées
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                    Suivez les visites physiques encadrées que vous avez réservées sur E-Mobilier.
                  </Text>
                </View>
                <Pressable
                  onPress={() => router.push('/explore' as any)}
                  style={[styles.createBtn, { backgroundColor: theme.primary }]}>
                  <Search size={15} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.createBtnText}>Explorer les biens</Text>
                </Pressable>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {VISIT_STATUS_TABS.map((tab) => {
                  const active = visitStatusFilter === tab.key;
                  return (
                    <Pressable
                      key={tab.key}
                      onPress={() => setVisitStatusFilter(tab.key)}
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
                        {tab.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {visitsError ? (
                <View style={[styles.feedbackBanner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                  <Text style={{ color: '#B91C1C', fontSize: 13, fontWeight: '700', flex: 1 }}>
                    {visitsError}
                  </Text>
                  <Pressable onPress={() => void loadMyVisits(visitsPage)}>
                    <Text style={{ color: '#B91C1C', fontSize: 12, fontWeight: '800' }}>Réessayer</Text>
                  </Pressable>
                </View>
              ) : null}

              {visitsLoading ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 32 }} />
              ) : myVisits.length === 0 ? (
                <View
                  style={[
                    styles.emptyCard,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}>
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>
                    Aucune visite physique enregistrée
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center', maxWidth: 420 }}>
                    {visitStatusFilter !== 'tous'
                      ? 'Aucune de vos visites ne correspond à ce statut.'
                      : 'Ouvrez la fiche d’un bien dans le catalogue pour réserver une visite physique encadrée par E-Mobilier.'}
                  </Text>
                  <Pressable
                    onPress={() => router.push('/explore' as any)}
                    style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
                    <Text style={styles.primaryBtnText}>Explorer les biens</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={{ gap: 12 }}>
                    {myVisits.map((item) => {
                      const prop = item.propriete;
                      const st = getStatusDisplay(item.status);
                      const propTitle = prop
                        ? `${prop.type.toUpperCase()} (${prop.transaction_type})`
                        : `Bien #${item.property_id}`;
                      const locationStr = prop
                        ? [prop.quartier, prop.arrondissement, prop.commune].filter(Boolean).join(', ')
                        : 'Localisation en cours de confirmation';

                      return (
                        <View
                          key={`vis-${item.id}`}
                          style={[
                            styles.listCard,
                            { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                          ]}>
                          <View style={styles.cardHeader}>
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={{ color: theme.gold, fontSize: 11, fontWeight: '800' }}>
                                VIS-{String(item.id).padStart(5, '0')}
                              </Text>
                              <Text style={[styles.cardTitle, { color: theme.text, fontSize: 15 }]}>
                                {propTitle}
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <MapPin size={13} color={theme.primary} strokeWidth={2.2} />
                                <Text style={{ color: theme.textSecondary, fontSize: 13, flex: 1 }}>
                                  {locationStr}
                                </Text>
                              </View>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                              <Text style={{ color: st.text, fontSize: 11, fontWeight: '800' }}>
                                {st.label}
                              </Text>
                            </View>
                          </View>

                          <View style={[styles.visitInfoStrip, { backgroundColor: theme.backgroundElement }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Calendar size={14} color={theme.text} strokeWidth={2} />
                              <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>
                                Date souhaitée : {new Date(item.scheduled_date).toLocaleString('fr-FR')}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              {item.is_fee_paid ? (
                                <CheckCircle2 size={14} color="#059669" strokeWidth={2.2} />
                              ) : (
                                <Clock size={14} color={theme.gold} strokeWidth={2.2} />
                              )}
                              <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '700' }}>
                                {item.is_fee_paid ? `Frais ${visitFeeLabel} acquittés` : 'Paiement requis'}
                              </Text>
                            </View>
                            {prop ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Building2 size={14} color={theme.textSecondary} strokeWidth={2} />
                                <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '600' }}>
                                  Prix affiché : {formatFcfa(prop.prix)}
                                  {prop.transaction_type === 'location' ? '/mois' : ''}
                                </Text>
                              </View>
                            ) : null}
                          </View>

                          {item.instructions_itineraire ? (
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                              <MapPin size={14} color={theme.primary} strokeWidth={2} style={{ marginTop: 2 }} />
                              <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19, flex: 1 }}>
                                Consignes d’accès : {item.instructions_itineraire}
                              </Text>
                            </View>
                          ) : null}

                          {item.compte_rendu ? (
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                              <FileText size={14} color={theme.text} strokeWidth={2} style={{ marginTop: 2 }} />
                              <Text style={{ color: theme.text, fontSize: 13, lineHeight: 19, flex: 1 }}>
                                Compte-rendu : {item.compte_rendu}
                              </Text>
                            </View>
                          ) : null}

                          <View style={styles.actionBtns}>
                            {prop ? (
                              <Pressable
                                onPress={() => router.push(`/property/${prop.id}` as any)}
                                style={[styles.smallBtn, { backgroundColor: theme.backgroundElement }]}>
                                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>
                                  Voir le bien
                                </Text>
                              </Pressable>
                            ) : null}
                            {(item.status === 'pending' || item.status === 'confirmed') && (
                              <Pressable
                                onPress={() => void handleCancelVisit(item.id)}
                                style={[styles.smallBtn, { backgroundColor: '#FEE2E2' }]}>
                                <Text style={{ color: '#B91C1C', fontWeight: '700', fontSize: 12 }}>
                                  Annuler la visite
                                </Text>
                              </Pressable>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {visitsLastPage > 1 && (
                    <View
                      style={[
                        styles.paginationBar,
                        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                      ]}>
                      <Pressable
                        onPress={() => void loadMyVisits(visitsPage - 1)}
                        disabled={visitsPage <= 1 || visitsLoading}
                        style={[
                          styles.pageBtn,
                          { borderColor: theme.cardBorder, opacity: visitsPage <= 1 ? 0.45 : 1 },
                        ]}>
                        <ChevronLeft size={15} color={theme.text} strokeWidth={2.2} />
                        <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>Précédent</Text>
                      </Pressable>
                      <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>
                        Page {visitsPage} / {visitsLastPage} ({visitsTotal} visite{visitsTotal > 1 ? 's' : ''})
                      </Text>
                      <Pressable
                        onPress={() => void loadMyVisits(visitsPage + 1)}
                        disabled={visitsPage >= visitsLastPage || visitsLoading}
                        style={[
                          styles.pageBtn,
                          { borderColor: theme.cardBorder, opacity: visitsPage >= visitsLastPage ? 0.45 : 1 },
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
          {/* ONGLET 4 : MON PROFIL (Coordonnées, infos personnelles & compte)*/}
          {/* =============================================================== */}
          {activeSection === 'profil' && (
            <View style={{ gap: 14, maxWidth: 680, width: '100%', alignSelf: 'center' }}>
              {/* Avatar & Account Overview */}
              <View style={[styles.profileCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <View style={styles.avatarRow}>
                  {user.photo_url ? (
                    <Image source={{ uri: user.photo_url }} style={styles.avatarImg} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: theme.primary }]}>
                      <Text style={styles.avatarInitials}>{initials}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: theme.text }}>{user.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Phone size={13} color={theme.textSecondary} strokeWidth={2} />
                      <Text style={{ fontSize: 13, color: theme.textSecondary }}>{user.phone}</Text>
                    </View>
                    {user.email ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Mail size={13} color={theme.textSecondary} strokeWidth={2} />
                        <Text style={{ fontSize: 12, color: theme.textSecondary }}>{user.email}</Text>
                      </View>
                    ) : null}
                    <Text style={{ fontSize: 12, color: theme.primary, fontWeight: '700' }}>
                      {user.roles?.join(' • ') || 'Client'} • Statut : {user.statut === 'suspendu' ? 'Suspendu' : 'Actif'}
                      {user.created_at
                        ? ` • Membre depuis ${new Date(user.created_at).toLocaleDateString('fr-FR')}`
                        : ''}
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
                  {user.photo_url ? (
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

              {/* Personal Info & Coordinates Edit Form */}
              <View style={[styles.profileCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <Text style={[styles.subHeading, { color: theme.text }]}>
                  Informations personnelles et coordonnées
                </Text>

                {profileError ? (
                  <View style={[styles.errorBox, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                    <AlertTriangle size={16} color="#B91C1C" strokeWidth={2.2} />
                    <Text style={[styles.errorText, { flex: 1 }]}>{profileError}</Text>
                  </View>
                ) : null}

                <View style={{ gap: 6 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Prénom *</Text>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
                    value={profilePrenom}
                    onChangeText={(v) => {
                      setProfilePrenom(v);
                      if (profileError) setProfileError(null);
                    }}
                    placeholder="Votre prénom"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Nom *</Text>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
                    value={profileNom}
                    onChangeText={(v) => {
                      setProfileNom(v);
                      if (profileError) setProfileError(null);
                    }}
                    placeholder="Votre nom"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    Téléphone (Bénin +229) *
                  </Text>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
                    value={profilePhone}
                    onChangeText={(v) => {
                      setProfilePhone(v);
                      if (profileError) setProfileError(null);
                    }}
                    placeholder="Ex: 0197001122"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    Adresse e-mail (optionnelle)
                  </Text>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
                    value={profileEmail}
                    onChangeText={(v) => {
                      setProfileEmail(v);
                      if (profileError) setProfileError(null);
                    }}
                    placeholder="Ex: prenom.nom@email.com"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <Pressable
                  onPress={() => void handleSaveProfile()}
                  disabled={savingProfile}
                  style={[styles.primaryBtn, { backgroundColor: theme.primary, opacity: savingProfile ? 0.65 : 1 }]}>
                  <Text style={styles.primaryBtnText}>
                    {savingProfile ? 'Enregistrement...' : 'Enregistrer les modifications'}
                  </Text>
                </Pressable>
              </View>

              {/* Account Shortcuts (Sans Paiements & Reçus) */}
              <View style={[styles.profileCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <Text style={[styles.subHeading, { color: theme.text }]}>Paramètres &amp; Raccourcis</Text>

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

      {/* =================================================================== */}
      {/* MODAL : MODIFIER UNE ANNONCE                                        */}
      {/* =================================================================== */}
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
              Modifier l’annonce #{editingProp?.id}
            </Text>
            {editPropError ? (
              <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '700' }}>{editPropError}</Text>
            ) : null}
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 10 }}>
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
                placeholder="Saisissez votre commune"
                placeholderTextColor={theme.textSecondary}
                value={editCommune}
                onChangeText={setEditCommune}
              />
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement },
                ]}
                placeholder="Arrondissement"
                placeholderTextColor={theme.textSecondary}
                value={editArrondissement}
                onChangeText={setEditArrondissement}
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
                placeholder="Accessibilité (voie pavée, bitumée...)"
                placeholderTextColor={theme.textSecondary}
                value={editAccess}
                onChangeText={setEditAccess}
              />
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement },
                ]}
                placeholder="Eau & électricité (SBEE / SONEB)"
                placeholderTextColor={theme.textSecondary}
                value={editEau}
                onChangeText={setEditEau}
              />
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement },
                ]}
                placeholder="Repères d'accès"
                placeholderTextColor={theme.textSecondary}
                value={editDetails}
                onChangeText={setEditDetails}
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
                placeholder="Description"
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
              onPress={() => void handleSavePropEdit()}
              disabled={savingProp}
              style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
              <Text style={styles.primaryBtnText}>
                {savingProp ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </Text>
            </Pressable>
            <Pressable onPress={() => setEditingProp(null)} style={{ alignItems: 'center', padding: 8 }}>
              <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* MODAL : CRÉER / MODIFIER UNE DEMANDE DE RECHERCHE (Commune libre)   */}
      {/* =================================================================== */}
      <Modal
        visible={reqFormOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setReqFormOpen(false)}>
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
          <ScreenHeader
            title={editingReq ? 'Modifier la recherche' : 'Nouvelle demande de recherche'}
            onBack={() => setReqFormOpen(false)}
          />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formScroll}>
            {reqFormError && (
              <View style={[styles.errorBox, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                <AlertTriangle size={16} color="#B91C1C" strokeWidth={2.2} />
                <Text style={[styles.errorText, { flex: 1 }]}>{reqFormError}</Text>
              </View>
            )}

            <Text style={[styles.fieldLabel, { color: theme.text }]}>Type de bien *</Text>
            <View style={styles.rowWrap}>
              {(['maison', 'parcelle', 'chambre'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => handleSelectReqPropertyType(t)}
                  style={[
                    styles.pill,
                    { backgroundColor: reqPropertyType === t ? theme.primary : theme.backgroundElement },
                  ]}>
                  <Text
                    style={{
                      color: reqPropertyType === t ? '#FFFFFF' : theme.text,
                      fontWeight: '700',
                      textTransform: 'capitalize',
                    }}>
                    {t}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: theme.text }]}>Transaction *</Text>
            <View style={styles.rowWrap}>
              {(['location', 'vente'] as const).map((tr) => {
                const disabled = reqPropertyType === 'parcelle' && tr === 'location';
                return (
                  <Pressable
                    key={tr}
                    disabled={disabled}
                    onPress={() => setReqTransactionType(tr)}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: reqTransactionType === tr ? '#F59E0B' : theme.backgroundElement,
                        opacity: disabled ? 0.4 : 1,
                      },
                    ]}>
                    <Text
                      style={{
                        color: reqTransactionType === tr ? '#0F172A' : theme.text,
                        fontWeight: '800',
                        textTransform: 'capitalize',
                      }}>
                      {tr}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ gap: 6 }}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Commune *</Text>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.cardBackground },
                ]}
                placeholder="Saisissez votre commune"
                placeholderTextColor={theme.textSecondary}
                value={reqCommune}
                onChangeText={(v) => {
                  setReqCommune(v);
                  if (reqFormError) setReqFormError(null);
                }}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Arrondissement (optionnel)</Text>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.cardBackground },
                ]}
                placeholder="Ex: Godomey, 12ème Arrondissement..."
                placeholderTextColor={theme.textSecondary}
                value={reqArrondissement}
                onChangeText={setReqArrondissement}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Quartier (optionnel)</Text>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.cardBackground },
                ]}
                placeholder="Ex: Fidjrossè, Cadjehoun, Arconville..."
                placeholderTextColor={theme.textSecondary}
                value={reqQuartier}
                onChangeText={setReqQuartier}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Budget maximum (F CFA) *</Text>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.cardBackground },
                ]}
                placeholder="Ex: 150000 ou 25000000"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                value={reqBudgetMax}
                onChangeText={(v) => {
                  setReqBudgetMax(v);
                  if (reqFormError) setReqFormError(null);
                }}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Critères particuliers (optionnel)</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    borderColor: theme.cardBorder,
                    backgroundColor: theme.cardBackground,
                    minHeight: 100,
                    textAlignVertical: 'top',
                  },
                ]}
                placeholder="Nombre de chambres, accès pavé, garage, proximité écoles..."
                placeholderTextColor={theme.textSecondary}
                multiline
                value={reqDetails}
                onChangeText={setReqDetails}
              />
            </View>

            <Pressable
              onPress={() => void handleSaveReq()}
              disabled={savingReq}
              style={[styles.primaryBtn, { backgroundColor: theme.primary, opacity: savingReq ? 0.7 : 1 }]}>
              <Text style={styles.primaryBtnText}>
                {savingReq ? 'Enregistrement...' : editingReq ? 'Mettre à jour la demande' : 'Publier la demande'}
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerGate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  gateTitle: { fontSize: 19, fontWeight: '900', textAlign: 'center' },
  gateDesc: { fontSize: 13, textAlign: 'center', maxWidth: 420, lineHeight: 20 },
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
  heroEyebrow: { color: '#FDE68A', fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  heroSub: { color: '#CBD5E1', fontSize: 13 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goldBtn: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12 },
  goldBtnText: { color: '#0F172A', fontSize: 13, fontWeight: '900' },
  outlineWhiteBtn: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  outlineWhiteBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
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
  kpiLabel: { fontSize: 12, fontWeight: '700' },
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
  sectionActionBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  createBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  toolbar: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  searchInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    minHeight: 38,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
  },
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  propCard: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 7 },
  propThumb: { width: '100%', aspectRatio: 16 / 10, minHeight: 135, borderRadius: 12, marginBottom: 4 },
  listCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 8, overflow: 'visible' },
  visitInfoStrip: { borderRadius: 12, padding: 10, gap: 5 },
  cardHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIconActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconActionWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  iconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActionBtnMobile: {
    width: 40,
    height: 40,
    borderRadius: 11,
  },
  tooltipBubble: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    zIndex: 30,
    ...Platform.select({
      web: {
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.28)',
      } as any,
    }),
  },
  tooltipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardTitle: { fontSize: 14, fontWeight: '800', flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  rejectBox: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8 },
  rejectText: { color: '#B91C1C', fontSize: 12, fontWeight: '600' },
  matchedBox: { borderRadius: 10, borderWidth: 1, padding: 10 },
  actionBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  smallBtn: {
    flex: 1,
    minWidth: 74,
    minHeight: 40,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  emptyCard: { borderRadius: 18, borderWidth: 1, padding: 28, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
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
  fieldLabel: { fontSize: 12, fontWeight: '700' },
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
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  formScroll: { padding: Spacing.three, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center' },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 12, padding: 12 },
  errorText: { color: '#B91C1C', fontSize: 13, fontWeight: '700' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
});

interface SearchCardActionIconProps {
  variant: 'edit' | 'delete';
  tooltip: string;
  ariaLabel: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  isMobile: boolean;
  isDark: boolean;
  primaryColor: string;
}

function SearchCardActionIcon({
  variant,
  tooltip,
  ariaLabel,
  onPress,
  disabled = false,
  loading = false,
  isMobile,
  isDark,
  primaryColor,
}: SearchCardActionIconProps) {
  const [hovered, setHovered] = useState(false);

  const isEdit = variant === 'edit';
  const iconColor = isEdit ? primaryColor : isDark ? '#F87171' : '#DC2626';
  const baseBg = isEdit
    ? isDark
      ? 'rgba(16, 185, 129, 0.12)'
      : 'rgba(0, 135, 81, 0.08)'
    : isDark
    ? 'rgba(248, 113, 113, 0.10)'
    : 'rgba(220, 38, 38, 0.07)';
  const hoverBg = isEdit
    ? isDark
      ? 'rgba(16, 185, 129, 0.24)'
      : 'rgba(0, 135, 81, 0.16)'
    : isDark
    ? 'rgba(248, 113, 113, 0.22)'
    : 'rgba(220, 38, 38, 0.15)';
  const baseBorder = isEdit
    ? isDark
      ? 'rgba(16, 185, 129, 0.25)'
      : 'rgba(0, 135, 81, 0.22)'
    : isDark
    ? 'rgba(248, 113, 113, 0.22)'
    : 'rgba(220, 38, 38, 0.20)';
  const hoverBorder = isEdit ? primaryColor : isDark ? '#F87171' : '#DC2626';

  return (
    <View style={styles.iconActionWrap}>
      {hovered && Platform.OS === 'web' ? (
        <View
          pointerEvents="none"
          style={[
            styles.tooltipBubble,
            !isEdit && { right: 0 },
            {
              backgroundColor: isDark ? '#0F172A' : '#1E293B',
              borderColor: isDark ? '#334155' : '#0F172A',
            },
          ]}>
          <Text style={[styles.tooltipText, { color: '#F8FAFC' }]}>{tooltip}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={onPress}
        disabled={disabled}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={ariaLabel}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        {...(Platform.OS === 'web' ? ({ title: tooltip } as any) : {})}
        style={({ pressed }) => [
          styles.iconActionBtn,
          isMobile && styles.iconActionBtnMobile,
          {
            backgroundColor: hovered || pressed ? hoverBg : baseBg,
            borderColor: hovered || pressed ? hoverBorder : baseBorder,
            opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          },
          Platform.OS === 'web'
            ? ({
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'background-color 150ms ease, border-color 150ms ease, transform 150ms ease',
                transform: hovered ? [{ scale: 1.05 }] : [{ scale: 1 }],
              } as any)
            : null,
        ]}>
        {loading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : isEdit ? (
          <Pencil size={isMobile ? 17 : 15} color={iconColor} strokeWidth={2.2} />
        ) : (
          <Trash2 size={isMobile ? 17 : 15} color={iconColor} strokeWidth={2.2} />
        )}
      </Pressable>
    </View>
  );
}
