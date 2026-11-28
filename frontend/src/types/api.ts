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
  surface?: number | string | null;
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
  matched_propriete?: {
    id: number;
    type: PropertyTypeBackend;
    transaction_type: TransactionTypeBackend;
    commune: string;
    arrondissement?: string | null;
    quartier?: string | null;
    prix: number | string;
    status: string;
  } | null;
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
  gateway?: string;
  public_key: string | null;
  amount: number;
  currency?: string;
  reason: string;
  sandbox: boolean;
  theme?: string;
  script_url?: string;
  callback?: string;
  metadata?: Record<string, any>;
}

export interface PaymentInitData {
  payment_id?: number;
  reference: string;
  montant_officiel: number;
  devise: string;
  status?: string;
  normalized_status?: 'pending' | 'success' | 'failed' | 'cancelled' | 'expired';
  expires_at?: string;
  type_operation: PaymentOperationType;
  gateway: string;
  widget_config: KkiapayWidgetConfig;
}

export interface PaymentStatusItem {
  id: number;
  reference: string;
  gateway_transaction_id?: string | null;
  payment_type: string;
  amount: number;
  currency: string;
  gateway_fees?: number;
  payment_method?: string | null;
  status: 'pending' | 'successful' | 'failed' | 'cancelled' | 'expired' | string;
  normalized_status: 'pending' | 'success' | 'failed' | 'cancelled' | 'expired' | string;
  gateway_status?: string | null;
  property_id?: number | null;
  related_entity_id?: number | null;
  is_consumed?: boolean;
  failure_reason?: string | null;
  verified_at?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
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

export interface VisitesStats {
  total_visites: number;
  en_attente: number;
  programmees: number;
  effectuees: number;
  annulees: number;
}

export interface DemandesStats {
  total_demandes: number;
  en_attente: number;
  en_cours: number;
  satisfaites: number;
  abandonnees: number;
  expirees: number;
}

export interface OperationalAgentItem {
  id: number;
  nom_complet: string;
  email: string;
  role: string;
  zone_id?: number | null;
  zone_nom?: string | null;
}

export interface DossierAuditLogEntry {
  id: number;
  action: string;
  details?: Record<string, any> | null;
  actor?: {
    id: number;
    nom_complet: string;
    email: string;
  } | null;
  created_at?: string | null;
}

export interface AssociatedPropertySummary {
  id?: number;
  propriete_id?: number;
  type: string;
  transaction_type: string;
  commune: string;
  arrondissement?: string | null;
  quartier?: string | null;
  prix: number;
  surface?: number | null;
  nombres_chambres?: number | null;
  status: string;
  photo_url?: string | null;
  score_matching?: number | null;
  score_matching_pourcentage?: number | null;
  note_agent?: string | null;
  client_notifie?: boolean;
  notifie_at?: string | null;
  associe_at?: string | null;
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
    arrondissement?: string | null;
    quartier?: string | null;
    prix: number | string;
    surface?: number | null;
    nombres_chambres?: number | null;
    status: string;
    photo_url?: string | null;
  } | null;
  target_agent_id?: number | null;
  agent_assigne?: {
    id: number;
    nom_complet: string;
    email: string;
  } | null;
  scheduled_date?: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | string;
  is_fee_paid: boolean;
  statut_paiement: string;
  instructions_itineraire?: string | null;
  compte_rendu?: string | null;
  issue_cloture?: string | null;
  is_escalade_haute?: boolean;
  offre_montant?: number | null;
  allowed_transitions?: string[];
  permissions?: {
    can_plan: boolean;
    can_confirm: boolean;
    can_complete: boolean;
    can_cancel: boolean;
    can_report: boolean;
    can_close: boolean;
    can_escalate: boolean;
    can_assign_zone: boolean;
    can_change_status: boolean;
  };
  donnees_masquees: boolean;
  created_at?: string;
  updated_at?: string;
}

