import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type {
  AdminDemandeClientItem,
  AdminUserItem,
  AdminVisiteItem,
  AgentKycDossier,
  AgentKycItem,
  AuditLogItem,
  BackendProperty,
  CoordonneesUnmaskedData,
  DemandeDemasquageItem,
  DemandeRechercheItem,
  GrandLivreEntry,
  KkiapayWidgetConfig,
  LegalDocumentItem,
  MatchingPropertySuggestion,
  NotificationInterneItem,
  OperationalMetricsData,
  PaginatedPayload,
  PaginationMeta,
  PaymentInitData,
  PaymentOperationType,
  PaymentReceiptData,
  PropertyDocumentItem,
  RetraitItem,
  SystemHealthReport,
  TechNotificationLogItem,
  VisiteBackendItem,
  WebhookHealthReport,
  ZonePerformanceData,
  ZoneSummary,
} from '@/types/api';

/**
 * URL de base de l'API backend Laravel.
 * - Sur Android Emulator : 10.0.2.2 redirige vers le localhost de la machine hôte
 * - Sur Web / iOS Simulator : 127.0.0.1:8000
 * - Configurable via EXPO_PUBLIC_API_URL
 */
export const getApiBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api';
  }
  return 'http://127.0.0.1:8000/api';
};

export const getStorageBaseUrl = (): string => {
  return getApiBaseUrl().replace(/\/api$/i, '');
};

/**
 * Gestionnaire du token d'authentification Sanctum (AsyncStorage / mémoire).
 */
const AUTH_TOKEN_KEY = 'e_mobilier_auth_token';
let inMemoryToken: string | null = null;

export const tokenStorage = {
  get: async (): Promise<string | null> => {
    if (inMemoryToken) return inMemoryToken;
    try {
      const stored = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (stored) {
        inMemoryToken = stored;
        return stored;
      }
    } catch {
      // Ignore
    }
    return inMemoryToken;
  },
  set: async (token: string): Promise<void> => {
    inMemoryToken = token;
    try {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    } catch {
      // Ignore
    }
  },
  remove: async (): Promise<void> => {
    inMemoryToken = null;
    try {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
      // Ignore
    }
  },
};

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
  statusCode?: number;
  code?: string;
  pagination?: PaginationMeta;
  statistiques?: Record<string, any>;
  kkiapay?: KkiapayWidgetConfig;
  already_unlocked?: boolean;
  demasquage_requis?: boolean;
  [key: string]: any;
}

export interface InscriptionPayload {
  fullName: string;
  phone: string;
  email?: string;
  password: string;
  role: 'client_proprietaire' | 'agent_immobilier';
  acceptedTerms?: boolean;
}

export interface AuthentificationPayload {
  phone: string;
  password: string;
}

export interface AuthResponseData {
  user: {
    id: string;
    name: string;
    nom?: string;
    prenom?: string;
    fullName?: string;
    phone: string;
    telephone?: string;
    email?: string;
    role: 'client_proprietaire' | 'agent_immobilier';
    roles?: string[];
    is_verifed: boolean;
    statut?: string;
    zone_id?: number | null;
    balanceFifa: number;
    created_at?: string;
  };
  token: string;
  token_type: string;
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '' && val !== 'tous') {
      qs.append(key, String(val));
    }
  });
  const str = qs.toString();
  return str ? `?${str}` : '';
}

/**
 * Fonction générique pour effectuer des requêtes vers l'API.
 * Supporte JSON et FormData (multipart/form-data).
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${cleanEndpoint}`;
  const token = await tokenStorage.get();

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ...(json || {}),
        success: false,
        statusCode: response.status,
        message: json?.message || `Erreur serveur (${response.status})`,
        errors: json?.errors,
        data: json?.data,
      };
    }

    return json ? { ...json, statusCode: response.status } : { success: true, statusCode: response.status };
  } catch {
    return {
      success: false,
      message:
        'Impossible de contacter le serveur E-Mobilier. Vérifiez que le backend est actif et joignable.',
    };
  }
}

/**
 * Méthodes d'authentification et de profil.
 */
