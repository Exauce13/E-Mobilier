import { Image } from 'expo-image';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  Filter,
  Flame,
  History,
  Home,
  Hourglass,
  Info,
  Layers,
  Lock,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserCog,
  Users,
  X,
  XCircle,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { useResponsive } from '@/hooks/use-responsive';
import { adminApi, getStorageBaseUrl } from '@/services/api';
import type {
  AdminDemandeClientItem,
  AdminVisiteItem,
  AssociatedPropertySummary,
  CoordonneesUnmaskedData,
  DemandesStats,
  DemandeWorkflowStatus,
  DossierAuditLogEntry,
  MatchingPropertySuggestion,
  OperationalAgentItem,
  VisitesStats,
  ZoneSummary,
} from '@/types/api';
import { formatFcfa, resolveStorageUrl } from '@/types/property';

// Palette claire officielle E-Mobilier (identique au portail Super Admin)
const UI = {
  white: '#FFFFFF',
  bg: '#F4F7F6',
  surfaceSoft: '#F8FAFC',
  green: '#008751',
  greenDark: '#006B40',
  greenSoft: '#EBF7F1',
  greenBorder: '#B7E4CE',
  text: '#0F172A',
  textSecondary: '#475569',
  muted: '#64748B',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  blue: '#2563EB',
  blueSoft: '#EFF6FF',
  blueBorder: '#BFDBFE',
  amber: '#D97706',
  amberSoft: '#FFFBEB',
  amberText: '#92400E',
  amberBorder: '#FDE68A',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  dangerBorder: '#FECACA',
  purple: '#7C3AED',
  purpleSoft: '#F5F3FF',
  purpleBorder: '#DDD6FE',
  slate: '#475569',
  slateSoft: '#F1F5F9',
} as const;

type CharteErrorHandler = (msg?: string) => void;
type ActiveTab = 'visites' | 'demandes';

type ToastState = {
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
} | null;

const WEB_CURSOR = Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null;

function webTip(title: string) {
  return Platform.OS === 'web' ? ({ title } as any) : {};
}