export type DemandeWorkflowStatus = 'en_attente' | 'en_cours' | 'satisfaite' | 'abandonnee' | 'expiree';

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
  workflow_status?: DemandeWorkflowStatus;
  gestionnaire_id?: number | null;
  gestionnaire?: {
    id: number;
    nom_complet: string;
    email: string;
  } | null;
  prise_en_charge_at?: string | null;
  expires_at?: string | null;
  is_expired?: boolean;
  matched_propriete_id?: number | null;
  matched_propriete?: {
    id: number;
    type: string;
    transaction_type: string;
    commune: string;
    arrondissement?: string | null;
    quartier?: string | null;
    prix: number;
    status: string;
    photo_url?: string | null;
  } | null;
  biens_associes?: AssociatedPropertySummary[];
  biens_associes_count?: number;
  biens_correspondants_count?: number;
  motif_cloture?: string | null;
  motif_cloture_details?: string | null;
  cloture_at?: string | null;
  cloture_par_id?: number | null;
  cloture_par?: {
    id: number;
    nom_complet: string;
    email: string;
  } | null;
  permissions?: {
    can_take_charge: boolean;
    can_reassign: boolean;
    can_match: boolean;
    can_view_matches: boolean;
    can_close_satisfied: boolean;
    can_close_abandoned: boolean;
    can_mark_expired: boolean;
    can_view_history: boolean;
  };
  donnees_masquees: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MatchingPropertySuggestion {
  propriete_id: number;
  titre?: string;
  type: string;
  transaction_type: string;
  commune: string;
  arrondissement?: string | null;
  quartier?: string | null;
  prix: number;
  surface?: number | null;
  nombres_chambres?: number | null;
  avance_mois?: number | null;
  accessibilite?: string | null;
  eau_courant?: string | null;
  is_negotiable?: boolean;
  description?: string | null;
  status?: string;
  disponibilite?: string;
  photo_url?: string | null;
  zone?: string | null;
  score_matching_pourcentage: number;
  criteres_correspondants?: string[];
  criteres_manquants?: string[];
  deja_associe?: boolean;
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
  type_mouvement: 'credit' | 'debit' | string;
  categorie: string;
  montant_brut: number | string;
  frais_agregateur?: number | string;
  frais_passerelle?: number | string;
  montant_net: number | string;
  solde_apres: number | string;
  devise?: string;
  gateway?: string;
  gateway_transaction_id?: string | null;
  description: string;
  client?: { id: number; name: string; prenom?: string; email: string } | null;
  created_at: string;
}

