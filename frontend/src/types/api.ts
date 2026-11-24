export type PropertyTypeBackend = 'parcelle' | 'maison' | 'chambre';
export type TransactionTypeBackend = 'vente' | 'location';
export type PropertyStatusBackend = 'pending' | 'pending_payment' | 'published' | 'rejected' | 'sold_rented';

export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface PaginatedPayload<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface PropertyMediaItem {
  id: number;
  propriete_id: number;
  media_url: string;
  media_type: 'image' | 'video' | string;
  created_at?: string;
}

export interface PropertyDocumentItem {
  id: number;
  propriete_id?: number;
  document_type?: string;
  type?: string;
  nom?: string;
  document_url?: string;
  url_consultation?: string;
  created_at?: string;
}

export interface ZoneSummary {
  id: number;
  nom: string;
  code: string;
  commune: string;
  departement?: string;
  arrondissements?: string[];
  description?: string | null;
  is_active?: boolean;
  users_count?: number;
  proprietes_count?: number;
}

export interface PropertyUserSummary {
  id: number;
  name: string;
  prenom?: string;
  fullName?: string;
  telephone?: string | null;
  email?: string | null;
  is_verifed?: boolean;
}

export interface BackendProperty {
  id: number;
  user_id: number;
  zone_id?: number | null;
  type: PropertyTypeBackend;
  transaction_type: TransactionTypeBackend;
  commune: string;
  arrondissement?: string | null;
  quartier?: string | null;
  location_details?: string | null;
  accessibilite?: string | null;
  eau_courant?: string | null;
  surface: number | string;
  nombres_chambres?: number | null;
  avance_mois?: number | null;
  prix: number | string;
  is_negotiable?: boolean;
  description?: string | null;
  status: PropertyStatusBackend | string;
  motif_rejet?: string | null;
  is_unlocked?: boolean;
  unlock_fee?: number;
  visit_fee?: number;
  media?: PropertyMediaItem[];
  documents?: PropertyDocumentItem[];
  user?: PropertyUserSummary;
  zone?: ZoneSummary | null;
  created_at?: string;
  updated_at?: string;
}