function formatDateTimeFr(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateFr(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getDemandeStatusMeta(ws?: DemandeWorkflowStatus | string) {
  switch (ws) {
    case 'en_attente':
      return { label: 'En attente', bg: UI.amberSoft, border: UI.amberBorder, text: UI.amberText, accent: UI.amber };
    case 'en_cours':
      return { label: 'En cours', bg: UI.blueSoft, border: UI.blueBorder, text: UI.blue, accent: UI.blue };
    case 'satisfaite':
    case 'fulfilled':
      return { label: 'Satisfaite', bg: UI.greenSoft, border: UI.greenBorder, text: UI.greenDark, accent: UI.green };
    case 'abandonnee':
      return { label: 'Abandonnée', bg: UI.slateSoft, border: UI.border, text: UI.slate, accent: '#64748B' };
    case 'expiree':
      return { label: 'Expirée', bg: UI.dangerSoft, border: UI.dangerBorder, text: UI.danger, accent: UI.danger };
    default:
      return { label: String(ws || 'Active'), bg: UI.slateSoft, border: UI.border, text: UI.slate, accent: UI.muted };
  }
}

function getVisiteStatusMeta(status?: string) {
  switch (status) {
    case 'pending':
      return { label: 'En attente de confirmation', shortLabel: 'En attente', bg: UI.amberSoft, border: UI.amberBorder, text: UI.amberText, accent: UI.amber };
    case 'confirmed':
      return { label: 'Programmée / Confirmée', shortLabel: 'Programmée', bg: UI.blueSoft, border: UI.blueBorder, text: UI.blue, accent: UI.blue };
    case 'completed':
      return { label: 'Effectuée', shortLabel: 'Effectuée', bg: UI.greenSoft, border: UI.greenBorder, text: UI.greenDark, accent: UI.green };
    case 'cancelled':
      return { label: 'Annulée', shortLabel: 'Annulée', bg: UI.dangerSoft, border: UI.dangerBorder, text: UI.danger, accent: UI.danger };
    default:
      return { label: String(status || '—'), shortLabel: String(status || '—'), bg: UI.slateSoft, border: UI.border, text: UI.slate, accent: UI.muted };
  }
}

function getIssueLabel(issue?: string | null): string {
  switch (issue) {
    case 'succes_offre':
      return 'Succès / Offre formulée';
    case 'sans_suite':
      return 'Sans suite';
    case 'client_absent':
      return 'Client absent';
    case 'autre':
      return 'Autre issue';
    default:
      return issue || '—';
  }
}

function getAuditActionLabel(action: string): string {
  const map: Record<string, string> = {
    demande_recherche_prise_en_charge: 'Prise en charge de la demande',
    demande_recherche_reattribuee: 'Réattribution de la demande',
    demande_recherche_bien_associe: 'Association de bien(s) compatible(s)',
    demande_recherche_cloturee: 'Clôture de la demande',
    demande_recherche_expiree_auto: 'Expiration automatique (échéance atteinte)',
    consultation_coordonnees_sensibles: 'Consultation tracée des coordonnées client',
    visite_planifiee: 'Planification & convocation visite',
    visite_compte_rendu_saisi: 'Saisie du compte-rendu terrain',
    visite_cloturee: 'Clôture du dossier de visite',
    visite_offre_escaladee: 'Escalade offre commerciale (Haute)',
    modification_statut_visite: 'Changement de statut de la visite',
    assignation_zone_visite: 'Assignation zone / agent terrain',
  };
  return map[action] || action.replace(/_/g, ' ');
}

function copyText(value?: string | null, onDone?: () => void) {
  if (!value) return;
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    void navigator.clipboard.writeText(value).then(() => onDone?.());
  } else {
    onDone?.();
  }
}

export function VisitesDemandesWorkspace({
  initialTab = 'visites',
  activeTab: controlledTab,
  onTabChange,
  onCharteRequired,
  hideHeader = false,
}: {
  initialTab?: ActiveTab;
  activeTab?: ActiveTab;
  onTabChange?: (tab: ActiveTab) => void;
  onCharteRequired?: CharteErrorHandler;
  hideHeader?: boolean;
}) {
  const { isDesktop, isSmallMobile } = useResponsive();
  const { user, isSuperAdminPrincipal } = useAuth();
  const storageBaseUrl = useMemo(() => getStorageBaseUrl(), []);

  const [internalTab, setInternalTab] = useState<ActiveTab>(initialTab);
  const currentTab: ActiveTab = controlledTab ?? internalTab;
  const setCurrentTab = useCallback(
    (tab: ActiveTab) => {
      if (onTabChange) onTabChange(tab);
      else setInternalTab(tab);
    },
    [onTabChange]
  );

  // Toast non bloquant
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((type: 'success' | 'error' | 'info', title: string, message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, title, message });
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  // Référentiels
  const [zones, setZones] = useState<ZoneSummary[]>([]);
  const [agents, setAgents] = useState<OperationalAgentItem[]>([]);

  // Statistiques réelles BDD
  const [demandesStats, setDemandesStats] = useState<DemandesStats>({
    total_demandes: 0,
    en_attente: 0,
    en_cours: 0,
    satisfaites: 0,
    abandonnees: 0,
    expirees: 0,
  });
  const [visitesStats, setVisitesStats] = useState<VisitesStats>({
    total_visites: 0,
    en_attente: 0,
    programmees: 0,
    effectuees: 0,
    annulees: 0,
  });

  // Données & pagination — Demandes
  const [demandes, setDemandes] = useState<AdminDemandeClientItem[]>([]);
  const [demandesLoading, setDemandesLoading] = useState(true);
  const [demandesPage, setDemandesPage] = useState(1);
  const [demandesLastPage, setDemandesLastPage] = useState(1);
  const [demandesTotalFiltered, setDemandesTotalFiltered] = useState(0);

  // Filtres Demandes
  const [demSearch, setDemSearch] = useState('');
  const [demSearchInput, setDemSearchInput] = useState('');
  const [demStatusFilter, setDemStatusFilter] = useState<string>('all');
  const [demAgentFilter, setDemAgentFilter] = useState<string>('all');
  const [demPropTypeFilter, setDemPropTypeFilter] = useState<string>('all');
  const [demTransTypeFilter, setDemTransTypeFilter] = useState<string>('all');
  const [demPeriodFilter, setDemPeriodFilter] = useState<string>('all');
  const [showDemFilters, setShowDemFilters] = useState(false);

  // Données & pagination — Visites
  const [visites, setVisites] = useState<AdminVisiteItem[]>([]);
  const [visitesLoading, setVisitesLoading] = useState(true);
  const [visitesPage, setVisitesPage] = useState(1);
  const [visitesLastPage, setVisitesLastPage] = useState(1);
  const [visitesTotalFiltered, setVisitesTotalFiltered] = useState(0);

  // Filtres Visites
  const [visSearch, setVisSearch] = useState('');
  const [visSearchInput, setVisSearchInput] = useState('');
  const [visStatusFilter, setVisStatusFilter] = useState<string>('all');
  const [visZoneFilter, setVisZoneFilter] = useState<string>('all');
  const [visAgentFilter, setVisAgentFilter] = useState<string>('all');
  const [visPeriodFilter, setVisPeriodFilter] = useState<string>('all');
  const [showVisFilters, setShowVisFilters] = useState(false);

  // Verrouillage anti-double soumission par clé d'action
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Modales partagées
  const [unmaskedInfo, setUnmaskedInfo] = useState<CoordonneesUnmaskedData | null>(null);
  const [demasquagePrompt, setDemasquagePrompt] = useState<{
    type: 'visite' | 'demande_client';
    id: number;
    reference: string;
    message: string;
  } | null>(null);
  const [demasquageMotif, setDemasquageMotif] = useState('');
  const [demasquageJustif, setDemasquageJustif] = useState('');

  const [historyModal, setHistoryModal] = useState<{
    reference: string;
    loading: boolean;
    entries: DossierAuditLogEntry[];
  } | null>(null);

  // Modales Demandes
  const [confirmTakeDemande, setConfirmTakeDemande] = useState<AdminDemandeClientItem | null>(null);
  const [reassignModal, setReassignModal] = useState<{ demande: AdminDemandeClientItem; agentId: number } | null>(null);
  const [closeDemandeModal, setCloseDemandeModal] = useState<{
    demande: AdminDemandeClientItem;
    motif: 'satisfaite' | 'abandonnee_client' | 'delai_depasse';
    details: string;
  } | null>(null);

  // Modale Matching Biens (Phase 4)
  const [matchingModal, setMatchingModal] = useState<{
    demande: AdminDemandeClientItem;
    loading: boolean;
    suggestions: MatchingPropertySuggestion[];
    associated: AssociatedPropertySummary[];
    selectedIds: number[];
    noteAgent: string;
    notifierClient: boolean;
  } | null>(null);

  // Modales Visites (Phase 5)
  const [visitActionModal, setVisitActionModal] = useState<{
    visit: AdminVisiteItem;
    mode: 'planifier' | 'cr' | 'cloturer' | 'escalade' | 'zone' | 'statut';
  } | null>(null);
  const [vDateInput, setVDateInput] = useState('');
  const [vInstructions, setVInstructions] = useState('');
  const [vAgentId, setVAgentId] = useState<number | null>(null);
  const [vZoneId, setVZoneId] = useState<number>(1);
  const [vCrInput, setVCrInput] = useState('');
  const [vClotureIssue, setVClotureIssue] = useState<'succes_offre' | 'sans_suite' | 'client_absent' | 'autre'>('succes_offre');
  const [vMotif, setVMotif] = useState('');
  const [vEscaladeAmount, setVEscaladeAmount] = useState('');
  const [vEscaladeNote, setVEscaladeNote] = useState('');
  const [vStatusChoice, setVStatusChoice] = useState<'pending' | 'confirmed' | 'completed' | 'cancelled'>('confirmed');

  // Chargement des référentiels (zones + agents)
  const loadRefs = useCallback(async () => {
    const [zRes, aRes] = await Promise.all([
      adminApi.getZones().catch(() => null),
      adminApi.getOperationalAgents().catch(() => null),
    ]);
    if (zRes?.success && Array.isArray(zRes.data)) {
      setZones(zRes.data);
    }
    if (aRes?.success && Array.isArray(aRes.data)) {
      setAgents(aRes.data);
    }
  }, []);

  // Chargement Demandes
  const loadDemandes = useCallback(async () => {
    setDemandesLoading(true);
    try {
      const res = await adminApi.getAdminDemandes({
        workflow_status: demStatusFilter !== 'all' ? demStatusFilter : undefined,
        gestionnaire_id: demAgentFilter !== 'all' ? demAgentFilter : undefined,
        property_type: demPropTypeFilter !== 'all' ? demPropTypeFilter : undefined,
        transaction_type: demTransTypeFilter !== 'all' ? demTransTypeFilter : undefined,
        period: demPeriodFilter !== 'all' ? demPeriodFilter : undefined,
        search: demSearch.trim() || undefined,
        page: demandesPage,
        per_page: 12,
      });

      if (res.statusCode === 403 && res.message?.toLowerCase().includes('charte')) {
        onCharteRequired?.(res.message);
        return;
      }

      if (res.success) {
        if (res.stats) setDemandesStats(res.stats);
        const pag = res.data as any;
        const rows: AdminDemandeClientItem[] = Array.isArray(pag?.data) ? pag.data : [];
        setDemandes(rows);
        setDemandesLastPage(Number(pag?.meta?.last_page ?? pag?.last_page ?? 1));
        setDemandesTotalFiltered(Number(pag?.meta?.total ?? pag?.total ?? rows.length));
      } else {
        notify('error', 'Erreur chargement demandes', res.message || 'Impossible de charger les demandes.');
      }
    } finally {
      setDemandesLoading(false);
    }
  }, [
    demStatusFilter,
    demAgentFilter,
    demPropTypeFilter,
    demTransTypeFilter,
    demPeriodFilter,
    demSearch,
    demandesPage,
    onCharteRequired,
    notify,
  ]);

  // Chargement Visites
  const loadVisites = useCallback(async () => {
    setVisitesLoading(true);
    try {
      const res = await adminApi.getAdminVisites({
        status: visStatusFilter !== 'all' ? visStatusFilter : undefined,
        zone_id: visZoneFilter !== 'all' ? visZoneFilter : undefined,
        agent_id: visAgentFilter !== 'all' ? visAgentFilter : undefined,
        period: visPeriodFilter !== 'all' ? visPeriodFilter : undefined,
        search: visSearch.trim() || undefined,
        page: visitesPage,
        per_page: 12,
      });

      if (res.statusCode === 403 && res.message?.toLowerCase().includes('charte')) {
        onCharteRequired?.(res.message);
        return;
      }

      if (res.success) {
        if (res.stats) setVisitesStats(res.stats);
        const pag = res.data as any;
        const rows: AdminVisiteItem[] = Array.isArray(pag?.data) ? pag.data : [];
        setVisites(rows);
        setVisitesLastPage(Number(pag?.meta?.last_page ?? pag?.last_page ?? 1));
        setVisitesTotalFiltered(Number(pag?.meta?.total ?? pag?.total ?? rows.length));
      } else {
        notify('error', 'Erreur chargement visites', res.message || 'Impossible de charger les visites.');
      }
    } finally {
      setVisitesLoading(false);
    }
  }, [
    visStatusFilter,
    visZoneFilter,
    visAgentFilter,
    visPeriodFilter,
    visSearch,
    visitesPage,
    onCharteRequired,
    notify,
  ]);

  useEffect(() => {
    void loadRefs();
  }, [loadRefs]);

  useEffect(() => {
    void loadDemandes();
  }, [loadDemandes]);

  useEffect(() => {
    void loadVisites();
  }, [loadVisites]);

  const handleRefreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadDemandes(), loadVisites(), loadRefs()]);
    setRefreshing(false);
  }, [loadDemandes, loadVisites, loadRefs]);

  // Debounce léger sur la recherche
  useEffect(() => {
    const t = setTimeout(() => {
      setDemSearch(demSearchInput);
      setDemandesPage(1);
    }, 320);
    return () => clearTimeout(t);
  }, [demSearchInput]);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisSearch(visSearchInput);
      setVisitesPage(1);
    }, 320);
    return () => clearTimeout(t);
  }, [visSearchInput]);

  // =========================================================================
  // ACTIONS COMMUNES : COORDONNÉES & HISTORIQUE
  // =========================================================================
  const handleReadCoordonnees = async (
    type: 'visite' | 'demande_client',
    id: number,
    reference: string
  ) => {
    const k = `coord-${type}-${id}`;
    if (busyKey) return;
    setBusyKey(k);
    try {
      const res = await adminApi.getDossierCoordonnees(type, id);
      if (res.success && res.data) {
        setUnmaskedInfo(res.data);
      } else if (res.demasquage_requis) {
        setDemasquageMotif(type === 'visite' ? 'Coordination visite terrain' : 'Proposition de biens compatibles');
        setDemasquageJustif(`Contacter le client pour le traitement opérationnel du dossier ${reference}.`);
        setDemasquagePrompt({
          type,
          id,
          reference,
          message:
            res.message ||
            'Les coordonnées client sont protégées. Soumettez une demande de démasquage temporaire (TTL) au Super Administrateur Principal.',
        });
      } else {
        notify('error', 'Accès refusé', res.message || 'Impossible de consulter les coordonnées.');
      }
    } finally {
      setBusyKey(null);
    }
  };

  const submitDemasquageRequest = async () => {
    if (!demasquagePrompt) return;
    if (demasquageMotif.trim().length < 3 || demasquageJustif.trim().length < 10) {
      notify('error', 'Validation', 'Veuillez saisir un motif et une justification d’au moins 10 caractères.');
      return;
    }
    const k = `demasq-submit-${demasquagePrompt.id}`;
    if (busyKey) return;
    setBusyKey(k);
    try {
      const res = await adminApi.demanderDemasquage({
        type_dossier: demasquagePrompt.type,
        dossier_id: demasquagePrompt.id,
        motif: demasquageMotif.trim(),
        justification: demasquageJustif.trim(),
      });
      if (res.success) {
        setDemasquagePrompt(null);
        notify('success', 'Demande TTL envoyée', res.message || 'Votre demande de démasquage a été transmise.');
      } else {
        notify('info', 'Information', res.message || 'Demande non soumise.');
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleOpenHistory = async (type: 'visite' | 'demande', id: number, reference: string) => {
    setHistoryModal({ reference, loading: true, entries: [] });
    const res =
      type === 'visite'
        ? await adminApi.getVisiteHistorique(id)
        : await adminApi.getDemandeHistorique(id);

    if (res.success && Array.isArray(res.data)) {
      setHistoryModal({ reference, loading: false, entries: res.data });
    } else {
      setHistoryModal(null);
      notify('error', 'Historique indisponible', res.message || 'Impossible de charger l’historique.');
    }
  };

  // =========================================================================
  // ACTIONS DEMANDES DE RECHERCHE & MATCHING
  // =========================================================================
  const executeTakeCharge = async () => {
    if (!confirmTakeDemande || busyKey) return;
    const id = confirmTakeDemande.id;
    setBusyKey(`take-${id}`);
    try {
      const res = await adminApi.prendreEnChargeDemande(id);
      if (res.success) {
        setConfirmTakeDemande(null);
        notify('success', 'Prise en charge confirmée', res.message || `Demande ${confirmTakeDemande.reference_dossier} attribuée.`);
        await loadDemandes();
      } else {
        setConfirmTakeDemande(null);
        notify('error', 'Prise en charge impossible', res.message || 'Action refusée.');
      }
    } finally {
      setBusyKey(null);
    }
  };

  const executeReassign = async () => {
    if (!reassignModal || busyKey) return;
    setBusyKey(`reassign-${reassignModal.demande.id}`);
    try {
      const res = await adminApi.prendreEnChargeDemande(reassignModal.demande.id, {
        gestionnaire_id: reassignModal.agentId,
        force_reassign: true,
      });
      if (res.success) {
        setReassignModal(null);
        notify('success', 'Réattribution effectuée', res.message || 'Demande réattribuée avec succès.');
        await loadDemandes();
      } else {
        notify('error', 'Échec réattribution', res.message || 'Action impossible.');
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleOpenMatching = async (demande: AdminDemandeClientItem) => {
    setMatchingModal({
      demande,
      loading: true,
      suggestions: [],
      associated: demande.biens_associes || [],
      selectedIds: [],
      noteAgent: '',
      notifierClient: true,
    });

    const res = await adminApi.getMatchingBiens(demande.id);
    if (res.success) {
      const raw = res as any;
      const suggestions: MatchingPropertySuggestion[] = raw.biens_suggeres || raw.data?.biens_suggeres || [];
      const associated: AssociatedPropertySummary[] = raw.biens_associes || raw.data?.biens_associes || demande.biens_associes || [];
      setMatchingModal((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              suggestions,
              associated,
            }
          : null
      );
    } else {
      setMatchingModal(null);
      notify('error', 'Matching impossible', res.message || 'Impossible de lancer le rapprochement.');
    }
  };

  const toggleSelectProperty = (propId: number) => {
    setMatchingModal((prev) => {
      if (!prev) return null;
      const exists = prev.selectedIds.includes(propId);
      return {
        ...prev,
        selectedIds: exists
          ? prev.selectedIds.filter((id) => id !== propId)
          : [...prev.selectedIds, propId],
      };
    });
  };

  const executeAssociateSelected = async () => {
    if (!matchingModal || matchingModal.selectedIds.length === 0 || busyKey) return;
    setBusyKey(`assoc-${matchingModal.demande.id}`);
    try {
      const res = await adminApi.associerBienDemande(
        matchingModal.demande.id,
        matchingModal.selectedIds,
        {
          note_agent: matchingModal.noteAgent.trim() || undefined,
          notifier_client: matchingModal.notifierClient,
        }
      );
      if (res.success) {
        notify('success', 'Biens associés', res.message || 'Les biens sélectionnés ont été rattachés à la demande.');
        setMatchingModal(null);
        await loadDemandes();
      } else {
        notify('error', 'Association refusée', res.message || 'Action impossible.');
      }
    } finally {
      setBusyKey(null);
    }
  };

  const executeCloseDemande = async () => {
    if (!closeDemandeModal || busyKey) return;
    const { demande, motif, details } = closeDemandeModal;
    if (motif === 'abandonnee_client' && details.trim().length < 5) {
      notify('error', 'Motif requis', 'Veuillez indiquer le motif d’abandon du client (minimum 5 caractères).');
      return;
    }
    setBusyKey(`close-${demande.id}`);
    try {
      const res = await adminApi.cloturerDemande(demande.id, motif, details.trim() || undefined);
      if (res.success) {
        setCloseDemandeModal(null);
        notify('success', 'Statut mis à jour', res.message || 'Demande clôturée avec succès.');
        await loadDemandes();
      } else {
        notify('error', 'Clôture refusée', res.message || 'Impossible de clôturer cette demande.');
      }
    } finally {
      setBusyKey(null);
    }
  };

  // =========================================================================
  // ACTIONS VISITES PHYSIQUES
  // =========================================================================
  const openVisitModal = (
    visit: AdminVisiteItem,
    mode: 'planifier' | 'cr' | 'cloturer' | 'escalade' | 'zone' | 'statut'
  ) => {
    setVisitActionModal({ visit, mode });
    if (mode === 'planifier') {
      const defaultDate = visit.scheduled_date
        ? visit.scheduled_date.slice(0, 16).replace('T', ' ')
        : new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
      setVDateInput(defaultDate);
      setVInstructions(visit.instructions_itineraire || '');
      setVAgentId(visit.target_agent_id ?? null);
    } else if (mode === 'cr') {
      setVCrInput(visit.compte_rendu || '');
    } else if (mode === 'cloturer') {
      setVClotureIssue('succes_offre');
      setVMotif('');
    } else if (mode === 'escalade') {
      setVEscaladeAmount(visit.offre_montant ? String(visit.offre_montant) : '');
      setVEscaladeNote('');
    } else if (mode === 'zone') {
      setVZoneId(visit.zone_id || zones[0]?.id || 1);
      setVAgentId(visit.target_agent_id ?? null);
    } else if (mode === 'statut') {
      const next = (visit.allowed_transitions || [])[0] as any;
      setVStatusChoice(next || 'confirmed');
      setVMotif('');
    }
  };

  const executeVisitAction = async () => {
    if (!visitActionModal || busyKey) return;
    const { visit, mode } = visitActionModal;

    if (mode === 'planifier' && vDateInput.trim().length < 10) {
      notify('error', 'Date requise', 'Veuillez saisir une date et heure valide (AAAA-MM-JJ HH:MM).');
      return;
    }
    if (mode === 'cr' && vCrInput.trim().length < 10) {
      notify('error', 'Compte-rendu trop court', 'Le compte-rendu terrain doit contenir au moins 10 caractères.');
      return;
    }
    if (mode === 'escalade' && vEscaladeNote.trim().length < 5) {
      notify('error', 'Commentaire requis', 'Veuillez détailler l’offre (minimum 5 caractères).');
      return;
    }

    setBusyKey(`visit-${mode}-${visit.id}`);
    try {
      let res: any;
      if (mode === 'planifier') {
        res = await adminApi.planifierVisite(visit.id, {
          scheduled_date: vDateInput.trim(),
          instructions_itineraire: vInstructions.trim() || undefined,
          target_agent_id: vAgentId || undefined,
        });
      } else if (mode === 'cr') {
        res = await adminApi.saisirCompteRendu(visit.id, vCrInput.trim());
      } else if (mode === 'cloturer') {
        res = await adminApi.cloturerVisite(visit.id, vClotureIssue, vMotif.trim() || undefined);
      } else if (mode === 'escalade') {
        res = await adminApi.escaladerOffreVisite(
          visit.id,
          vEscaladeNote.trim(),
          vEscaladeAmount ? Number(vEscaladeAmount) : undefined
        );
      } else if (mode === 'zone') {
        res = await adminApi.assignerZoneVisite(visit.id, vZoneId, vAgentId);
      } else if (mode === 'statut') {
        res = await adminApi.updateAdminVisiteStatut(visit.id, vStatusChoice, vMotif.trim() || undefined);
      }

      if (res?.success) {
        setVisitActionModal(null);
        notify('success', 'Opération enregistrée', res.message || 'Visite mise à jour avec succès.');
        await loadVisites();
      } else {
        notify('error', 'Action refusée', res?.message || 'Impossible de mettre à jour cette visite.');
      }
    } finally {
      setBusyKey(null);
    }
  };

  // =========================================================================
  // STATISTIQUES EN-TÊTE (8 INDICATEURS RÉELS BDD — PHASE 3B)
  // =========================================================================
  const statCards = useMemo(
    () => [
      {
        key: 'total_demandes',
        label: 'Total demandes',
        value: demandesStats.total_demandes,
        color: UI.text,
        bg: UI.white,
        iconBg: UI.slateSoft,
        Icon: Layers,
        onPress: () => {
          setCurrentTab('demandes');
          setDemStatusFilter('all');
          setDemandesPage(1);
        },
      },
      {
        key: 'en_attente',
        label: 'En attente',
        value: demandesStats.en_attente,
        color: UI.amberText,
        bg: UI.white,
        iconBg: UI.amberSoft,
        Icon: Hourglass,
        onPress: () => {
          setCurrentTab('demandes');
          setDemStatusFilter('en_attente');
          setDemandesPage(1);
        },
      },
      {
        key: 'en_cours',
        label: 'En cours',
        value: demandesStats.en_cours,
        color: UI.blue,
        bg: UI.white,
        iconBg: UI.blueSoft,
        Icon: UserCheck,
        onPress: () => {
          setCurrentTab('demandes');
          setDemStatusFilter('en_cours');
          setDemandesPage(1);
        },
      },
      {
        key: 'satisfaites',
        label: 'Satisfaites',
        value: demandesStats.satisfaites,
        color: UI.green,
        bg: UI.white,
        iconBg: UI.greenSoft,
        Icon: CheckCircle2,
        onPress: () => {
          setCurrentTab('demandes');
          setDemStatusFilter('satisfaite');
          setDemandesPage(1);
        },
      },
      {
        key: 'abandonnees',
        label: 'Abandonnées',
        value: demandesStats.abandonnees,
        color: UI.slate,
        bg: UI.white,
        iconBg: UI.slateSoft,
        Icon: XCircle,
        onPress: () => {
          setCurrentTab('demandes');
          setDemStatusFilter('abandonnee');
          setDemandesPage(1);
        },
      },
      {
        key: 'expirees',
        label: 'Expirées',
        value: demandesStats.expirees,
        color: UI.danger,
        bg: UI.white,
        iconBg: UI.dangerSoft,
        Icon: Clock,
        onPress: () => {
          setCurrentTab('demandes');
          setDemStatusFilter('expiree');
          setDemandesPage(1);
        },
      },
      {
        key: 'visites_prog',
        label: 'Visites programmées',
        value: visitesStats.programmees,
        color: UI.purple,
        bg: UI.white,
        iconBg: UI.purpleSoft,
        Icon: CalendarClock,
        onPress: () => {
          setCurrentTab('visites');
          setVisStatusFilter('confirmed');
          setVisitesPage(1);
        },
      },
      {
        key: 'visites_eff',
        label: 'Visites effectuées',
        value: visitesStats.effectuees,
        color: UI.greenDark,
        bg: UI.white,
        iconBg: UI.greenSoft,
        Icon: CalendarCheck,
        onPress: () => {
          setCurrentTab('visites');
          setVisStatusFilter('completed');
          setVisitesPage(1);
        },
      },
    ],
    [demandesStats, visitesStats, setCurrentTab]
  );

  const hasActiveDemFilters =
    demStatusFilter !== 'all' ||
    demAgentFilter !== 'all' ||
    demPropTypeFilter !== 'all' ||
    demTransTypeFilter !== 'all' ||
    demPeriodFilter !== 'all' ||
    demSearchInput.trim() !== '';

  const hasActiveVisFilters =
    visStatusFilter !== 'all' ||
    visZoneFilter !== 'all' ||
    visAgentFilter !== 'all' ||
    visPeriodFilter !== 'all' ||
    visSearchInput.trim() !== '';

  const resetDemFilters = () => {
    setDemSearchInput('');
    setDemSearch('');
    setDemStatusFilter('all');
    setDemAgentFilter('all');
    setDemPropTypeFilter('all');
    setDemTransTypeFilter('all');
    setDemPeriodFilter('all');
    setDemandesPage(1);
  };

  const resetVisFilters = () => {
    setVisSearchInput('');
    setVisSearch('');
    setVisStatusFilter('all');
    setVisZoneFilter('all');
    setVisAgentFilter('all');
    setVisPeriodFilter('all');
    setVisitesPage(1);
  };

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <View style={styles.root}>
      {/* Toast Notification */}
      {toast && (
        <View
          style={[
            styles.toastBanner,
            toast.type === 'success'
              ? { backgroundColor: UI.greenSoft, borderColor: UI.greenBorder }
              : toast.type === 'error'
              ? { backgroundColor: UI.dangerSoft, borderColor: UI.dangerBorder }
              : { backgroundColor: UI.blueSoft, borderColor: UI.blueBorder },
          ]}>
          {toast.type === 'success' ? (
            <CheckCircle2 size={18} color={UI.green} strokeWidth={2.2} />
          ) : toast.type === 'error' ? (
            <AlertCircle size={18} color={UI.danger} strokeWidth={2.2} />
          ) : (
            <Info size={18} color={UI.blue} strokeWidth={2.2} />
          )}
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.toastTitle,
                { color: toast.type === 'success' ? UI.greenDark : toast.type === 'error' ? UI.danger : UI.blue },
              ]}>
              {toast.title}
            </Text>
            <Text style={styles.toastMsg}>{toast.message}</Text>
          </View>
          <Pressable onPress={() => setToast(null)} hitSlop={8} style={WEB_CURSOR}>
            <X size={16} color={UI.muted} />
          </Pressable>
        </View>
      )}

      {/* A. En-tête opérationnel (Phase 3A) */}
      {!hideHeader && (
        <View style={styles.heroCard}>
          <View style={{ flex: 1, minWidth: 220 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.heroIconWrap}>
                <CalendarCheck size={18} color={UI.green} strokeWidth={2.3} />
              </View>
              <Text style={styles.heroTitle}>Visites &amp; Demandes</Text>
            </View>
            <Text style={styles.heroDesc}>
              Supervisez le cycle complet des visites physiques terrain et pilotez la prise en charge, le matching immobilier et la clôture tracée des demandes de recherche clients.
            </Text>
          </View>
          <Pressable
            onPress={() => void handleRefreshAll()}
            disabled={refreshing}
            {...webTip('Actualiser toutes les données en temps réel')}
            style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.85 }, WEB_CURSOR]}>
            {refreshing ? (
              <ActivityIndicator size="small" color={UI.green} />
            ) : (
              <RefreshCw size={15} color={UI.green} strokeWidth={2.2} />
            )}
            <Text style={styles.refreshBtnText}>Actualiser</Text>
          </Pressable>
        </View>
      )}

      {/* B. Indicateurs statistiques temps réel (8 cartes — Phase 3B) */}
      <View style={styles.statsGrid}>
        {statCards.map((sc) => {
          const IconComp = sc.Icon;
          return (
            <Pressable
              key={sc.key}
              onPress={sc.onPress}
              {...webTip(`Filtrer par : ${sc.label}`)}
              style={({ pressed }) => [
                styles.statCard,
                { flexBasis: isDesktop ? '23.5%' : isSmallMobile ? '47%' : '31%' },
                pressed && { borderColor: UI.green, backgroundColor: '#FAFCFB' },
                WEB_CURSOR,
              ]}>
              <View style={[styles.statIconBox, { backgroundColor: sc.iconBg }]}>
                <IconComp size={16} color={sc.color} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.statValue, { color: sc.color }]}>{sc.value}</Text>
                <Text numberOfLines={1} style={styles.statLabel}>
                  {sc.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* C. Barre d'onglets améliorée avec compteurs (Phase 3C) */}
      <View style={styles.tabsBar}>
        <Pressable
          onPress={() => setCurrentTab('visites')}
          style={[styles.tabBtn, currentTab === 'visites' && styles.tabBtnActive, WEB_CURSOR]}>
          <CalendarCheck
            size={16}
            color={currentTab === 'visites' ? UI.white : UI.textSecondary}
            strokeWidth={2.2}
          />
          <Text style={[styles.tabBtnText, currentTab === 'visites' && styles.tabBtnTextActive]}>
            Visites physiques
          </Text>
          <View style={[styles.tabCounter, currentTab === 'visites' && styles.tabCounterActive]}>
            <Text style={[styles.tabCounterText, currentTab === 'visites' && styles.tabCounterTextActive]}>
              {visitesStats.total_visites}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => setCurrentTab('demandes')}
          style={[styles.tabBtn, currentTab === 'demandes' && styles.tabBtnActive, WEB_CURSOR]}>
          <Sparkles
            size={16}
            color={currentTab === 'demandes' ? UI.white : UI.textSecondary}
            strokeWidth={2.2}
          />
          <Text style={[styles.tabBtnText, currentTab === 'demandes' && styles.tabBtnTextActive]}>
            Demandes de recherche &amp; Matching
          </Text>
          <View style={[styles.tabCounter, currentTab === 'demandes' && styles.tabCounterActive]}>
            <Text style={[styles.tabCounterText, currentTab === 'demandes' && styles.tabCounterTextActive]}>
              {demandesStats.total_demandes}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* =================================================================== */}
      {/* ONGLET 1 : VISITES PHYSIQUES (PHASE 5)                              */}
      {/* =================================================================== */}
      {currentTab === 'visites' && (
        <View style={{ gap: 14 }}>
          {/* Barre recherche & filtres Visites */}
          <View style={styles.filterCard}>
            <View style={styles.searchRow}>
              <View style={styles.searchInputWrap}>
                <Search size={16} color={UI.muted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Rechercher par référence (VIS-00001), bien, commune, client, agent..."
                  placeholderTextColor={UI.muted}
                  value={visSearchInput}
                  onChangeText={setVisSearchInput}
                />
                {visSearchInput.length > 0 && (
                  <Pressable onPress={() => setVisSearchInput('')} hitSlop={8} style={WEB_CURSOR}>
                    <X size={15} color={UI.muted} />
                  </Pressable>
                )}
              </View>
              <Pressable
                onPress={() => setShowVisFilters((v) => !v)}
                style={[styles.filterToggleBtn, showVisFilters && styles.filterToggleBtnActive, WEB_CURSOR]}>
                <Filter size={15} color={showVisFilters ? UI.green : UI.textSecondary} />
                <Text style={[styles.filterToggleText, showVisFilters && { color: UI.green }]}>
                  Filtres
                </Text>
              </Pressable>
              {hasActiveVisFilters && (
                <Pressable onPress={resetVisFilters} style={[styles.resetBtn, WEB_CURSOR]}>
                  <X size={14} color={UI.danger} />
                  <Text style={styles.resetBtnText}>Réinitialiser</Text>
                </Pressable>
              )}
            </View>

            {/* Filtres rapides par statut */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              {[
                { key: 'all', label: `Toutes (${visitesStats.total_visites})` },
                { key: 'pending', label: `En attente (${visitesStats.en_attente})` },
                { key: 'confirmed', label: `Programmées (${visitesStats.programmees})` },
                { key: 'completed', label: `Effectuées (${visitesStats.effectuees})` },
                { key: 'cancelled', label: `Annulées (${visitesStats.annulees})` },
              ].map((st) => {
                const active = visStatusFilter === st.key;
                return (
                  <Pressable
                    key={st.key}
                    onPress={() => {
                      setVisStatusFilter(st.key);
                      setVisitesPage(1);
                    }}
                    style={[styles.filterPill, active && styles.filterPillActive, WEB_CURSOR]}>
                    <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                      {st.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Filtres avancés Visites */}
            {showVisFilters && (
              <View style={styles.advancedFiltersWrap}>
                <View style={styles.filterGroup}>
                  <Text style={styles.filterGroupLabel}>Zone géographique</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                    <Pressable
                      onPress={() => {
                        setVisZoneFilter('all');
                        setVisitesPage(1);
                      }}
                      style={[styles.miniPill, visZoneFilter === 'all' && styles.miniPillActive, WEB_CURSOR]}>
                      <Text style={[styles.miniPillText, visZoneFilter === 'all' && styles.miniPillTextActive]}>
                        Toutes zones
                      </Text>
                    </Pressable>
                    {zones.map((z) => (
                      <Pressable
                        key={z.id}
                        onPress={() => {
                          setVisZoneFilter(String(z.id));
                          setVisitesPage(1);
                        }}
                        style={[styles.miniPill, visZoneFilter === String(z.id) && styles.miniPillActive, WEB_CURSOR]}>
                        <Text style={[styles.miniPillText, visZoneFilter === String(z.id) && styles.miniPillTextActive]}>
                          {z.nom}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.filterGroup}>
                  <Text style={styles.filterGroupLabel}>Agent responsable</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                    {[
                      { k: 'all', l: 'Tous agents' },
                      { k: 'me', l: 'Mes visites' },
                      { k: 'unassigned', l: 'Non assignées' },
                      ...agents.map((a) => ({ k: String(a.id), l: a.nom_complet })),
                    ].map((ag) => (
                      <Pressable
                        key={ag.k}
                        onPress={() => {
                          setVisAgentFilter(ag.k);
                          setVisitesPage(1);
                        }}
                        style={[styles.miniPill, visAgentFilter === ag.k && styles.miniPillActive, WEB_CURSOR]}>
                        <Text style={[styles.miniPillText, visAgentFilter === ag.k && styles.miniPillTextActive]}>
                          {ag.l}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.filterGroup}>
                  <Text style={styles.filterGroupLabel}>Période</Text>
                  <View style={styles.pillRow}>
                    {[
                      { k: 'all', l: 'Toutes dates' },
                      { k: 'today', l: "Aujourd'hui" },
                      { k: 'week', l: '7 derniers jours' },
                      { k: 'month', l: 'Ce mois' },
                    ].map((p) => (
                      <Pressable
                        key={p.k}
                        onPress={() => {
                          setVisPeriodFilter(p.k);
                          setVisitesPage(1);
                        }}
                        style={[styles.miniPill, visPeriodFilter === p.k && styles.miniPillActive, WEB_CURSOR]}>
                        <Text style={[styles.miniPillText, visPeriodFilter === p.k && styles.miniPillTextActive]}>
                          {p.l}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Liste des visites */}
          {visitesLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={UI.green} />
              <Text style={styles.loadingText}>Chargement des visites physiques...</Text>
            </View>
          ) : visites.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <CalendarCheck size={28} color={UI.green} strokeWidth={1.8} />
              </View>
              <Text style={styles.emptyTitle}>
                {hasActiveVisFilters ? 'Aucune visite ne correspond à vos filtres' : 'Aucune visite physique enregistrée'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {hasActiveVisFilters
                  ? 'Essayez d’élargir vos critères de recherche ou de réinitialiser les filtres.'
                  : 'Les demandes de visites payées par les clients apparaîtront automatiquement ici pour planification et suivi terrain.'}
              </Text>
              {hasActiveVisFilters && (
                <Pressable onPress={resetVisFilters} style={[styles.btnPrimary, WEB_CURSOR]}>
                  <Text style={styles.btnPrimaryText}>Afficher toutes les visites</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {visites.map((v) => {
                const stMeta = getVisiteStatusMeta(v.status);
                const perm = v.permissions;
                const propPhoto = v.propriete?.photo_url
                  ? resolveStorageUrl(v.propriete.photo_url, storageBaseUrl)
                  : null;

                return (
                  <View key={v.id} style={[styles.itemCard, { borderLeftColor: stMeta.accent }]}>
                    {/* En-tête carte visite */}
                    <View style={styles.itemHeader}>
                      <View style={styles.itemHeaderLeft}>
                        <Text style={styles.refText}>{v.reference_visite}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: stMeta.bg, borderColor: stMeta.border }]}>
                          <View style={[styles.statusDot, { backgroundColor: stMeta.accent }]} />
                          <Text style={[styles.statusBadgeText, { color: stMeta.text }]}>{stMeta.label}</Text>
                        </View>
                        <View
                          style={[
                            styles.metaPill,
                            v.is_fee_paid
                              ? { backgroundColor: UI.greenSoft, borderColor: UI.greenBorder }
                              : { backgroundColor: UI.amberSoft, borderColor: UI.amberBorder },
                          ]}>
                          <Text
                            style={[
                              styles.metaPillText,
                              { color: v.is_fee_paid ? UI.greenDark : UI.amberText },
                            ]}>
                            {v.statut_paiement}
                          </Text>
                        </View>
                        {v.is_escalade_haute && (
                          <View style={[styles.metaPill, { backgroundColor: '#FFF7ED', borderColor: '#FDBA74' }]}>
                            <Flame size={12} color="#C2410C" />
                            <Text style={[styles.metaPillText, { color: '#C2410C' }]}>
                              Offre escaladée{v.offre_montant ? ` • ${formatFcfa(v.offre_montant)}` : ''}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.dateRow}>
                        <Calendar size={13} color={UI.muted} />
                        <Text style={styles.dateText}>
                          RDV : {formatDateTimeFr(v.scheduled_date)}
                        </Text>
                      </View>
                    </View>

                    {/* Corps structuré */}
                    <View style={[styles.cardGrid, isDesktop && styles.cardGridDesktop]}>
                      {/* Colonne Bien concerné & Lieu */}
                      <View style={styles.cardCol}>
                        <Text style={styles.colHeading}>BIEN CONCERNÉ &amp; RENDEZ-VOUS</Text>
                        <View style={styles.propMiniRow}>
                          {propPhoto ? (
                            <Image source={{ uri: propPhoto }} style={styles.propThumb} contentFit="cover" />
                          ) : (
                            <View style={styles.propThumbPlaceholder}>
                              <Building2 size={20} color={UI.muted} />
                            </View>
                          )}
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={styles.propTitle}>
                              {v.propriete
                                ? `Bien #${v.propriete.id} — ${v.propriete.type.toUpperCase()} (${v.propriete.transaction_type})`
                                : `Bien #${v.property_id}`}
                            </Text>
                            {v.propriete && (
                              <>
                                <View style={styles.inlineMeta}>
                                  <MapPin size={13} color={UI.green} />
                                  <Text style={styles.infoText}>
                                    {[v.propriete.commune, v.propriete.arrondissement, v.propriete.quartier]
                                      .filter(Boolean)
                                      .join(' • ')}
                                  </Text>
                                </View>
                                <Text style={styles.budgetValue}>{formatFcfa(v.propriete.prix)}</Text>
                              </>
                            )}
                          </View>
                        </View>

                        {v.instructions_itineraire ? (
                          <View style={styles.noteBox}>
                            <Text style={styles.noteBoxLabel}>Lieu de rendez-vous / Consignes :</Text>
                            <Text style={styles.noteBoxText}>{v.instructions_itineraire}</Text>
                          </View>
                        ) : null}

                        {v.compte_rendu ? (
                          <View style={[styles.noteBox, { backgroundColor: UI.greenSoft, borderColor: UI.greenBorder }]}>
                            <Text style={[styles.noteBoxLabel, { color: UI.greenDark }]}>Compte-rendu terrain :</Text>
                            <Text style={styles.noteBoxText}>{v.compte_rendu}</Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Colonne Suivi Client / Agent / Zone */}
                      <View style={styles.cardCol}>
                        <Text style={styles.colHeading}>SUIVI &amp; AFFECTATION</Text>
                        <View style={styles.infoList}>
                          <View style={styles.infoPair}>
                            <Users size={14} color={UI.muted} />
                            <Text style={styles.infoLabel}>Client :</Text>
                            <Text style={styles.infoValue}>
                              {v.client?.nom_complet || '—'}
                              {v.donnees_masquees ? '' : v.client?.telephone ? ` (${v.client.telephone})` : ''}
                            </Text>
                            {v.donnees_masquees && <Lock size={12} color={UI.amber} />}
                          </View>

                          <View style={styles.infoPair}>
                            <UserCheck size={14} color={v.agent_assigne ? UI.green : UI.muted} />
                            <Text style={styles.infoLabel}>Agent responsable :</Text>
                            <Text style={[styles.infoValue, !v.agent_assigne && { color: UI.amberText }]}>
                              {v.agent_assigne?.nom_complet || 'Non assigné'}
                            </Text>
                          </View>

                          <View style={styles.infoPair}>
                            <MapPin size={14} color={UI.muted} />
                            <Text style={styles.infoLabel}>Zone :</Text>
                            <Text style={styles.infoValue}>
                              {v.zone ? `${v.zone.nom} (${v.zone.code})` : 'Non assignée'}
                            </Text>
                          </View>

                          {v.issue_cloture && (
                            <View style={styles.infoPair}>
                              <ShieldCheck size={14} color={UI.green} />
                              <Text style={styles.infoLabel}>Issue clôture :</Text>
                              <Text style={[styles.infoValue, { color: UI.greenDark }]}>
                                {getIssueLabel(v.issue_cloture)}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Actions contextuelles selon le cycle de vie réel */}
                    <View style={styles.actionsFooter}>
                      {perm?.can_plan && (
                        <Pressable
                          onPress={() => openVisitModal(v, 'planifier')}
                          {...webTip('Planifier la date, le lieu de RDV et convoquer le client')}
                          style={[styles.actBtnPrimary, WEB_CURSOR]}>
                          <CalendarClock size={14} color={UI.white} />
                          <Text style={styles.actBtnPrimaryText}>
                            {v.status === 'pending' ? 'Planifier & Confirmer' : 'Replanifier'}
                          </Text>
                        </Pressable>
                      )}

                      {perm?.can_report && (
                        <Pressable
                          onPress={() => openVisitModal(v, 'cr')}
                          {...webTip('Consigner le compte-rendu terrain et marquer effectuée')}
                          style={[styles.actBtnSoftGreen, WEB_CURSOR]}>
                          <FileText size={14} color={UI.greenDark} />
                          <Text style={styles.actBtnSoftGreenText}>Compte-rendu</Text>
                        </Pressable>
                      )}

                      {perm?.can_close && (
                        <Pressable
                          onPress={() => openVisitModal(v, 'cloturer')}
                          {...webTip('Clôturer formellement la visite avec son issue')}
                          style={[styles.actBtnAmber, WEB_CURSOR]}>
                          <CheckCircle2 size={14} color={UI.amberText} />
                          <Text style={styles.actBtnAmberText}>Clôturer</Text>
                        </Pressable>
                      )}

                      {perm?.can_escalate && (
                        <Pressable
                          onPress={() => openVisitModal(v, 'escalade')}
                          {...webTip('Alerter le Super Admin Principal pour une offre majeure')}
                          style={[styles.actBtnOrange, WEB_CURSOR]}>
                          <Flame size={14} color="#9A3412" />
                          <Text style={styles.actBtnOrangeText}>Escalader offre</Text>
                        </Pressable>
                      )}

                      {perm?.can_assign_zone && (
                        <Pressable
                          onPress={() => openVisitModal(v, 'zone')}
                          {...webTip('Assigner une zone géographique et un agent')}
                          style={[styles.actBtnOutline, WEB_CURSOR]}>
                          <MapPin size={14} color={UI.textSecondary} />
                          <Text style={styles.actBtnOutlineText}>Zone &amp; Agent</Text>
                        </Pressable>
                      )}

                      {perm?.can_change_status && (
                        <Pressable
                          onPress={() => openVisitModal(v, 'statut')}
                          {...webTip('Modifier le statut selon les transitions autorisées')}
                          style={[styles.actBtnOutline, WEB_CURSOR]}>
                          <UserCog size={14} color={UI.textSecondary} />
                          <Text style={styles.actBtnOutlineText}>Statut</Text>
                        </Pressable>
                      )}

                      <Pressable
                        onPress={() => void handleReadCoordonnees('visite', v.id, v.reference_visite)}
                        disabled={busyKey === `coord-visite-${v.id}`}
                        {...webTip('Consulter les coordonnées client (accès tracé)')}
                        style={[styles.actBtnOutline, WEB_CURSOR]}>
                        {busyKey === `coord-visite-${v.id}` ? (
                          <ActivityIndicator size="small" color={UI.green} />
                        ) : (
                          <Phone size={14} color={UI.textSecondary} />
                        )}
                        <Text style={styles.actBtnOutlineText}>Coordonnées</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => void handleOpenHistory('visite', v.id, v.reference_visite)}
                        {...webTip('Consulter le journal d’audit de cette visite')}
                        style={[styles.actBtnGhost, WEB_CURSOR]}>
                        <History size={14} color={UI.muted} />
                        <Text style={styles.actBtnGhostText}>Historique</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}

              {/* Pagination Visites */}
              {visitesLastPage > 1 && (
                <View style={styles.paginationRow}>
                  <Text style={styles.paginationInfo}>
                    {visitesTotalFiltered} visite(s) • Page {visitesPage} / {visitesLastPage}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      disabled={visitesPage <= 1}
                      onPress={() => setVisitesPage((p) => Math.max(1, p - 1))}
                      style={[styles.pageBtn, visitesPage <= 1 && styles.pageBtnDisabled, WEB_CURSOR]}>
                      <ChevronLeft size={15} color={UI.text} />
                      <Text style={styles.pageBtnText}>Précédent</Text>
                    </Pressable>
                    <Pressable
                      disabled={visitesPage >= visitesLastPage}
                      onPress={() => setVisitesPage((p) => Math.min(visitesLastPage, p + 1))}
                      style={[styles.pageBtn, visitesPage >= visitesLastPage && styles.pageBtnDisabled, WEB_CURSOR]}>
                      <Text style={styles.pageBtnText}>Suivant</Text>
                      <ChevronRight size={15} color={UI.text} />
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* =================================================================== */}
      {/* ONGLET 2 : DEMANDES DE RECHERCHE & MATCHING (PHASES 3D, 3E & 4)     */}
      {/* =================================================================== */}
      {currentTab === 'demandes' && (
        <View style={{ gap: 14 }}>
          {/* Barre recherche & filtres Demandes */}
          <View style={styles.filterCard}>
            <View style={styles.searchRow}>
              <View style={styles.searchInputWrap}>
                <Search size={16} color={UI.muted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Rechercher par référence (DEM-00046), client, type de bien, commune, quartier..."
                  placeholderTextColor={UI.muted}
                  value={demSearchInput}
                  onChangeText={setDemSearchInput}
                />
                {demSearchInput.length > 0 && (
                  <Pressable onPress={() => setDemSearchInput('')} hitSlop={8} style={WEB_CURSOR}>
                    <X size={15} color={UI.muted} />
                  </Pressable>
                )}
              </View>
              <Pressable
                onPress={() => setShowDemFilters((v) => !v)}
                style={[styles.filterToggleBtn, showDemFilters && styles.filterToggleBtnActive, WEB_CURSOR]}>
                <Filter size={15} color={showDemFilters ? UI.green : UI.textSecondary} />
                <Text style={[styles.filterToggleText, showDemFilters && { color: UI.green }]}>
                  Filtres
                </Text>
              </Pressable>
              {hasActiveDemFilters && (
                <Pressable onPress={resetDemFilters} style={[styles.resetBtn, WEB_CURSOR]}>
                  <X size={14} color={UI.danger} />
                  <Text style={styles.resetBtnText}>Réinitialiser</Text>
                </Pressable>
              )}
            </View>

            {/* Filtres rapides par statut */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              {[
                { key: 'all', label: `Toutes (${demandesStats.total_demandes})` },
                { key: 'en_attente', label: `En attente (${demandesStats.en_attente})` },
                { key: 'en_cours', label: `En cours (${demandesStats.en_cours})` },
                { key: 'satisfaite', label: `Satisfaites (${demandesStats.satisfaites})` },
                { key: 'abandonnee', label: `Abandonnées (${demandesStats.abandonnees})` },
                { key: 'expiree', label: `Expirées (${demandesStats.expirees})` },
              ].map((st) => {
                const active = demStatusFilter === st.key;
                return (
                  <Pressable
                    key={st.key}
                    onPress={() => {
                      setDemStatusFilter(st.key);
                      setDemandesPage(1);
                    }}
                    style={[styles.filterPill, active && styles.filterPillActive, WEB_CURSOR]}>
                    <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                      {st.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Filtres avancés Demandes (Phase 3E) */}
            {showDemFilters && (
              <View style={styles.advancedFiltersWrap}>
                <View style={styles.filterGroup}>
                  <Text style={styles.filterGroupLabel}>Agent responsable</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                    {[
                      { k: 'all', l: 'Tous agents' },
                      { k: 'me', l: 'Mes dossiers' },
                      { k: 'unassigned', l: 'Non attribuées' },
                      ...agents.map((a) => ({ k: String(a.id), l: a.nom_complet })),
                    ].map((ag) => (
                      <Pressable
                        key={ag.k}
                        onPress={() => {
                          setDemAgentFilter(ag.k);
                          setDemandesPage(1);
                        }}
                        style={[styles.miniPill, demAgentFilter === ag.k && styles.miniPillActive, WEB_CURSOR]}>
                        <Text style={[styles.miniPillText, demAgentFilter === ag.k && styles.miniPillTextActive]}>
                          {ag.l}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                  <View style={styles.filterGroup}>
                    <Text style={styles.filterGroupLabel}>Type de bien</Text>
                    <View style={styles.pillRow}>
                      {[
                        { k: 'all', l: 'Tous' },
                        { k: 'maison', l: 'Maison' },
                        { k: 'parcelle', l: 'Parcelle' },
                        { k: 'chambre', l: 'Chambre' },
                      ].map((pt) => (
                        <Pressable
                          key={pt.k}
                          onPress={() => {
                            setDemPropTypeFilter(pt.k);
                            setDemandesPage(1);
                          }}
                          style={[styles.miniPill, demPropTypeFilter === pt.k && styles.miniPillActive, WEB_CURSOR]}>
                          <Text style={[styles.miniPillText, demPropTypeFilter === pt.k && styles.miniPillTextActive]}>
                            {pt.l}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.filterGroup}>
                    <Text style={styles.filterGroupLabel}>Nature</Text>
                    <View style={styles.pillRow}>
                      {[
                        { k: 'all', l: 'Toutes' },
                        { k: 'location', l: 'Location' },
                        { k: 'vente', l: 'Vente' },
                      ].map((tt) => (
                        <Pressable
                          key={tt.k}
                          onPress={() => {
                            setDemTransTypeFilter(tt.k);
                            setDemandesPage(1);
                          }}
                          style={[styles.miniPill, demTransTypeFilter === tt.k && styles.miniPillActive, WEB_CURSOR]}>
                          <Text style={[styles.miniPillText, demTransTypeFilter === tt.k && styles.miniPillTextActive]}>
                            {tt.l}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.filterGroup}>
                    <Text style={styles.filterGroupLabel}>Période de publication</Text>
                    <View style={styles.pillRow}>
                      {[
                        { k: 'all', l: 'Tout' },
                        { k: 'today', l: "Aujourd'hui" },
                        { k: 'week', l: '7 jours' },
                        { k: 'month', l: 'Ce mois' },
                      ].map((p) => (
                        <Pressable
                          key={p.k}
                          onPress={() => {
                            setDemPeriodFilter(p.k);
                            setDemandesPage(1);
                          }}
                          style={[styles.miniPill, demPeriodFilter === p.k && styles.miniPillActive, WEB_CURSOR]}>
                          <Text style={[styles.miniPillText, demPeriodFilter === p.k && styles.miniPillTextActive]}>
                            {p.l}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Liste des cartes de Demandes (Phase 3D) */}
          {demandesLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={UI.green} />
              <Text style={styles.loadingText}>Chargement des demandes de recherche...</Text>
            </View>
          ) : demandes.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Sparkles size={28} color={UI.green} strokeWidth={1.8} />
              </View>
              <Text style={styles.emptyTitle}>
                {hasActiveDemFilters
                  ? 'Aucune demande ne correspond à votre recherche'
                  : 'Aucune demande de recherche enregistrée'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {hasActiveDemFilters
                  ? 'Modifiez vos filtres ou réinitialisez la recherche pour voir l’ensemble des demandes.'
                  : 'Les demandes de recherche publiées par les clients apparaîtront ici pour prise en charge et rapprochement.'}
              </Text>
              {hasActiveDemFilters && (
                <Pressable onPress={resetDemFilters} style={[styles.btnPrimary, WEB_CURSOR]}>
                  <Text style={styles.btnPrimaryText}>Réinitialiser les filtres</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {demandes.map((d) => {
                const ws = d.workflow_status || (d.gestionnaire_id ? 'en_cours' : 'en_attente');
                const stMeta = getDemandeStatusMeta(ws);
                const perm = d.permissions;
                const locParts = [
                  d.target_commune,
                  d.target_arrondissement ? `Arr. ${d.target_arrondissement}` : null,
                  d.target_quartier,
                ].filter(Boolean);
                const matchesCount = d.biens_correspondants_count ?? 0;
                const assocCount = d.biens_associes_count ?? 0;

                return (
                  <View key={d.id} style={[styles.itemCard, { borderLeftColor: stMeta.accent }]}>
                    {/* En-tête de la carte */}
                    <View style={styles.itemHeader}>
                      <View style={styles.itemHeaderLeft}>
                        <Text style={styles.refText}>{d.reference_dossier}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: stMeta.bg, borderColor: stMeta.border }]}>
                          <View style={[styles.statusDot, { backgroundColor: stMeta.accent }]} />
                          <Text style={[styles.statusBadgeText, { color: stMeta.text }]}>{stMeta.label}</Text>
                        </View>
                        <View style={styles.typePill}>
                          <Home size={12} color={UI.greenDark} />
                          <Text style={styles.typePillText}>{d.property_type.toUpperCase()}</Text>
                        </View>
                        <View
                          style={[
                            styles.metaPill,
                            d.transaction_type === 'vente'
                              ? { backgroundColor: UI.purpleSoft, borderColor: UI.purpleBorder }
                              : { backgroundColor: UI.blueSoft, borderColor: UI.blueBorder },
                          ]}>
                          <Text
                            style={[
                              styles.metaPillText,
                              { color: d.transaction_type === 'vente' ? UI.purple : UI.blue },
                            ]}>
                            {d.transaction_type === 'vente' ? 'Vente' : 'Location'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.dateColumn}>
                        <Text style={styles.dateText}>Publiée le {formatDateTimeFr(d.created_at)}</Text>
                        {d.expires_at && ws !== 'satisfaite' && ws !== 'abandonnee' && (
                          <Text
                            style={[
                              styles.expiryText,
                              d.is_expired ? { color: UI.danger } : { color: UI.muted },
                            ]}>
                            {d.is_expired
                              ? `Échéance dépassée (${formatDateFr(d.expires_at)})`
                              : `Valide jusqu'au ${formatDateFr(d.expires_at)}`}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Corps structuré en 2 colonnes */}
                    <View style={[styles.cardGrid, isDesktop && styles.cardGridDesktop]}>
                      {/* Informations principales */}
                      <View style={styles.cardCol}>
                        <Text style={styles.colHeading}>CRITÈRES DE RECHERCHE</Text>
                        <View style={styles.budgetRow}>
                          <Text style={styles.budgetLabel}>Budget max :</Text>
                          <Text style={styles.budgetValue}>{formatFcfa(d.budget_max)}</Text>
                        </View>
                        <View style={styles.inlineMeta}>
                          <MapPin size={14} color={UI.green} />
                          <Text style={styles.infoValue}>{locParts.join(' • ') || 'Non précisée'}</Text>
                        </View>
                        {d.zone && (
                          <Text style={styles.subInfoText}>Zone rattachée : {d.zone.nom}</Text>
                        )}
                        {d.criteria_details ? (
                          <View style={styles.noteBox}>
                            <Text style={styles.noteBoxLabel}>Description du besoin :</Text>
                            <Text style={styles.noteBoxText}>{d.criteria_details}</Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Informations de traitement */}
                      <View style={styles.cardCol}>
                        <Text style={styles.colHeading}>SUIVI &amp; TRAITEMENT</Text>
                        <View style={styles.infoList}>
                          <View style={styles.infoPair}>
                            <Users size={14} color={UI.muted} />
                            <Text style={styles.infoLabel}>Client :</Text>
                            <Text style={styles.infoValue}>
                              {d.client?.nom_complet || '—'}
                              {!d.donnees_masquees && d.client?.telephone ? ` (${d.client.telephone})` : ''}
                            </Text>
                            {d.donnees_masquees && <Lock size={12} color={UI.amber} />}
                          </View>

                          <View style={styles.infoPair}>
                            <UserCheck size={14} color={d.gestionnaire ? UI.green : UI.amber} />
                            <Text style={styles.infoLabel}>Agent responsable :</Text>
                            <Text
                              style={[
                                styles.infoValue,
                                d.gestionnaire ? { color: UI.greenDark } : { color: UI.amberText },
                              ]}>
                              {d.gestionnaire?.nom_complet || 'Non attribué'}
                            </Text>
                          </View>

                          {d.prise_en_charge_at && (
                            <View style={styles.infoPair}>
                              <Clock size={14} color={UI.muted} />
                              <Text style={styles.infoLabel}>Prise en charge :</Text>
                              <Text style={styles.infoText}>{formatDateTimeFr(d.prise_en_charge_at)}</Text>
                            </View>
                          )}

                          <View style={styles.infoPair}>
                            <Building2 size={14} color={matchesCount > 0 ? UI.green : UI.muted} />
                            <Text style={styles.infoLabel}>Matching :</Text>
                            <Text style={[styles.infoValue, { color: matchesCount > 0 ? UI.greenDark : UI.muted }]}>
                              {matchesCount} bien(s) compatible(s)
                            </Text>
                            {assocCount > 0 && (
                              <View style={[styles.metaPill, { backgroundColor: UI.greenSoft, borderColor: UI.greenBorder }]}>
                                <Text style={[styles.metaPillText, { color: UI.greenDark }]}>
                                  {assocCount} proposé(s)
                                </Text>
                              </View>
                            )}
                          </View>

                          {d.cloture_at && (
                            <View style={[styles.noteBox, { backgroundColor: stMeta.bg, borderColor: stMeta.border, marginTop: 4 }]}>
                              <Text style={[styles.noteBoxLabel, { color: stMeta.text }]}>
                                Clôturée le {formatDateTimeFr(d.cloture_at)}
                                {d.cloture_par ? ` par ${d.cloture_par.nom_complet}` : ''}
                              </Text>
                              {d.motif_cloture_details ? (
                                <Text style={styles.noteBoxText}>{d.motif_cloture_details}</Text>
                              ) : null}
                            </View>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Actions contextuelles — strictement filtrées par statut & permissions */}
                    <View style={styles.actionsFooter}>
                      {perm?.can_take_charge && (
                        <Pressable
                          onPress={() => setConfirmTakeDemande(d)}
                          disabled={busyKey === `take-${d.id}`}
                          {...webTip('Prendre officiellement en charge cette demande')}
                          style={[styles.actBtnDark, WEB_CURSOR]}>
                          <UserCheck size={14} color={UI.white} />
                          <Text style={styles.actBtnDarkText}>Prendre en charge</Text>
                        </Pressable>
                      )}

                      {perm?.can_reassign && (
                        <Pressable
                          onPress={() =>
                            setReassignModal({
                              demande: d,
                              agentId: d.gestionnaire_id || agents[0]?.id || Number(user?.id || 1),
                            })
                          }
                          {...webTip('Réattribuer cette demande à un autre gestionnaire (Super Admin Principal)')}
                          style={[styles.actBtnOutline, WEB_CURSOR]}>
                          <UserCog size={14} color={UI.textSecondary} />
                          <Text style={styles.actBtnOutlineText}>Réattribuer</Text>
                        </Pressable>
                      )}

                      <Pressable
                        onPress={() => void handleOpenMatching(d)}
                        {...webTip('Voir les biens disponibles correspondants et associer au dossier')}
                        style={[styles.actBtnPrimary, WEB_CURSOR]}>
                        <Sparkles size={14} color={UI.white} />
                        <Text style={styles.actBtnPrimaryText}>
                          {perm?.can_match
                            ? `Matching Biens (${matchesCount})`
                            : `Biens associés (${assocCount})`}
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => void handleReadCoordonnees('demande_client', d.id, d.reference_dossier)}
                        disabled={busyKey === `coord-demande_client-${d.id}`}
                        {...webTip('Consulter les coordonnées du client (accès sécurisé & tracé)')}
                        style={[styles.actBtnOutline, WEB_CURSOR]}>
                        {busyKey === `coord-demande_client-${d.id}` ? (
                          <ActivityIndicator size="small" color={UI.green} />
                        ) : d.donnees_masquees ? (
                          <Lock size={14} color={UI.amber} />
                        ) : (
                          <Phone size={14} color={UI.green} />
                        )}
                        <Text style={styles.actBtnOutlineText}>Coordonnées</Text>
                      </Pressable>

                      {perm?.can_close_satisfied && (
                        <Pressable
                          onPress={() =>
                            setCloseDemandeModal({ demande: d, motif: 'satisfaite', details: '' })
                          }
                          {...webTip('Clôturer la demande comme satisfaite')}
                          style={[styles.actBtnSoftGreen, WEB_CURSOR]}>
                          <CheckCircle2 size={14} color={UI.greenDark} />
                          <Text style={styles.actBtnSoftGreenText}>Satisfaite</Text>
                        </Pressable>
                      )}

                      {perm?.can_close_abandoned && (
                        <Pressable
                          onPress={() =>
                            setCloseDemandeModal({ demande: d, motif: 'abandonnee_client', details: '' })
                          }
                          {...webTip('Clôturer la demande comme abandonnée par le client (motif requis)')}
                          style={[styles.actBtnAmber, WEB_CURSOR]}>
                          <XCircle size={14} color={UI.amberText} />
                          <Text style={styles.actBtnAmberText}>Abandonnée</Text>
                        </Pressable>
                      )}

                      {perm?.can_mark_expired && (
                        <Pressable
                          onPress={() =>
                            setCloseDemandeModal({
                              demande: d,
                              motif: 'delai_depasse',
                              details: 'Échéance de validité dépassée.',
                            })
                          }
                          {...webTip('Confirmer la clôture pour délai dépassé')}
                          style={[styles.actBtnDanger, WEB_CURSOR]}>
                          <Clock size={14} color={UI.danger} />
                          <Text style={styles.actBtnDangerText}>Marquer expirée</Text>
                        </Pressable>
                      )}

                      <Pressable
                        onPress={() => void handleOpenHistory('demande', d.id, d.reference_dossier)}
                        {...webTip('Consulter l’historique d’audit de cette demande')}
                        style={[styles.actBtnGhost, WEB_CURSOR]}>
                        <History size={14} color={UI.muted} />
                        <Text style={styles.actBtnGhostText}>Historique</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}

              {/* Pagination Demandes */}
              {demandesLastPage > 1 && (
                <View style={styles.paginationRow}>
                  <Text style={styles.paginationInfo}>
                    {demandesTotalFiltered} demande(s) • Page {demandesPage} / {demandesLastPage}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      disabled={demandesPage <= 1}
                      onPress={() => setDemandesPage((p) => Math.max(1, p - 1))}
                      style={[styles.pageBtn, demandesPage <= 1 && styles.pageBtnDisabled, WEB_CURSOR]}>
                      <ChevronLeft size={15} color={UI.text} />
                      <Text style={styles.pageBtnText}>Précédent</Text>
                    </Pressable>
                    <Pressable
                      disabled={demandesPage >= demandesLastPage}
                      onPress={() => setDemandesPage((p) => Math.min(demandesLastPage, p + 1))}
                      style={[styles.pageBtn, demandesPage >= demandesLastPage && styles.pageBtnDisabled, WEB_CURSOR]}>
                      <Text style={styles.pageBtnText}>Suivant</Text>
                      <ChevronRight size={15} color={UI.text} />
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* =================================================================== */}
      {/* MODALE 1 : COORDONNÉES CLIENT (SÉCURISÉE & TRACÉE)                   */}
      {/* =================================================================== */}
      <Modal
        visible={Boolean(unmaskedInfo)}
        transparent
        animationType="fade"
        onRequestClose={() => setUnmaskedInfo(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.heroIconWrap, { backgroundColor: UI.greenSoft }]}>
                  <ShieldCheck size={18} color={UI.green} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Coordonnées client</Text>
                  <Text style={styles.modalSub}>{unmaskedInfo?.dossier_reference} • Consultation tracée</Text>
                </View>
              </View>
              <Pressable onPress={() => setUnmaskedInfo(null)} hitSlop={8} style={WEB_CURSOR}>
                <X size={20} color={UI.muted} />
              </Pressable>
            </View>

            <View style={styles.contactBox}>
              <View style={styles.contactRow}>
                <Users size={16} color={UI.green} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactLabel}>Nom complet</Text>
                  <Text style={styles.contactValue}>{unmaskedInfo?.nom_complet || '—'}</Text>
                </View>
                {unmaskedInfo?.is_verifed && (
                  <View style={[styles.metaPill, { backgroundColor: UI.greenSoft, borderColor: UI.greenBorder }]}>
                    <Text style={[styles.metaPillText, { color: UI.greenDark }]}>Vérifié</Text>
                  </View>
                )}
              </View>

              <View style={styles.contactRow}>
                <Phone size={16} color={UI.green} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactLabel}>Téléphone</Text>
                  <Text style={styles.contactValue}>{unmaskedInfo?.telephone || 'Non renseigné'}</Text>
                </View>
                {unmaskedInfo?.telephone && (
                  <Pressable
                    onPress={() =>
                      copyText(unmaskedInfo.telephone, () =>
                        notify('info', 'Copié', 'Numéro de téléphone copié dans le presse-papiers.')
                      )
                    }
                    style={[styles.copyBtn, WEB_CURSOR]}>
                    <Copy size={13} color={UI.greenDark} />
                    <Text style={styles.copyBtnText}>Copier</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.contactRow}>
                <Mail size={16} color={UI.green} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactLabel}>Adresse e-mail</Text>
                  <Text style={styles.contactValue}>{unmaskedInfo?.email || 'Non renseignée'}</Text>
                </View>
                {unmaskedInfo?.email && (
                  <Pressable
                    onPress={() =>
                      copyText(unmaskedInfo.email, () =>
                        notify('info', 'Copié', 'Adresse e-mail copiée dans le presse-papiers.')
                      )
                    }
                    style={[styles.copyBtn, WEB_CURSOR]}>
                    <Copy size={13} color={UI.greenDark} />
                    <Text style={styles.copyBtnText}>Copier</Text>
                  </Pressable>
                )}
              </View>
            </View>

            <View style={styles.auditHintBox}>
              <Info size={14} color={UI.blue} />
              <Text style={styles.auditHintText}>
                Mode d’accès : {unmaskedInfo?.mode_acces}
                {unmaskedInfo?.expires_at ? ` • Expire le ${formatDateTimeFr(unmaskedInfo.expires_at)}` : ''}. Cette consultation est consignée dans la Journalisation Globale.
              </Text>
            </View>

            <Pressable onPress={() => setUnmaskedInfo(null)} style={[styles.btnPrimary, WEB_CURSOR]}>
              <Text style={styles.btnPrimaryText}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* MODALE 2 : DEMANDE DE DÉMASQUAGE TTL                                */}
      {/* =================================================================== */}
      <Modal
        visible={Boolean(demasquagePrompt)}
        transparent
        animationType="fade"
        onRequestClose={() => setDemasquagePrompt(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Lock size={18} color={UI.amber} />
                <Text style={styles.modalTitle}>Démasquage temporaire (TTL)</Text>
              </View>
              <Pressable onPress={() => setDemasquagePrompt(null)} hitSlop={8} style={WEB_CURSOR}>
                <X size={20} color={UI.muted} />
              </Pressable>
            </View>
            <Text style={styles.modalBodyText}>{demasquagePrompt?.message}</Text>
            <Text style={styles.inputLabel}>Motif de la demande *</Text>
            <TextInput
              style={styles.textInput}
              value={demasquageMotif}
              onChangeText={setDemasquageMotif}
              placeholder="Ex: Coordination visite terrain"
              placeholderTextColor={UI.muted}
            />
            <Text style={styles.inputLabel}>Justification opérationnelle (min 10 car.) *</Text>
            <TextInput
              style={[styles.textInput, { minHeight: 76, textAlignVertical: 'top' }]}
              multiline
              value={demasquageJustif}
              onChangeText={setDemasquageJustif}
              placeholder="Expliquez la nécessité d'accéder aux coordonnées..."
              placeholderTextColor={UI.muted}
            />
            <View style={styles.modalActionsRow}>
              <Pressable onPress={() => setDemasquagePrompt(null)} style={[styles.btnSecondary, WEB_CURSOR]}>
                <Text style={styles.btnSecondaryText}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={() => void submitDemasquageRequest()}
                disabled={Boolean(busyKey)}
                style={[styles.btnPrimary, { flex: 1 }, WEB_CURSOR]}>
                {busyKey?.startsWith('demasq-') ? (
                  <ActivityIndicator size="small" color={UI.white} />
                ) : (
                  <Text style={styles.btnPrimaryText}>Soumettre la demande TTL</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* MODALE 3 : CONFIRMATION PRISE EN CHARGE                             */}
      {/* =================================================================== */}
      <Modal
        visible={Boolean(confirmTakeDemande)}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmTakeDemande(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Prendre en charge {confirmTakeDemande?.reference_dossier}</Text>
              <Pressable onPress={() => setConfirmTakeDemande(null)} hitSlop={8} style={WEB_CURSOR}>
                <X size={20} color={UI.muted} />
              </Pressable>
            </View>
            <Text style={styles.modalBodyText}>
              Vous allez devenir l’agent responsable de cette demande ({confirmTakeDemande?.property_type} en{' '}
              {confirmTakeDemande?.transaction_type} à {confirmTakeDemande?.target_commune}). Le dossier passera en statut « En cours » et sera verrouillé contre toute prise en charge concurrente.
            </Text>
            <View style={styles.modalActionsRow}>
              <Pressable onPress={() => setConfirmTakeDemande(null)} style={[styles.btnSecondary, WEB_CURSOR]}>
                <Text style={styles.btnSecondaryText}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={() => void executeTakeCharge()}
                disabled={Boolean(busyKey)}
                style={[styles.btnPrimary, { flex: 1 }, WEB_CURSOR]}>
                {busyKey?.startsWith('take-') ? (
                  <ActivityIndicator size="small" color={UI.white} />
                ) : (
                  <Text style={styles.btnPrimaryText}>Confirmer la prise en charge</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* MODALE 4 : RÉATTRIBUTION (SUPER ADMIN PRINCIPAL)                    */}
      {/* =================================================================== */}
      <Modal
        visible={Boolean(reassignModal)}
        transparent
        animationType="fade"
        onRequestClose={() => setReassignModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Réattribuer {reassignModal?.demande.reference_dossier}</Text>
              <Pressable onPress={() => setReassignModal(null)} hitSlop={8} style={WEB_CURSOR}>
                <X size={20} color={UI.muted} />
              </Pressable>
            </View>
            <Text style={styles.modalBodyText}>
              Sélectionnez le nouveau gestionnaire responsable de cette demande :
            </Text>
            <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ gap: 6 }}>
              {agents.map((ag) => {
                const selected = reassignModal?.agentId === ag.id;
                return (
                  <Pressable
                    key={ag.id}
                    onPress={() => setReassignModal((prev) => (prev ? { ...prev, agentId: ag.id } : null))}
                    style={[styles.selectRow, selected && styles.selectRowActive, WEB_CURSOR]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selectRowTitle}>{ag.nom_complet}</Text>
                      <Text style={styles.selectRowSub}>
                        {ag.role}
                        {ag.zone_nom ? ` • ${ag.zone_nom}` : ''}
                      </Text>
                    </View>
                    {selected && <Check size={16} color={UI.green} strokeWidth={2.5} />}
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.modalActionsRow}>
              <Pressable onPress={() => setReassignModal(null)} style={[styles.btnSecondary, WEB_CURSOR]}>
                <Text style={styles.btnSecondaryText}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={() => void executeReassign()}
                disabled={Boolean(busyKey)}
                style={[styles.btnPrimary, { flex: 1 }, WEB_CURSOR]}>
                {busyKey?.startsWith('reassign-') ? (
                  <ActivityIndicator size="small" color={UI.white} />
                ) : (
                  <Text style={styles.btnPrimaryText}>Confirmer la réattribution</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* MODALE 5 : CLÔTURE DE DEMANDE (SATISFAITE / ABANDONNÉE / EXPIRÉE)   */}
      {/* =================================================================== */}
      <Modal
        visible={Boolean(closeDemandeModal)}
        transparent
        animationType="fade"
        onRequestClose={() => setCloseDemandeModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {closeDemandeModal?.motif === 'satisfaite' ? (
                  <CheckCircle2 size={20} color={UI.green} />
                ) : (
                  <AlertTriangle size={20} color={closeDemandeModal?.motif === 'delai_depasse' ? UI.danger : UI.amber} />
                )}
                <Text style={styles.modalTitle}>
                  {closeDemandeModal?.motif === 'satisfaite'
                    ? 'Clôturer comme Satisfaite'
                    : closeDemandeModal?.motif === 'abandonnee_client'
                    ? 'Clôturer comme Abandonnée'
                    : 'Confirmer l’expiration'}
                </Text>
              </View>
              <Pressable onPress={() => setCloseDemandeModal(null)} hitSlop={8} style={WEB_CURSOR}>
                <X size={20} color={UI.muted} />
              </Pressable>
            </View>

            <Text style={styles.modalBodyText}>
              Dossier {closeDemandeModal?.demande.reference_dossier} — Cette opération est définitive et sera horodatée dans la Journalisation Globale.
            </Text>

            <Text style={styles.inputLabel}>
              {closeDemandeModal?.motif === 'abandonnee_client'
                ? 'Motif d’abandon (obligatoire, min 5 car.) *'
                : 'Observations / Note de clôture (optionnel)'}
            </Text>
            <TextInput
              style={[styles.textInput, { minHeight: 84, textAlignVertical: 'top' }]}
              multiline
              placeholder={
                closeDemandeModal?.motif === 'abandonnee_client'
                  ? 'Ex: Le client a trouvé un logement par ses propres moyens...'
                  : 'Ex: Visite conclue, contrat signé sur le bien #12...'
              }
              placeholderTextColor={UI.muted}
              value={closeDemandeModal?.details || ''}
              onChangeText={(txt) =>
                setCloseDemandeModal((prev) => (prev ? { ...prev, details: txt } : null))
              }
            />

            <View style={styles.modalActionsRow}>
              <Pressable onPress={() => setCloseDemandeModal(null)} style={[styles.btnSecondary, WEB_CURSOR]}>
                <Text style={styles.btnSecondaryText}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={() => void executeCloseDemande()}
                disabled={Boolean(busyKey)}
                style={[
                  styles.btnPrimary,
                  {
                    flex: 1,
                    backgroundColor:
                      closeDemandeModal?.motif === 'satisfaite'
                        ? UI.green
                        : closeDemandeModal?.motif === 'delai_depasse'
                        ? UI.danger
                        : UI.amber,
                  },
                  WEB_CURSOR,
                ]}>
                {busyKey?.startsWith('close-') ? (
                  <ActivityIndicator size="small" color={UI.white} />
                ) : (
                  <Text style={styles.btnPrimaryText}>Confirmer la clôture</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* MODALE 6 : MATCHING IMMOBILIER MULTI-BIENS (PHASE 4)                */}
      {/* =================================================================== */}
      <Modal
        visible={Boolean(matchingModal)}
        transparent
        animationType="fade"
        onRequestClose={() => setMatchingModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 760, maxHeight: '88%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  Matching Immobilier — {matchingModal?.demande.reference_dossier}
                </Text>
                <Text style={styles.modalSub}>
                  Recherche : {matchingModal?.demande.property_type.toUpperCase()} ({matchingModal?.demande.transaction_type}) •{' '}
                  {matchingModal?.demande.target_commune}
                  {matchingModal?.demande.target_quartier ? `, ${matchingModal.demande.target_quartier}` : ''} • Budget max :{' '}
                  {matchingModal ? formatFcfa(matchingModal.demande.budget_max) : ''}
                </Text>
              </View>
              <Pressable onPress={() => setMatchingModal(null)} hitSlop={8} style={WEB_CURSOR}>
                <X size={20} color={UI.muted} />
              </Pressable>
            </View>

            {matchingModal?.loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={UI.green} />
                <Text style={styles.loadingText}>Analyse des biens disponibles en base de données...</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 12, paddingVertical: 4 }}>
                {/* Section 1 : Biens déjà associés au dossier */}
                {(matchingModal?.associated?.length || 0) > 0 && (
                  <View style={{ gap: 8 }}>
                    <Text style={styles.colHeading}>
                      BIENS DÉJÀ ASSOCIÉS AU DOSSIER ({matchingModal?.associated.length})
                    </Text>
                    {matchingModal?.associated.map((ap, idx) => {
                      const imgUrl = ap.photo_url ? resolveStorageUrl(ap.photo_url, storageBaseUrl) : null;
                      return (
                        <View key={`assoc-${ap.propriete_id || ap.id || idx}`} style={styles.associatedRow}>
                          {imgUrl ? (
                            <Image source={{ uri: imgUrl }} style={styles.matchThumbSmall} contentFit="cover" />
                          ) : (
                            <View style={[styles.matchThumbSmall, styles.propThumbPlaceholder]}>
                              <Building2 size={16} color={UI.muted} />
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.matchTitle}>
                              Bien #{ap.propriete_id || ap.id} — {ap.type.toUpperCase()} ({ap.transaction_type})
                            </Text>
                            <Text style={styles.infoText}>
                              {[ap.commune, ap.quartier].filter(Boolean).join(', ')} • {formatFcfa(ap.prix)}
                            </Text>
                            {ap.note_agent ? (
                              <Text style={styles.subInfoText}>Note : {ap.note_agent}</Text>
                            ) : null}
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 4 }}>
                            <View style={[styles.metaPill, { backgroundColor: UI.greenSoft, borderColor: UI.greenBorder }]}>
                              <Check size={11} color={UI.greenDark} />
                              <Text style={[styles.metaPillText, { color: UI.greenDark }]}>Associé</Text>
                            </View>
                            {ap.client_notifie && (
                              <Text style={{ fontSize: 10, color: UI.muted }}>Client notifié</Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Section 2 : Biens disponibles correspondants */}
                <View style={{ gap: 8 }}>
                  <Text style={styles.colHeading}>
                    BIENS DISPONIBLES CORRESPONDANTS ({matchingModal?.suggestions.length || 0})
                  </Text>

                  {(matchingModal?.suggestions.length || 0) === 0 ? (
                    <View style={[styles.emptyCard, { paddingVertical: 20 }]}>
                      <Building2 size={24} color={UI.muted} />
                      <Text style={styles.emptyTitle}>Aucun bien disponible compatible</Text>
                      <Text style={styles.emptySubtitle}>
                        Aucun bien publié (statut disponible) ne correspond actuellement aux critères de cette demande (score minimal 40%).
                      </Text>
                    </View>
                  ) : (
                    matchingModal?.suggestions.map((s) => {
                      const imgUrl = s.photo_url ? resolveStorageUrl(s.photo_url, storageBaseUrl) : null;
                      const isSelected = matchingModal.selectedIds.includes(s.propriete_id);
                      const canSelect = Boolean(matchingModal.demande.permissions?.can_match);
                      const scoreColor =
                        s.score_matching_pourcentage >= 80
                          ? UI.green
                          : s.score_matching_pourcentage >= 60
                          ? UI.blue
                          : UI.amber;
                      const scoreBg =
                        s.score_matching_pourcentage >= 80
                          ? UI.greenSoft
                          : s.score_matching_pourcentage >= 60
                          ? UI.blueSoft
                          : UI.amberSoft;

                      return (
                        <Pressable
                          key={s.propriete_id}
                          disabled={!canSelect}
                          onPress={() => canSelect && toggleSelectProperty(s.propriete_id)}
                          style={[
                            styles.matchCard,
                            isSelected && { borderColor: UI.green, backgroundColor: '#F3FBF7' },
                            canSelect && WEB_CURSOR,
                          ]}>
                          {canSelect && (
                            <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                              {isSelected && <Check size={13} color={UI.white} strokeWidth={3} />}
                            </View>
                          )}

                          {imgUrl ? (
                            <Image source={{ uri: imgUrl }} style={styles.matchThumb} contentFit="cover" />
                          ) : (
                            <View style={[styles.matchThumb, styles.propThumbPlaceholder]}>
                              <Building2 size={22} color={UI.muted} />
                            </View>
                          )}

                          <View style={{ flex: 1, gap: 4 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                              <Text style={styles.matchTitle}>
                                #{s.propriete_id} • {s.type.toUpperCase()} ({s.transaction_type})
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                {s.deja_associe && (
                                  <View style={[styles.metaPill, { backgroundColor: UI.blueSoft, borderColor: UI.blueBorder }]}>
                                    <Text style={[styles.metaPillText, { color: UI.blue }]}>Déjà proposé</Text>
                                  </View>
                                )}
                                <View style={[styles.metaPill, { backgroundColor: scoreBg, borderColor: scoreColor }]}>
                                  <Text style={[styles.metaPillText, { color: scoreColor }]}>
                                    Match {s.score_matching_pourcentage}%
                                  </Text>
                                </View>
                              </View>
                            </View>

                            <Text style={styles.budgetValue}>{formatFcfa(s.prix)}</Text>

                            <View style={styles.inlineMeta}>
                              <MapPin size={12} color={UI.muted} />
                              <Text style={styles.infoText}>
                                {[s.commune, s.arrondissement, s.quartier].filter(Boolean).join(' • ')}
                              </Text>
                            </View>

                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                              <View style={[styles.metaPill, { backgroundColor: UI.greenSoft, borderColor: UI.greenBorder }]}>
                                <Text style={[styles.metaPillText, { color: UI.greenDark }]}>
                                  {s.disponibilite || 'Disponible'}
                                </Text>
                              </View>
                              {s.surface ? (
                                <View style={styles.specPill}>
                                  <Text style={styles.specPillText}>{s.surface} m²</Text>
                                </View>
                              ) : null}
                              {s.nombres_chambres ? (
                                <View style={styles.specPill}>
                                  <Text style={styles.specPillText}>{s.nombres_chambres} ch.</Text>
                                </View>
                              ) : null}
                              {s.accessibilite ? (
                                <View style={styles.specPill}>
                                  <Text style={styles.specPillText}>{s.accessibilite}</Text>
                                </View>
                              ) : null}
                              {(s.criteres_correspondants || []).map((c) => (
                                <View key={c} style={styles.matchTag}>
                                  <Text style={styles.matchTagText}>✓ {c.replace('_', ' ')}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </View>

                {/* Options d'association si sélection active */}
                {matchingModal?.demande.permissions?.can_match && (matchingModal?.suggestions.length || 0) > 0 && (
                  <View style={styles.assocFormBox}>
                    <Text style={styles.inputLabel}>Note pour le client (optionnel)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Ex: Voici les biens qui correspondent le mieux à votre budget à Womey..."
                      placeholderTextColor={UI.muted}
                      value={matchingModal.noteAgent}
                      onChangeText={(txt) =>
                        setMatchingModal((prev) => (prev ? { ...prev, noteAgent: txt } : null))
                      }
                    />
                    <Pressable
                      onPress={() =>
                        setMatchingModal((prev) =>
                          prev ? { ...prev, notifierClient: !prev.notifierClient } : null
                        )
                      }
                      style={[styles.toggleRow, WEB_CURSOR]}>
                      <View style={[styles.checkbox, matchingModal.notifierClient && styles.checkboxChecked]}>
                        {matchingModal.notifierClient && <Check size={12} color={UI.white} strokeWidth={3} />}
                      </View>
                      <Text style={styles.infoText}>
                        Notifier automatiquement le client (SMS + Notification in-app)
                      </Text>
                    </Pressable>
                  </View>
                )}
              </ScrollView>
            )}

            <View style={styles.modalActionsRow}>
              <Pressable onPress={() => setMatchingModal(null)} style={[styles.btnSecondary, WEB_CURSOR]}>
                <Text style={styles.btnSecondaryText}>Fermer</Text>
              </Pressable>
              {matchingModal?.demande.permissions?.can_match && (
                <Pressable
                  disabled={!matchingModal || matchingModal.selectedIds.length === 0 || Boolean(busyKey)}
                  onPress={() => void executeAssociateSelected()}
                  style={[
                    styles.btnPrimary,
                    { flex: 1 },
                    (!matchingModal || matchingModal.selectedIds.length === 0) && { opacity: 0.45 },
                    WEB_CURSOR,
                  ]}>
                  {busyKey?.startsWith('assoc-') ? (
                    <ActivityIndicator size="small" color={UI.white} />
                  ) : (
                    <Text style={styles.btnPrimaryText}>
                      Associer la sélection ({matchingModal?.selectedIds.length || 0})
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* MODALE 7 : ACTIONS VISITES PHYSIQUES (PHASE 5)                      */}
      {/* =================================================================== */}
      <Modal
        visible={Boolean(visitActionModal)}
        transparent
        animationType="fade"
        onRequestClose={() => setVisitActionModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {visitActionModal?.mode === 'planifier'
                    ? 'Planifier & Confirmer la visite'
                    : visitActionModal?.mode === 'cr'
                    ? 'Compte-rendu terrain'
                    : visitActionModal?.mode === 'cloturer'
                    ? 'Clôturer la visite'
                    : visitActionModal?.mode === 'escalade'
                    ? 'Escalader une offre commerciale'
                    : visitActionModal?.mode === 'zone'
                    ? 'Assigner Zone & Agent'
                    : 'Modifier le statut'}
                </Text>
                <Text style={styles.modalSub}>{visitActionModal?.visit.reference_visite}</Text>
              </View>
              <Pressable onPress={() => setVisitActionModal(null)} hitSlop={8} style={WEB_CURSOR}>
                <X size={20} color={UI.muted} />
              </Pressable>
            </View>

            {visitActionModal?.mode === 'planifier' && (
              <View style={{ gap: 10 }}>
                <Text style={styles.inputLabel}>Date et heure de la visite (AAAA-MM-JJ HH:MM) *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="2026-12-01 10:00"
                  placeholderTextColor={UI.muted}
                  value={vDateInput}
                  onChangeText={setVDateInput}
                />
                <Text style={styles.inputLabel}>Lieu de rendez-vous / Consignes d’itinéraire</Text>
                <TextInput
                  style={[styles.textInput, { minHeight: 70, textAlignVertical: 'top' }]}
                  multiline
                  placeholder="Ex: Carrefour IITA, face pharmacie..."
                  placeholderTextColor={UI.muted}
                  value={vInstructions}
                  onChangeText={setVInstructions}
                />
                <Text style={styles.inputLabel}>Agent terrain assigné (optionnel)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                  <Pressable
                    onPress={() => setVAgentId(null)}
                    style={[styles.miniPill, vAgentId === null && styles.miniPillActive, WEB_CURSOR]}>
                    <Text style={[styles.miniPillText, vAgentId === null && styles.miniPillTextActive]}>Inchangé</Text>
                  </Pressable>
                  {agents.map((a) => (
                    <Pressable
                      key={a.id}
                      onPress={() => setVAgentId(a.id)}
                      style={[styles.miniPill, vAgentId === a.id && styles.miniPillActive, WEB_CURSOR]}>
                      <Text style={[styles.miniPillText, vAgentId === a.id && styles.miniPillTextActive]}>
                        {a.nom_complet}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {visitActionModal?.mode === 'cr' && (
              <View style={{ gap: 8 }}>
                <Text style={styles.modalBodyText}>
                  Saisissez le compte-rendu terrain. La visite passera automatiquement au statut « Effectuée ».
                </Text>
                <TextInput
                  style={[styles.textInput, { minHeight: 100, textAlignVertical: 'top' }]}
                  multiline
                  placeholder="Observations du client, points forts/faibles, suite envisagée (min 10 caractères)..."
                  placeholderTextColor={UI.muted}
                  value={vCrInput}
                  onChangeText={setVCrInput}
                />
              </View>
            )}

            {visitActionModal?.mode === 'cloturer' && (
              <View style={{ gap: 10 }}>
                <Text style={styles.inputLabel}>Issue de la visite *</Text>
                <View style={styles.pillRow}>
                  {(
                    [
                      { k: 'succes_offre', l: 'Succès / Offre' },
                      { k: 'sans_suite', l: 'Sans suite' },
                      { k: 'client_absent', l: 'Client absent' },
                      { k: 'autre', l: 'Autre' },
                    ] as const
                  ).map((iss) => (
                    <Pressable
                      key={iss.k}
                      onPress={() => setVClotureIssue(iss.k)}
                      style={[styles.miniPill, vClotureIssue === iss.k && styles.miniPillActive, WEB_CURSOR]}>
                      <Text style={[styles.miniPillText, vClotureIssue === iss.k && styles.miniPillTextActive]}>
                        {iss.l}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.inputLabel}>Observations / Motif (optionnel)</Text>
                <TextInput
                  style={[styles.textInput, { minHeight: 70, textAlignVertical: 'top' }]}
                  multiline
                  placeholder="Précisions complémentaires..."
                  placeholderTextColor={UI.muted}
                  value={vMotif}
                  onChangeText={setVMotif}
                />
              </View>
            )}

            {visitActionModal?.mode === 'escalade' && (
              <View style={{ gap: 10 }}>
                <Text style={styles.modalBodyText}>
                  Alerte directe au Super Administrateur Principal (Justin MAGNIDE) pour négociation haute.
                </Text>
                <Text style={styles.inputLabel}>Montant de l’offre (FCFA, optionnel)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="Ex: 55000000"
                  placeholderTextColor={UI.muted}
                  value={vEscaladeAmount}
                  onChangeText={setVEscaladeAmount}
                />
                <Text style={styles.inputLabel}>Commentaires sur l’offre (min 5 car.) *</Text>
                <TextInput
                  style={[styles.textInput, { minHeight: 80, textAlignVertical: 'top' }]}
                  multiline
                  placeholder="Conditions, délais de paiement, remarques du client..."
                  placeholderTextColor={UI.muted}
                  value={vEscaladeNote}
                  onChangeText={setVEscaladeNote}
                />
              </View>
            )}

            {visitActionModal?.mode === 'zone' && (
              <View style={{ gap: 10 }}>
                <Text style={styles.inputLabel}>Zone géographique *</Text>
                <View style={styles.pillRow}>
                  {zones.map((z) => (
                    <Pressable
                      key={z.id}
                      onPress={() => setVZoneId(z.id)}
                      style={[styles.miniPill, vZoneId === z.id && styles.miniPillActive, WEB_CURSOR]}>
                      <Text style={[styles.miniPillText, vZoneId === z.id && styles.miniPillTextActive]}>
                        {z.nom}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.inputLabel}>Agent responsable (optionnel)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                  <Pressable
                    onPress={() => setVAgentId(null)}
                    style={[styles.miniPill, vAgentId === null && styles.miniPillActive, WEB_CURSOR]}>
                    <Text style={[styles.miniPillText, vAgentId === null && styles.miniPillTextActive]}>Inchangé</Text>
                  </Pressable>
                  {agents.map((a) => (
                    <Pressable
                      key={a.id}
                      onPress={() => setVAgentId(a.id)}
                      style={[styles.miniPill, vAgentId === a.id && styles.miniPillActive, WEB_CURSOR]}>
                      <Text style={[styles.miniPillText, vAgentId === a.id && styles.miniPillTextActive]}>
                        {a.nom_complet}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {visitActionModal?.mode === 'statut' && (
              <View style={{ gap: 10 }}>
                <Text style={styles.inputLabel}>Transitions autorisées depuis « {getVisiteStatusMeta(visitActionModal.visit.status).shortLabel} »</Text>
                <View style={styles.pillRow}>
                  {(visitActionModal.visit.allowed_transitions || []).map((st) => {
                    const meta = getVisiteStatusMeta(st);
                    return (
                      <Pressable
                        key={st}
                        onPress={() => setVStatusChoice(st as any)}
                        style={[styles.miniPill, vStatusChoice === st && styles.miniPillActive, WEB_CURSOR]}>
                        <Text style={[styles.miniPillText, vStatusChoice === st && styles.miniPillTextActive]}>
                          {meta.shortLabel}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.inputLabel}>Motif du changement (optionnel)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ex: Report à la demande du client..."
                  placeholderTextColor={UI.muted}
                  value={vMotif}
                  onChangeText={setVMotif}
                />
              </View>
            )}

            <View style={styles.modalActionsRow}>
              <Pressable onPress={() => setVisitActionModal(null)} style={[styles.btnSecondary, WEB_CURSOR]}>
                <Text style={styles.btnSecondaryText}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={() => void executeVisitAction()}
                disabled={Boolean(busyKey)}
                style={[styles.btnPrimary, { flex: 1 }, WEB_CURSOR]}>
                {busyKey?.startsWith('visit-') ? (
                  <ActivityIndicator size="small" color={UI.white} />
                ) : (
                  <Text style={styles.btnPrimaryText}>Confirmer</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* MODALE 8 : HISTORIQUE & TRAÇABILITÉ (AUDIT_LOGS — PHASE 6)          */}
      {/* =================================================================== */}
      <Modal
        visible={Boolean(historyModal)}
        transparent
        animationType="fade"
        onRequestClose={() => setHistoryModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 620, maxHeight: '82%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <History size={18} color={UI.green} />
                <View>
                  <Text style={styles.modalTitle}>Historique &amp; Traçabilité</Text>
                  <Text style={styles.modalSub}>{historyModal?.reference} • Journalisation Globale</Text>
                </View>
              </View>
              <Pressable onPress={() => setHistoryModal(null)} hitSlop={8} style={WEB_CURSOR}>
                <X size={20} color={UI.muted} />
              </Pressable>
            </View>

            {historyModal?.loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={UI.green} />
                <Text style={styles.loadingText}>Chargement du journal d’audit...</Text>
              </View>
            ) : (historyModal?.entries.length || 0) === 0 ? (
              <View style={[styles.emptyCard, { paddingVertical: 20 }]}>
                <History size={24} color={UI.muted} />
                <Text style={styles.emptyTitle}>Aucun événement tracé pour ce dossier</Text>
                <Text style={styles.emptySubtitle}>
                  Les actions futures (prise en charge, matching, changements de statut, consultation de coordonnées) apparaîtront ici.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ gap: 10 }}>
                {historyModal?.entries.map((entry) => {
                  const d = entry.details || {};
                  return (
                    <View key={entry.id} style={styles.timelineItem}>
                      <View style={styles.timelineDot} />
                      <View style={{ flex: 1, gap: 3 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                          <Text style={styles.timelineAction}>{getAuditActionLabel(entry.action)}</Text>
                          <Text style={styles.timelineDate}>{formatDateTimeFr(entry.created_at)}</Text>
                        </View>
                        <Text style={styles.timelineActor}>
                          Par : {entry.actor?.nom_complet || 'Système automatique'}
                        </Text>
                        {(d.ancien_statut || d.nouveau_statut) && (
                          <Text style={styles.timelineDetail}>
                            Transition : {d.ancien_statut || '—'} → {d.nouveau_statut || '—'}
                          </Text>
                        )}
                        {(d.motif || d.motif_details || d.motif_cloture) && (
                          <Text style={styles.timelineDetail}>
                            Motif : {d.motif_details || d.motif || d.motif_cloture}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            <Pressable onPress={() => setHistoryModal(null)} style={[styles.btnPrimary, WEB_CURSOR]}>
              <Text style={styles.btnPrimaryText}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  toastTitle: { fontSize: 13, fontWeight: '800' },
  toastMsg: { fontSize: 12, color: UI.textSecondary, marginTop: 2 },
  heroCard: {
    backgroundColor: UI.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: UI.border,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 14,
  },
  heroIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: UI.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 19, fontWeight: '900', color: UI.text },
  heroDesc: { fontSize: 13, color: UI.muted, marginTop: 6, lineHeight: 19, maxWidth: 760 },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: UI.greenSoft,
    borderWidth: 1,
    borderColor: UI.greenBorder,
  },
  refreshBtnText: { fontSize: 12, fontWeight: '800', color: UI.greenDark },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flexGrow: 1,
    minWidth: 145,
    backgroundColor: UI.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: UI.border,
    paddingHorizontal: 13,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '700', color: UI.muted, marginTop: 1 },
  tabsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: UI.white,
    padding: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: UI.border,
    alignSelf: 'flex-start',
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: UI.green,
  },
  tabBtnText: { fontSize: 13, fontWeight: '700', color: UI.textSecondary },
  tabBtnTextActive: { color: UI.white, fontWeight: '800' },
  tabCounter: {
    minWidth: 22,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: UI.slateSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCounterActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  tabCounterText: { fontSize: 11, fontWeight: '800', color: UI.textSecondary },
  tabCounterTextActive: { color: UI.white },
  filterCard: {
    backgroundColor: UI.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: UI.border,
    padding: 14,
    gap: 12,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  searchInputWrap: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: UI.surfaceSoft,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: UI.text,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.white,
  },
  filterToggleBtnActive: { backgroundColor: UI.greenSoft, borderColor: UI.greenBorder },
  filterToggleText: { fontSize: 12, fontWeight: '700', color: UI.textSecondary },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: UI.dangerSoft,
    borderWidth: 1,
    borderColor: UI.dangerBorder,
  },
  resetBtnText: { fontSize: 12, fontWeight: '700', color: UI.danger },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: UI.slateSoft,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterPillActive: { backgroundColor: UI.greenSoft, borderColor: UI.greenBorder },
  filterPillText: { fontSize: 12, fontWeight: '700', color: UI.textSecondary },
  filterPillTextActive: { color: UI.greenDark, fontWeight: '800' },
  advancedFiltersWrap: {
    borderTopWidth: 1,
    borderTopColor: UI.borderLight,
    paddingTop: 12,
    gap: 12,
  },
  filterGroup: { gap: 6 },
  filterGroupLabel: { fontSize: 11, fontWeight: '800', color: UI.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  miniPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: UI.surfaceSoft,
    borderWidth: 1,
    borderColor: UI.border,
  },
  miniPillActive: { backgroundColor: UI.green, borderColor: UI.green },
  miniPillText: { fontSize: 12, fontWeight: '600', color: UI.textSecondary },
  miniPillTextActive: { color: UI.white, fontWeight: '700' },
  loadingBox: {
    backgroundColor: UI.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: UI.border,
    padding: 36,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: { fontSize: 13, color: UI.muted, fontWeight: '600' },
  emptyCard: {
    backgroundColor: UI.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: UI.border,
    padding: 36,
    alignItems: 'center',
    gap: 8,
  },
  emptyIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: UI.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: UI.text, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, color: UI.muted, textAlign: 'center', maxWidth: 480, lineHeight: 19 },
  itemCard: {
    backgroundColor: UI.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: UI.border,
    borderLeftWidth: 4,
    padding: 18,
    gap: 14,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: UI.borderLight,
  },
  itemHeaderLeft: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  refText: { fontSize: 15, fontWeight: '900', color: UI.text, letterSpacing: 0.2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '800' },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: UI.greenSoft,
    borderWidth: 1,
    borderColor: UI.greenBorder,
  },
  typePillText: { fontSize: 11, fontWeight: '800', color: UI.greenDark },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
  },
  metaPillText: { fontSize: 11, fontWeight: '700' },
  dateColumn: { alignItems: 'flex-end', gap: 2 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateText: { fontSize: 12, fontWeight: '600', color: UI.muted },
  expiryText: { fontSize: 11, fontWeight: '700' },
  cardGrid: { gap: 14 },
  cardGridDesktop: { flexDirection: 'row', gap: 20 },
  cardCol: { flex: 1, gap: 8 },
  colHeading: { fontSize: 10, fontWeight: '800', color: UI.muted, letterSpacing: 0.8 },
  budgetRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  budgetLabel: { fontSize: 12, color: UI.muted, fontWeight: '600' },
  budgetValue: { fontSize: 16, fontWeight: '900', color: UI.green },
  inlineMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoList: { gap: 7 },
  infoPair: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  infoLabel: { fontSize: 12, fontWeight: '600', color: UI.muted },
  infoValue: { fontSize: 13, fontWeight: '700', color: UI.text },
  infoText: { fontSize: 12, color: UI.textSecondary },
  subInfoText: { fontSize: 11, color: UI.muted },
  noteBox: {
    backgroundColor: UI.surfaceSoft,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 10,
    padding: 10,
    gap: 3,
  },
  noteBoxLabel: { fontSize: 11, fontWeight: '800', color: UI.textSecondary },
  noteBoxText: { fontSize: 12, color: UI.text, lineHeight: 18 },
  propMiniRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  propThumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: UI.slateSoft },
  propThumbPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: UI.slateSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: UI.border,
  },
  propTitle: { fontSize: 13, fontWeight: '800', color: UI.text },
  actionsFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: UI.borderLight,
    alignItems: 'center',
  },
  actBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: UI.green,
  },
  actBtnPrimaryText: { color: UI.white, fontSize: 12, fontWeight: '800' },
  actBtnDark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: UI.text,
  },
  actBtnDarkText: { color: UI.white, fontSize: 12, fontWeight: '800' },
  actBtnSoftGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: UI.greenSoft,
    borderWidth: 1,
    borderColor: UI.greenBorder,
  },
  actBtnSoftGreenText: { color: UI.greenDark, fontSize: 12, fontWeight: '800' },
  actBtnAmber: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: UI.amberSoft,
    borderWidth: 1,
    borderColor: UI.amberBorder,
  },
  actBtnAmberText: { color: UI.amberText, fontSize: 12, fontWeight: '800' },
  actBtnOrange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  actBtnOrangeText: { color: '#9A3412', fontSize: 12, fontWeight: '800' },
  actBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: UI.dangerSoft,
    borderWidth: 1,
    borderColor: UI.dangerBorder,
  },
  actBtnDangerText: { color: UI.danger, fontSize: 12, fontWeight: '800' },
  actBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: UI.white,
    borderWidth: 1,
    borderColor: UI.border,
  },
  actBtnOutlineText: { color: UI.text, fontSize: 12, fontWeight: '700' },
  actBtnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: UI.surfaceSoft,
  },
  actBtnGhostText: { color: UI.muted, fontSize: 12, fontWeight: '700' },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: UI.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UI.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  paginationInfo: { fontSize: 12, fontWeight: '700', color: UI.muted },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.white,
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { fontSize: 12, fontWeight: '700', color: UI.text },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: UI.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: UI.border,
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: '900', color: UI.text },
  modalSub: { fontSize: 12, color: UI.muted, marginTop: 2 },
  modalBodyText: { fontSize: 13, color: UI.textSecondary, lineHeight: 19 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: UI.text },
  textInput: {
    backgroundColor: UI.surfaceSoft,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: UI.text,
  },
  modalActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  btnPrimary: {
    backgroundColor: UI.green,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: UI.white, fontSize: 13, fontWeight: '800' },
  btnSecondary: {
    backgroundColor: UI.slateSoft,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: { color: UI.textSecondary, fontSize: 13, fontWeight: '700' },
  contactBox: {
    backgroundColor: UI.surfaceSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UI.border,
    padding: 14,
    gap: 12,
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactLabel: { fontSize: 11, color: UI.muted, fontWeight: '600' },
  contactValue: { fontSize: 14, color: UI.text, fontWeight: '800' },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: UI.greenSoft,
    borderWidth: 1,
    borderColor: UI.greenBorder,
  },
  copyBtnText: { fontSize: 11, fontWeight: '800', color: UI.greenDark },
  auditHintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: UI.blueSoft,
    borderWidth: 1,
    borderColor: UI.blueBorder,
    borderRadius: 10,
    padding: 10,
  },
  auditHintText: { flex: 1, fontSize: 11, color: UI.blue, lineHeight: 16 },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.white,
  },
  selectRowActive: { backgroundColor: UI.greenSoft, borderColor: UI.greenBorder },
  selectRowTitle: { fontSize: 13, fontWeight: '800', color: UI.text },
  selectRowSub: { fontSize: 11, color: UI.muted },
  associatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UI.greenBorder,
    backgroundColor: '#F5FBF8',
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.white,
  },
  matchThumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: UI.slateSoft },
  matchThumbSmall: { width: 48, height: 48, borderRadius: 8, backgroundColor: UI.slateSoft },
  matchTitle: { fontSize: 13, fontWeight: '800', color: UI.text },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: UI.border,
    backgroundColor: UI.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: UI.green, borderColor: UI.green },
  specPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: UI.slateSoft,
  },
  specPillText: { fontSize: 11, fontWeight: '600', color: UI.textSecondary },
  matchTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: UI.greenSoft,
  },
  matchTagText: { fontSize: 10, fontWeight: '700', color: UI.greenDark },
  assocFormBox: {
    backgroundColor: UI.surfaceSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UI.border,
    padding: 12,
    gap: 10,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: UI.surfaceSoft,
    borderWidth: 1,
    borderColor: UI.border,
  },
  timelineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: UI.green,
    marginTop: 5,
  },
  timelineAction: { fontSize: 13, fontWeight: '800', color: UI.text },
  timelineDate: { fontSize: 11, color: UI.muted, fontWeight: '600' },
  timelineActor: { fontSize: 12, color: UI.greenDark, fontWeight: '700' },
  timelineDetail: { fontSize: 12, color: UI.textSecondary },
});