export interface RetraitItem {
  id: number;
  reference_retrait: string;
  montant: number | string;
  devise?: string;
  type_compte: 'mobile_money' | 'virement_bancaire' | string;
  compte_beneficiaire?: string;
  statut: 'en_attente_otp' | 'en_cours_agregateur' | 'execute' | 'annule' | 'rejete' | string;
  motif_annulation_rejet?: string | null;
  executed_at?: string | null;
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

export interface PlatformTarifs {
  deblocage_coordonnees: number;
  visite: number;
  post_client: number;
  post_agent: number;
}

export interface PublicPlatformConfig {
  platform_name: string;
  platform_legal_name: string;
  currency: string;
  tarifs: PlatformTarifs;
  contact: {
    phone: string;
    email: string;
    office_address: string;
  };
}

export interface PlatformSettingItem {
  id: number;
  cle: string;
  valeur: string | number | boolean | null;
  valeur_brute: string | null;
  type: 'integer' | 'string' | 'boolean' | 'json' | string;
  groupe: 'tarifs' | 'finance' | 'securite' | 'contact' | 'general' | string;
  label: string;
  description?: string | null;
  is_public: boolean;
  editable: boolean;
  updated_at?: string | null;
  updated_by?: {
    id: number;
    nom: string;
    email: string;
  } | null;
}

export interface AdminSettingsResponse {
  can_edit_financial: boolean;
  items: PlatformSettingItem[];
  grouped: Record<string, PlatformSettingItem[]>;
}

export type SuperAdminDashboardPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';

export interface SuperAdminActivityPoint {
  label: string;
  inscriptions: number;
  publications: number;
  demandes: number;
}

export interface SuperAdminDistributionSlice {
  key: string;
  label: string;
  count: number;
  color: string;
}

export interface SuperAdminZonePerfRow {
  id: number;
  code: string;
  nom: string;
  commune: string;
  departement?: string | null;
  visites_total: number;
  visites_effectuees: number;
  biens_actifs: number;
  biens_conclus: number;
  biens_en_attente: number;
  demandes_total: number;
  demandes_traitees: number;
  dossiers_traites: number;
  taux_realisation_pct: number;
}

export interface SuperAdminPendingAction {
  key: string;
  label: string;
  description: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
  target_page: string;
  sub_tab?: string;
}

export interface SuperAdminRecentActivity {
  id: string;
  category: 'audit' | 'client' | 'agent' | 'publication' | 'demande' | 'visite' | 'finance' | string;
  title: string;
  description: string;
  actor: string;
  status: string;
  target_page: string;
  sub_tab?: string;
  created_at?: string | null;
}

export interface SuperAdminSidebarBadges {
  moderation: number;
  visites: number;
  demasquages: number;
  equipe: number;
  finance: number;
}

export interface SuperAdminSystemHealthSummary {
  status: 'operational' | 'degraded' | 'error';
  label: string;
  db_latency_ms: number | null;
  failed_jobs: number;
}

export interface SuperAdminDashboardOverview {
  generated_at: string;
  financial_access: boolean;
  periode: {
    key: SuperAdminDashboardPeriod;
    label: string;
    debut: string;
    fin: string;
    precedent_debut: string;
    precedent_fin: string;
  };
  system_health: SuperAdminSystemHealthSummary;
  kpis: {
    utilisateurs: {
      total: number;
      clients: number;
      agents: number;
      agents_kyc_en_attente: number;
      periode_count: number;
      clients_periode: number;
      agents_periode: number;
      periode_precedente: number;
      evolution_pct: number | null;
    };
    publications: {
      total: number;
      publiees: number;
      en_attente: number;
      rejetees: number;
      conclues: number;
      periode_count: number;
      periode_precedente: number;
      evolution_pct: number | null;
    };
    demandes_recherche: {
      total: number;
      actives: number;
      satisfaites: number;
      cloturees: number;
      non_assignees: number;
      periode_count: number;
      periode_precedente: number;
      evolution_pct: number | null;
    };
    visites_terrain: {
      total: number;
      en_attente: number;
      programmees: number;
      effectuees: number;
      annulees: number;
      taux_completion_pct: number;
      periode_count: number;
      periode_precedente: number;
      evolution_pct: number | null;
    };
    demasquages_ttl: {
      total: number;
      en_attente: number;
      approuves: number;
      actifs_maintenant: number;
      refuses_ou_revoques: number;
      periode_count: number;
      periode_precedente: number;
      evolution_pct: number | null;
    };
    tresorerie: {
      solde_disponible: number;
      solde_en_cours_retrait: number;
      total_retraits_executes: number;
      retraits_en_attente_count: number;
      encaissements_periode: number;
      encaissements_periode_precedente: number;
      evolution_pct: number | null;
      retraits_geles: boolean;
      devise: string;
    } | null;
  };
  charts: {
    evolution_activites: SuperAdminActivityPoint[];
    repartition_demandes: SuperAdminDistributionSlice[];
    repartition_publications: SuperAdminDistributionSlice[];
    repartition_visites: SuperAdminDistributionSlice[];
    performance_zones: SuperAdminZonePerfRow[];
  };
  actions_en_attente: SuperAdminPendingAction[];
  sidebar_badges: SuperAdminSidebarBadges;
  activites_recentes: {
    data: SuperAdminRecentActivity[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  meta: {
    audit_logs_total: number;
    zones_actives_total: number;
  };
}