export interface DemandeRechercheItem {
  id: number;
  client_id: number;
  zone_id?: number | null;
  gestionnaire_id?: number | null;
  matched_propriete_id?: number | null;
  property_type: PropertyTypeBackend;
  transaction_type: TransactionTypeBackend;
  target_commune: string;
  target_arrondissement?: string | null;
  target_quartier?: string | null;
  budget_max: number | string;
  criteria_details?: string | null;
  is_paid?: boolean;
  status: 'active' | 'fulfilled' | 'closed' | string;
  motif_cloture?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface VisiteBackendItem {
  id: number;
  client_id: number;
  property_id: number;
  target_agent_id?: number | null;
  zone_id?: number | null;
  scheduled_date: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | string;
  is_fee_paid?: boolean;
  instructions_itineraire?: string | null;
  compte_rendu?: string | null;
  issue_cloture?: string | null;
  is_escalade_haute?: boolean;
  offre_montant?: number | string | null;
  propriete?: BackendProperty;
  client?: PropertyUserSummary & {
    pseudo?: string;
    nom_complet?: string;
    donnees_masquees?: boolean;
  };
  agent?: PropertyUserSummary;
  created_at?: string;
}

export interface NotificationInterneItem {
  id: number;
  type: string;
  titre: string;
  message: string;
  data?: Record<string, unknown>;
  lu: boolean;
  lu_a?: string | null;
  created_at: string;
}

export interface LegalDocumentItem {
  id: number;
  type: 'cgu' | 'charte_non_contournement' | string;
  titre: string;
  version: string;
  contenu: string;
  hash_contenu: string;
  published_at: string;
}

export type PaymentOperationType =
  | 'visite'
  | 'deblocage_coordonnees'
  | 'publication_client'
  | 'publication_agent';

export interface KkiapayWidgetConfig {
  public_key: string | null;
  amount: number;
  reason: string;
  sandbox: boolean;
  theme?: string;
  callback?: string;
}

export interface PaymentInitData {
  reference: string;
  montant_officiel: number;
  devise: string;
  type_operation: PaymentOperationType;
  gateway: string;
  widget_config: KkiapayWidgetConfig;
}

export interface PaymentReceiptData {
  quittance_numero: string;
  reference_transaction: string;
  emetteur: string;
  payeur: {
    id: number;
    nom?: string;
    email?: string;
  };
  montant_paye: number;
  devise: string;
  type_prestation: string;
  mode_reglement: string;
  statut: string;
  date_reglement?: string;
}

export interface AdminUserItem {
  id: number;
  name: string;
  prenom?: string;
  email: string;
  telephone?: string;
  statut: 'actif' | 'suspendu' | string;
  is_verifed?: boolean;
  zone_id?: number | null;
  roles?: Array<{ id: number; name: string }>;
  zone?: ZoneSummary | null;
  created_at?: string;
}

export interface AdminVisiteItem {
  id: number;
  reference_visite: string;
  client_id: number;
  client?: {
    id: number;
    pseudo?: string;
    name?: string;
    prenom?: string;
    nom_complet?: string;
    telephone?: string;
    email?: string;
    is_verifed?: boolean;
    donnees_masquees?: boolean;
    demasquage_possible?: boolean;
  } | null;
  property_id: number;
  zone_id?: number | null;
  zone?: ZoneSummary | null;
  propriete?: {
    id: number;
    type: string;
    transaction_type: string;
    commune: string;
    arrondissement?: string;
    quartier?: string;
    prix: number | string;
    status: string;
  } | null;
  target_agent_id?: number | null;
  agent_assigne?: {
    id: number;
    nom_complet: string;
    email: string;
  } | null;
  scheduled_date?: string | null;
  status: string;
  is_fee_paid: boolean;
  statut_paiement: string;
  donnees_masquees: boolean;
  created_at?: string;
}

export interface AdminDemandeClientItem {
  id: number;
  reference_dossier: string;
  client_id: number;
  client?: {
    id: number;
    pseudo?: string;
    name?: string;
    prenom?: string;
    nom_complet?: string;
    telephone?: string;
    email?: string;
    is_verifed?: boolean;
    donnees_masquees?: boolean;
    demasquage_possible?: boolean;
  } | null;
  zone_id?: number | null;
  zone?: ZoneSummary | null;
  property_type: string;
  transaction_type: string;
  target_commune: string;
  target_arrondissement?: string | null;
  target_quartier?: string | null;
  budget_max: number | string;
  criteria_details?: string | null;
  is_paid: boolean;
  statut_paiement: string;
  status: string;
  donnees_masquees: boolean;
  created_at?: string;
}

export interface MatchingPropertySuggestion {
  propriete_id: number;
  type: string;
  transaction_type: string;
  commune: string;
  arrondissement?: string;
  quartier?: string;
  prix: number;
  surface: number;
  zone?: string | null;
  score_matching_pourcentage: number;
}

export interface DemandeDemasquageItem {
  id: number;
  user_id: number;
  type_dossier: 'visite' | 'demande_client';
  dossier_id: number;
  motif: string;
  justification: string;
  statut: 'en_attente' | 'approuve' | 'refuse' | 'revoque';
  duree_minutes: number;
  expires_at?: string | null;
  motif_refus?: string | null;
  is_currently_active?: boolean;
  temps_restant_minutes?: number;
  user?: {
    id: number;
    name: string;
    prenom?: string;
    email: string;
    statut?: string;
    zone?: { id: number; nom: string; code: string } | null;
  };
  approbateur?: {
    id: number;
    name: string;
    prenom?: string;
    email: string;
  } | null;
  created_at?: string;
}

export interface CoordonneesUnmaskedData {
  dossier_reference: string;
  client_id: number;
  nom: string;
  prenom?: string;
  nom_complet: string;
  telephone?: string;
  email?: string;
  is_verifed?: boolean;
  mode_acces: string;
  expires_at?: string | null;
}

export interface AuditLogItem {
  id: number;
  user_id?: number | null;
  action: string;
  is_financial?: boolean;
  details?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at: string;
  user?: {
    id: number;
    name: string;
    prenom?: string;
    email: string;
  } | null;
}

export interface SystemHealthReport {
  timestamp: string;
  environment: string;
  php_version: string;
  laravel_version: string;
  response_time_ms: number;
  infrastructure: {
    database: { driver: string; status: string; latency_ms: number | null };
    cache: { driver: string; status: string };
    queues: { driver: string; pending_jobs_count: number; failed_jobs_count: number };
  };
}

export interface WebhookHealthReport {
  passerelle_active: string;
  statistiques_techniques: {
    total_reçus: number;
    signatures_valides: number;
    signatures_invalides: number;
    doublons_neutralises: number;
    reconciliations_reussies: number;
  };
  derniers_evenements: Array<{
    id: number;
    gateway: string;
    event_type: string;
    status_http: number;
    is_signature_valid: boolean;
    reconciliation_status: string;
    ip_address?: string | null;
    created_at: string;
  }>;
}

export interface TechNotificationLogItem {
  id: number;
  reference_evenement?: string;
  file_priorite: string;
  canal: string;
  destinataire_type: string;
  sujet: string;
  statut: 'envoye' | 'replie_sms' | 'echec' | string;
  tentatives: number;
  erreur_technique?: string | null;
  latence_ms?: number | null;
  created_at: string;
}

export interface AgentKycItem {
  id: number;
  name: string;
  prenom?: string;
  email: string;
  telephone?: string;
  statut: string;
  is_verifed: boolean;
  zone?: ZoneSummary | null;
  created_at?: string;
}

export interface AgentKycDossier {
  agent: {
    id: number;
    nom_complet: string;
    email: string;
    telephone?: string;
    statut: string;
    is_verifed: boolean;
    zone?: string | null;
    date_inscription: string;
  };
  statistiques_activite: {
    total_annonces: number;
    annonces_en_ligne: number;
    annonces_conclues: number;
  };
}

export interface OperationalMetricsData {
  periode: { mois: string; debut: string; fin: string };
  indicateurs_visites_terrain: {
    total_visites: number;
    visites_effectuees: number;
    taux_completion_pourcentage: number;
  };
  indicateurs_demandes_recherche: {
    total_demandes: number;
    demandes_satisfaites: number;
    taux_transformation_pourcentage: number;
  };
  catalogue_immobilier: {
    annonces_en_ligne: number;
    annonces_en_attente_moderation: number;
    biens_vendus_ou_loues_ce_mois: number;
  };
}

export interface ZonePerformanceData {
  zone: { id: number; nom: string; code: string };
  performance_operationnelle: Record<string, number>;
}

export interface GrandLivreEntry {
  id: number;
  reference_unique: string;
  type_mouvement: 'CREDIT' | 'DEBIT' | string;
  categorie: string;
  montant_brut: number | string;
  frais_passerelle: number | string;
  montant_net: number | string;
  solde_apres: number | string;
  description: string;
  client?: { id: number; name: string; prenom?: string; email: string } | null;
  created_at: string;
}

export interface RetraitItem {
  id: number;
  reference_retrait: string;
  montant: number | string;
  type_compte: string;
  beneficiaire_nom?: string;
  beneficiaire_numero?: string;
  statut: 'en_attente_otp' | 'execute' | 'annule' | 'echec' | string;
  created_at: string;
}

export type InquiryActionType =
  | 'demande_visite'
  | 'rendez_vous'
  | 'contact'
  | 'formulaire_client';

export type InquiryMeetingMode = 'sur_place' | 'appel' | 'agence';

export interface PropertyInquiryPayload {
  property_id?: number | null;
  type: InquiryActionType;
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  scheduled_date?: string | null;
  meeting_mode?: InquiryMeetingMode | null;
  sujet?: string | null;
  commune?: string | null;
  quartier?: string | null;
  budget?: number | null;
  message?: string | null;
}

export interface PropertyInquiryItem {
  id: number;
  property_id?: number | null;
  user_id?: number | null;
  recipient_id?: number | null;
  type: InquiryActionType;
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  scheduled_date?: string | null;
  meeting_mode?: InquiryMeetingMode | null;
  sujet?: string | null;
  commune?: string | null;
  quartier?: string | null;
  budget?: number | string | null;
  message?: string | null;
  status: 'nouveau' | 'en_cours' | 'confirme' | 'traite' | 'annule' | string;
  propriete?: {
    id: number;
    type: string;
    transaction_type: string;
    commune: string;
    quartier?: string | null;
    prix: number | string;
    status: string;
  } | null;
  created_at: string;
}

export interface AgentClientLead {
  key: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  total_demandes: number;
  derniere_interaction?: string | null;
  dernier_type: InquiryActionType;
  dernier_statut: string;
}

export interface AgentDashboardData {
  kpis: {
    total_biens: number;
    biens_publies: number;
    biens_en_attente: number;
    biens_conclus: number;
    total_visites: number;
    visites_en_attente: number;
    total_demandes: number;
    demandes_nouvelles: number;
    total_clients: number;
  };
  proprietes: BackendProperty[];
  inquiries: PropertyInquiryItem[];
  visites: VisiteBackendItem[];
  clients: AgentClientLead[];
}