export const authApi = {
  inscription: async (payload: InscriptionPayload): Promise<ApiResponse<AuthResponseData>> => {
    const res = await apiRequest<AuthResponseData>('/inscription', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.success && res.data?.token) {
      await tokenStorage.set(res.data.token);
    }
    return res;
  },

  authentification: async (
    payload: AuthentificationPayload
  ): Promise<ApiResponse<AuthResponseData>> => {
    const res = await apiRequest<AuthResponseData>('/authentification', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.success && res.data?.token) {
      await tokenStorage.set(res.data.token);
    }
    return res;
  },

  profil: async (): Promise<ApiResponse<{ user: AuthResponseData['user'] }>> => {
    return apiRequest('/profil', { method: 'GET' });
  },

  deconnexion: async (): Promise<ApiResponse> => {
    const res = await apiRequest('/deconnexion', { method: 'POST' });
    await tokenStorage.remove();
    return res;
  },
};

/**
 * Conformité légale : CGU & Charte de Non-Contournement.
 */
export const cguApi = {
  getCguCourante: async (): Promise<ApiResponse<LegalDocumentItem>> => {
    return apiRequest('/cgu/courante', { method: 'GET' });
  },

  signerCharte: async (acceptation = true): Promise<ApiResponse<any>> => {
    return apiRequest('/admin/charte/signer', {
      method: 'POST',
      body: JSON.stringify({ acceptation }),
    });
  },

  publierDocument: async (payload: {
    type: 'cgu' | 'charte_non_contournement';
    titre: string;
    version: string;
    contenu: string;
  }): Promise<ApiResponse<LegalDocumentItem>> => {
    return apiRequest('/admin/cgu', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

/**
 * Paiements Kkiapay & Quittances officielles.
 */
export const paiementsApi = {
  getKkiapayConfig: async (): Promise<
    ApiResponse<{
      widget: KkiapayWidgetConfig;
      pricing: {
        post_client: number;
        post_agent: number;
        unlock_details: number;
        current_user_post_fee: number;
      };
      user?: { name: string; phone?: string; email?: string } | null;
    }>
  > => {
    return apiRequest('/kkiapay/config', { method: 'GET' });
  },

  initier: async (payload: {
    type_operation: PaymentOperationType;
    entity_id?: number | null;
    cgu_acceptees: boolean;
  }): Promise<ApiResponse<PaymentInitData>> => {
    return apiRequest('/paiements/initier', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  verifier: async (payload: {
    transactionId: string;
    reference?: string;
    amount?: number;
  }): Promise<ApiResponse<any>> => {
    return apiRequest('/paiements/verifier', {
      method: 'POST',
      body: JSON.stringify({
        transactionId: payload.transactionId,
        reference: payload.reference,
        amount: payload.amount,
      }),
    });
  },

  verifierKkiapay: async (payload: {
    transactionId: string;
    amount?: number;
  }): Promise<ApiResponse<any>> => {
    return apiRequest('/kkiapay/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getRecu: async (ref: string): Promise<ApiResponse<PaymentReceiptData>> => {
    return apiRequest(`/paiements/${encodeURIComponent(ref)}/recu`, { method: 'GET' });
  },
};

/**
 * Propriétés & Catalogue immobilier.
 */
export const proprietesApi = {
  getFeed: async (filters?: {
    type?: string;
    transaction_type?: string;
    commune?: string;
    arrondissement?: string;
    quartier?: string;
    prix_min?: number;
    prix_max?: number;
    nombres_chambres?: number;
    search?: string;
    page?: number;
    per_page?: number;
  }): Promise<ApiResponse<PaginatedPayload<BackendProperty>>> => {
    const query = buildQuery(filters || {});
    return apiRequest(`/proprietes${query}`, { method: 'GET' });
  },

  getMyProperties: async (page = 1): Promise<ApiResponse<PaginatedPayload<BackendProperty>>> => {
    return apiRequest(`/mes-proprietes?page=${page}`, { method: 'GET' });
  },

  getById: async (id: number | string): Promise<ApiResponse<BackendProperty>> => {
    return apiRequest(`/proprietes/${id}`, { method: 'GET' });
  },

  create: async (formData: FormData): Promise<ApiResponse<any>> => {
    return apiRequest('/proprietes', {
      method: 'POST',
      body: formData,
    });
  },

  update: async (id: number | string, payload: FormData | Record<string, any>): Promise<ApiResponse<any>> => {
    if (typeof FormData !== 'undefined' && payload instanceof FormData) {
      return apiRequest(`/proprietes/${id}`, {
        method: 'POST',
        body: payload,
      });
    }
    return apiRequest(`/proprietes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  delete: async (id: number | string): Promise<ApiResponse<any>> => {
    return apiRequest(`/proprietes/${id}`, { method: 'DELETE' });
  },

  unlockDetails: async (
    id: number | string,
    transactionId: string
  ): Promise<ApiResponse<BackendProperty>> => {
    return apiRequest(`/proprietes/${id}/debloquer`, {
      method: 'POST',
      body: JSON.stringify({
        kkiapay_transaction_id: transactionId,
      }),
    });
  },
};

/**
 * Demandes de recherche de biens (Client).
 */
export const demandesRechercheApi = {
  getMyRequests: async (filters?: {
    status?: string;
    property_type?: string;
    transaction_type?: string;
    page?: number;
  }): Promise<ApiResponse<PaginatedPayload<DemandeRechercheItem>>> => {
    const query = buildQuery(filters || {});
    return apiRequest(`/mes-demandes-recherche${query}`, { method: 'GET' });
  },

  create: async (payload: {
    property_type: 'parcelle' | 'maison' | 'chambre';
    transaction_type: 'location' | 'vente';
    target_commune: string;
    target_arrondissement?: string;
    target_quartier?: string;
    budget_max: number;
    criteria_details?: string;
  }): Promise<ApiResponse<DemandeRechercheItem>> => {
    return apiRequest('/demandes-recherche', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getById: async (id: number | string): Promise<ApiResponse<DemandeRechercheItem>> => {
    return apiRequest(`/demandes-recherche/${id}`, { method: 'GET' });
  },

  update: async (
    id: number | string,
    payload: Partial<{
      property_type: 'parcelle' | 'maison' | 'chambre';
      transaction_type: 'location' | 'vente';
      target_commune: string;
      target_arrondissement: string;
      target_quartier: string;
      budget_max: number;
      criteria_details: string;
    }>
  ): Promise<ApiResponse<DemandeRechercheItem>> => {
    return apiRequest(`/demandes-recherche/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  delete: async (id: number | string): Promise<ApiResponse<any>> => {
    return apiRequest(`/demandes-recherche/${id}`, { method: 'DELETE' });
  },
};

/**
 * Demandes de visites physiques (500 FCFA).
 */
export const visitesApi = {
  requestVisit: async (payload: {
    property_id: number | string;
    scheduled_date: string;
    kkiapay_transaction_id: string;
  }): Promise<ApiResponse<{ visite: VisiteBackendItem; paiement: any }>> => {
    return apiRequest('/visites', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getMyVisits: async (status?: string, page = 1): Promise<ApiResponse<PaginatedPayload<VisiteBackendItem>>> => {
    const query = buildQuery({ status, page });
    return apiRequest(`/mes-visites${query}`, { method: 'GET' });
  },

  getById: async (id: number | string): Promise<ApiResponse<VisiteBackendItem>> => {
    return apiRequest(`/visites/${id}`, { method: 'GET' });
  },

  cancelVisit: async (id: number | string): Promise<ApiResponse<VisiteBackendItem>> => {
    return apiRequest(`/visites/${id}/annuler`, { method: 'POST' });
  },
};

/**
 * Notifications internes & Jetons Push.
 */
export const notificationsApi = {
  list: async (page = 1, perPage = 20): Promise<ApiResponse<NotificationInterneItem[]>> => {
    return apiRequest(`/notifications?page=${page}&per_page=${perPage}`, { method: 'GET' });
  },

  markRead: async (id: number): Promise<ApiResponse<any>> => {
    return apiRequest(`/notifications/${id}/lire`, { method: 'POST' });
  },

  markAllRead: async (): Promise<ApiResponse<any>> => {
    return apiRequest('/notifications/tout-lire', { method: 'POST' });
  },

  registerDeviceToken: async (payload: {
    token: string;
    platform?: 'android' | 'ios' | 'web';
    device_name?: string;
  }): Promise<ApiResponse<any>> => {
    return apiRequest('/user/device-token', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteDeviceToken: async (token?: string): Promise<ApiResponse<any>> => {
    return apiRequest('/user/device-token', {
      method: 'DELETE',
      body: token ? JSON.stringify({ token }) : undefined,
    });
  },
};

/**
 * Administration, Gouvernance, Opérations (Briques A-E) & Technique.
 */
export const adminApi = {
  // Zones
  getZones: async (filters?: { is_active?: boolean; commune?: string }): Promise<ApiResponse<ZoneSummary[]>> => {
    return apiRequest(`/admin/zones${buildQuery(filters || {})}`, { method: 'GET' });
  },
  createZone: async (payload: {
    nom: string;
    departement: string;
    commune: string;
    code: string;
    description?: string;
    is_active?: boolean;
  }): Promise<ApiResponse<ZoneSummary>> => {
    return apiRequest('/admin/zones', { method: 'POST', body: JSON.stringify(payload) });
  },
  updateZone: async (id: number, payload: Partial<ZoneSummary>): Promise<ApiResponse<ZoneSummary>> => {
    return apiRequest(`/admin/zones/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  // Utilisateurs RBAC
  getUsers: async (filters?: { statut?: string; role?: string; zone_id?: number; page?: number }): Promise<ApiResponse<PaginatedPayload<AdminUserItem>>> => {
    return apiRequest(`/admin/utilisateurs${buildQuery(filters || {})}`, { method: 'GET' });
  },
  createUser: async (payload: {
    name: string;
    prenom: string;
    email: string;
    telephone: string;
    password: string;
    role: 'Super Admin Technique' | 'Secrétaire' | 'Responsable de zone';
    zone_id?: number | null;
  }): Promise<ApiResponse<AdminUserItem>> => {
    return apiRequest('/admin/utilisateurs', { method: 'POST', body: JSON.stringify(payload) });
  },
  updateUserRoleZone: async (
    id: number,
    payload: { role?: string; zone_id?: number | null }
  ): Promise<ApiResponse<AdminUserItem>> => {
    return apiRequest(`/admin/utilisateurs/${id}/role-zone`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  updateUserStatut: async (
    id: number,
    payload: { statut: 'actif' | 'suspendu'; motif?: string }
  ): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/utilisateurs/${id}/statut`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Audit logs
  getAuditLogs: async (filters?: { action?: string; page?: number }): Promise<ApiResponse<PaginatedPayload<AuditLogItem>>> => {
    return apiRequest(`/admin/audit-logs${buildQuery(filters || {})}`, { method: 'GET' });
  },

  // Phase 2 : Démasquage & Coordonnées tracées
  demanderDemasquage: async (payload: {
    type_dossier: 'visite' | 'demande_client';
    dossier_id: number;
    motif: string;
    justification: string;
  }): Promise<ApiResponse<DemandeDemasquageItem>> => {
    return apiRequest('/admin/demasquages/demander', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  mesDemandesDemasquage: async (page = 1): Promise<ApiResponse<PaginatedPayload<DemandeDemasquageItem>>> => {
    return apiRequest(`/admin/demasquages/mes-demandes?page=${page}`, { method: 'GET' });
  },
  enAttenteDemasquage: async (page = 1): Promise<ApiResponse<PaginatedPayload<DemandeDemasquageItem>>> => {
    return apiRequest(`/admin/demasquages/en-attente?page=${page}`, { method: 'GET' });
  },
  approuverDemasquage: async (id: number, dureeMinutes = 120): Promise<ApiResponse<DemandeDemasquageItem>> => {
    return apiRequest(`/admin/demasquages/${id}/approuver`, {
      method: 'POST',
      body: JSON.stringify({ duree_minutes: dureeMinutes }),
    });
  },
  refuserDemasquage: async (id: number, motifRefus: string): Promise<ApiResponse<DemandeDemasquageItem>> => {
    return apiRequest(`/admin/demasquages/${id}/refuser`, {
      method: 'POST',
      body: JSON.stringify({ motif_refus: motifRefus }),
    });
  },
  revoquerDemasquage: async (id: number): Promise<ApiResponse<DemandeDemasquageItem>> => {
    return apiRequest(`/admin/demasquages/${id}/revoquer`, { method: 'POST' });
  },
  getDossierCoordonnees: async (
    type: 'visite' | 'demande_client',
    id: number
  ): Promise<ApiResponse<CoordonneesUnmaskedData>> => {
    return apiRequest(`/admin/dossiers/${type}/${id}/coordonnees`, { method: 'GET' });
  },

  // Brique A : Modération catalogue
  getProprietesEnAttente: async (page = 1): Promise<ApiResponse<BackendProperty[]>> => {
    return apiRequest(`/admin/proprietes/en-attente?page=${page}`, { method: 'GET' });
  },
  validerPropriete: async (id: number): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/proprietes/${id}/valider`, { method: 'POST' });
  },
  rejeterPropriete: async (id: number, motif: string): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/proprietes/${id}/rejeter`, {
      method: 'POST',
      body: JSON.stringify({ motif }),
    });
  },
  getProprieteDocuments: async (id: number): Promise<ApiResponse<PropertyDocumentItem[]>> => {
    return apiRequest(`/admin/proprietes/${id}/documents`, { method: 'GET' });
  },
  marquerProprieteConclue: async (id: number): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/proprietes/${id}/marquer-conclu`, { method: 'POST' });
  },

  // Brique B : Visites Admin & Opérations
  getAdminVisites: async (filters?: { status?: string; zone_id?: number; page?: number }): Promise<ApiResponse<PaginatedPayload<AdminVisiteItem>>> => {
    return apiRequest(`/admin/visites${buildQuery(filters || {})}`, { method: 'GET' });
  },
  getAdminVisite: async (id: number): Promise<ApiResponse<AdminVisiteItem>> => {
    return apiRequest(`/admin/visites/${id}`, { method: 'GET' });
  },
  updateAdminVisiteStatut: async (id: number, status: string, motif?: string): Promise<ApiResponse<AdminVisiteItem>> => {
    return apiRequest(`/admin/visites/${id}/statut`, {
      method: 'PATCH',
      body: JSON.stringify({ status, motif }),
    });
  },
  assignerZoneVisite: async (
    id: number,
    zoneId: number,
    targetAgentId?: number | null
  ): Promise<ApiResponse<AdminVisiteItem>> => {
    return apiRequest(`/admin/visites/${id}/assigner-zone`, {
      method: 'POST',
      body: JSON.stringify({ zone_id: zoneId, target_agent_id: targetAgentId || null }),
    });
  },
  planifierVisite: async (
    id: number,
    payload: { scheduled_date: string; instructions_itineraire?: string; target_agent_id?: number }
  ): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/visites/${id}/planifier`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  saisirCompteRendu: async (id: number, compteRendu: string): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/visites/${id}/compte-rendu`, {
      method: 'POST',
      body: JSON.stringify({ compte_rendu: compteRendu }),
    });
  },
  cloturerVisite: async (
    id: number,
    issue: 'succes_offre' | 'sans_suite' | 'client_absent' | 'autre',
    motif?: string
  ): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/visites/${id}/cloturer`, {
      method: 'POST',
      body: JSON.stringify({ issue, motif }),
    });
  },
  escaladerOffreVisite: async (
    id: number,
    commentaires: string,
    offreMontant?: number
  ): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/visites/${id}/escalader-offre`, {
      method: 'POST',
      body: JSON.stringify({ commentaires, offre_montant: offreMontant }),
    });
  },

  // Brique C : Demandes Clients & Matching
  getAdminDemandes: async (filters?: { status?: string; property_type?: string; page?: number }): Promise<ApiResponse<PaginatedPayload<AdminDemandeClientItem>>> => {
    return apiRequest(`/admin/demandes-clients${buildQuery(filters || {})}`, { method: 'GET' });
  },
  getAdminDemande: async (id: number): Promise<ApiResponse<AdminDemandeClientItem>> => {
    return apiRequest(`/admin/demandes-clients/${id}`, { method: 'GET' });
  },
  prendreEnChargeDemande: async (id: number): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/demandes-clients/${id}/prendre-en-charge`, { method: 'POST' });
  },
  getMatchingBiens: async (
    id: number
  ): Promise<
    ApiResponse<{
      biens_suggeres: MatchingPropertySuggestion[];
      total_biens_compatibles: number;
    }>
  > => {
    return apiRequest(`/admin/demandes-clients/${id}/matching-biens`, { method: 'GET' });
  },
  associerBienDemande: async (id: number, proprieteId: number): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/demandes-clients/${id}/associer-bien`, {
      method: 'POST',
      body: JSON.stringify({ propriete_id: proprieteId }),
    });
  },
  cloturerDemande: async (
    id: number,
    motifCloture: 'satisfaite' | 'abandonnee_client' | 'delai_depasse'
  ): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/demandes-clients/${id}/cloturer`, {
      method: 'POST',
      body: JSON.stringify({ motif_cloture: motifCloture }),
    });
  },

  // Brique D : KYC Agents Mobiliers
  getAgents: async (filters?: { statut?: string; verifie?: boolean; page?: number }): Promise<ApiResponse<AgentKycItem[]>> => {
    return apiRequest(`/admin/agents-mobiliers${buildQuery(filters || {})}`, { method: 'GET' });
  },
  getAgentDossier: async (id: number): Promise<ApiResponse<AgentKycDossier>> => {
    return apiRequest(`/admin/agents-mobiliers/${id}/dossier`, { method: 'GET' });
  },
  approuverAgent: async (id: number): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/agents-mobiliers/${id}/approuver`, { method: 'POST' });
  },
  suspendreAgent: async (id: number): Promise<ApiResponse<any>> => {
    return apiRequest(`/admin/agents-mobiliers/${id}/suspendre`, { method: 'POST' });
  },

  // Brique E : Métriques opérationnelles
  getOperationsGlobales: async (): Promise<ApiResponse<OperationalMetricsData>> => {
    return apiRequest('/admin/metriques/operations-globales', { method: 'GET' });
  },
  getZonePerformance: async (zoneId?: number): Promise<ApiResponse<ZonePerformanceData>> => {
    return apiRequest(`/admin/metriques/zone-performance${buildQuery({ zone_id: zoneId })}`, {
      method: 'GET',
    });
  },

  // Santé Système, Webhooks, Notifications DLQ & Sécurité
  getSystemHealth: async (): Promise<ApiResponse<SystemHealthReport>> => {
    return apiRequest('/tech/system-health', { method: 'GET' });
  },
  getWebhooksHealth: async (): Promise<ApiResponse<WebhookHealthReport>> => {
    return apiRequest('/tech/webhooks/health', { method: 'GET' });
  },
  getTechNotificationLogs: async (filters?: { statut?: string; canal?: string; page?: number }): Promise<ApiResponse<TechNotificationLogItem[]>> => {
    return apiRequest(`/tech/notifications/logs${buildQuery(filters || {})}`, { method: 'GET' });
  },
  relancerTechNotification: async (id: number): Promise<ApiResponse<any>> => {
    return apiRequest(`/tech/notifications/${id}/relancer`, { method: 'POST' });
  },
  revoquerTousDemasquages: async (motif?: string): Promise<ApiResponse<any>> => {
    return apiRequest('/admin/securite/revoquer-tous-demasquages', {
      method: 'POST',
      body: JSON.stringify({ motif }),
    });
  },
  getSecurityAlertes: async (page = 1): Promise<ApiResponse<AuditLogItem[]>> => {
    return apiRequest(`/admin/securite/alertes?page=${page}`, { method: 'GET' });
  },
};

/**
 * Coffre-Fort Financier & Retraits OTP (Super Admin Principal uniquement).
 */
export const financeApi = {
  getTableauDeBord: async (): Promise<ApiResponse<Record<string, any>>> => {
    return apiRequest('/finance/tableau-de-bord', { method: 'GET' });
  },
  getTransactions: async (filters?: {
    type_mouvement?: string;
    categorie?: string;
    page?: number;
  }): Promise<ApiResponse<PaginatedPayload<GrandLivreEntry>>> => {
    return apiRequest(`/finance/transactions${buildQuery(filters || {})}`, { method: 'GET' });
  },
  exportTransactions: async (): Promise<ApiResponse<GrandLivreEntry[]>> => {
    return apiRequest('/finance/transactions/export', { method: 'GET' });
  },
  getWebhooks: async (page = 1): Promise<ApiResponse<PaginatedPayload<any>>> => {
    return apiRequest(`/finance/webhooks?page=${page}`, { method: 'GET' });
  },
  getRetraits: async (page = 1): Promise<ApiResponse<PaginatedPayload<RetraitItem>>> => {
    return apiRequest(`/finance/retraits?page=${page}`, { method: 'GET' });
  },
  initierRetrait: async (
    montant: number,
    typeCompte: 'mobile_money' | 'virement_bancaire' = 'mobile_money'
  ): Promise<ApiResponse<any>> => {
    return apiRequest('/finance/retraits/initier', {
      method: 'POST',
      body: JSON.stringify({ montant, type_compte: typeCompte }),
    });
  },
  confirmerOtpRetrait: async (id: number, codeOtp: string): Promise<ApiResponse<any>> => {
    return apiRequest(`/finance/retraits/${id}/confirmer-otp`, {
      method: 'POST',
      body: JSON.stringify({ code_otp: codeOtp }),
    });
  },
  annulerRetrait: async (id: number, motif?: string): Promise<ApiResponse<any>> => {
    return apiRequest(`/finance/retraits/${id}/annuler`, {
      method: 'POST',
      body: JSON.stringify({ motif }),
    });
  },
  getNotificationsAudit: async (filters?: { canal?: string; statut?: string; page?: number }): Promise<ApiResponse<any[]>> => {
    return apiRequest(`/finance/notifications/audit${buildQuery(filters || {})}`, { method: 'GET' });
  },
  verifierIntegrite: async (): Promise<ApiResponse<Record<string, any>>> => {
    return apiRequest('/finance/securite/verifier-integrite', { method: 'POST' });
  },
  gelerRetraits: async (motif: string): Promise<ApiResponse<any>> => {
    return apiRequest('/finance/securite/geler-retraits', {
      method: 'POST',
      body: JSON.stringify({ motif }),
    });
  },
  degelerRetraits: async (): Promise<ApiResponse<any>> => {
    return apiRequest('/finance/securite/degeler-retraits', { method: 'POST' });
  },
  getSecurityStatut: async (): Promise<ApiResponse<{ retraits_geles: boolean }>> => {
    return apiRequest('/finance/securite/statut', { method: 'GET' });
  },
};
