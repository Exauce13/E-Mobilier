import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AgentsKycSection,
  DemasquagesSection,
  GovernanceSection,
  TechHealthSection,
} from '@/components/admin/admin-gov-sections';
import {
  DemandesMatchingSection,
  MetricsSection,
  ModerationSection,
  VisitesOpsSection,
} from '@/components/admin/admin-ops-sections';
import { InstitutionHeader } from '@/components/ui/institution-header';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { adminApi, cguApi } from '@/services/api';

type AdminTabKey =
  | 'moderation'
  | 'visites'
  | 'demasquages'
  | 'audit'
  | 'metrics'
  | 'demandes'
  | 'kyc'
  | 'governance'
  | 'tech';

export default function AdminDashboardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isAdminStaff, isSuperAdmin, hasAnyRole } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTabKey>('moderation');
  const [charteModalVisible, setCharteModalVisible] = useState(false);
  const [charteMsg, setCharteMsg] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  // TTL Countdown state (03h 42m 18s)
  const initialTtlSeconds = 3 * 3600 + 42 * 60 + 18;
  const totalTtlCapacity = 6 * 3600;
  const [ttlSeconds, setTtlSeconds] = useState(initialTtlSeconds);

  // Rejection modal & reason state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState<
    'cadastre' | 'qualite' | 'fraude'
  >('cadastre');

  // Interactive Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastIsError, setToastIsError] = useState(false);

  // Priority dossier status
  const [priorityDossierStatus, setPriorityDossierStatus] = useState<
    'pending' | 'approved' | 'rejected'
  >('pending');

  useEffect(() => {
    const timer = setInterval(() => {
      setTtlSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTtlTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h < 10 ? '0' : ''}${h}h ${m < 10 ? '0' : ''}${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const ttlPercent = Math.max(0, Math.min(100, (ttlSeconds / totalTtlCapacity) * 100));

  const showToast = (message: string, isError = false) => {
    setToastMessage(message);
    setToastIsError(isError);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
    }, 4000);
  };

  const handleApprovePriorityDossier = () => {
    setPriorityDossierStatus('approved');
    showToast('Titre scellé ! Annonce publiée au catalogue officiel national.');
  };

  const handleConfirmReject = () => {
    setRejectModalVisible(false);
    setPriorityDossierStatus('rejected');
    showToast('Dossier rejeté avec notification cadastre envoyée.', true);
  };

  const handleSignalCircumvention = () => {
    Alert.alert(
      'Signalement Non-Contournement',
      "L'incident a été indexé sur le Journal d'Audit Immuable E-Mobilier (ID : BJ-LIT-9824). L'équipe sécurité foncière procède au gel conservatoire.",
      [{ text: 'Compris' }]
    );
  };

  const tabs = useMemo(() => {
    const canKyc = hasAnyRole([
      'Super Admin Principal',
      'Super Admin Technique',
      'Secrétaire',
      'Admin',
    ]);
    const list: Array<{
      key: AdminTabKey;
      label: string;
      badge?: string | number;
      icon?: string;
    }> = [
      { key: 'moderation', label: 'File de Modération', badge: 12 },
      { key: 'visites', label: 'Visites Terrain', badge: 5 },
      { key: 'demasquages', label: 'Démasquages TTL', badge: 2, icon: 'lock_clock' },
      { key: 'audit', label: 'Audit Foncier', icon: 'history_edu' },
      { key: 'metrics', label: 'Indicateurs' },
      { key: 'demandes', label: 'Demandes' },
    ];
    if (canKyc) list.push({ key: 'kyc', label: 'Agents KYC' });
    if (isSuperAdmin) {
      list.push({ key: 'governance', label: 'Gouvernance' });
      list.push({ key: 'tech', label: 'Tech & Sécurité' });
    }
    return list;
  }, [hasAnyRole, isSuperAdmin]);

  const handleCharteRequired = (msg?: string) => {
    setCharteMsg(
      msg ||
        'La signature de la Charte de Confidentialité et de Non-Contournement est requise pour accéder aux opérations.'
    );
    setCharteModalVisible(true);
  };

  const handleSignCharte = async () => {
    setSigning(true);
    const res = await cguApi.signerCharte(true);
    setSigning(false);
    if (res.success) {
      setCharteModalVisible(false);
      showToast('Charte signée. Accès administration débloqué.');
    } else {
      Alert.alert('Erreur', res.message || 'Impossible de signer la charte.');
    }
  };

  if (!isAdminStaff) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surface }]}>
        <InstitutionHeader title="Administration" showBack />
        <View style={styles.deniedBox}>
          <Text style={[styles.deniedTitle, { color: theme.text }]}>Accès restreint</Text>
          <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
            Cet espace est réservé aux profils d'administration et notariat E-Mobilier.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <InstitutionHeader title="Console de Modération & Titres" showBack />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}>
        {/* 1. ZONE PROFIL & CONTEXTE OPÉRATIONNEL CADASTRAL (STITCH EXACT) */}
        <View
          style={[
            styles.contextCard,
            { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
          ]}>
          <View style={styles.contextHeaderRow}>
            <View style={styles.contextTitlesWrap}>
              <View style={styles.pillsRow}>
                <View style={[styles.rolePill, { backgroundColor: theme.primaryFixed }]}>
                  <SymbolView
                    name={{ ios: 'person.badge.shield.checkmark.fill', android: 'shield_person', web: 'shield_person' }}
                    size={14}
                    tintColor={theme.primaryDark}
                  />
                  <Text style={[styles.rolePillText, { color: theme.primaryDark }]}>
                    Rôle : Responsable Zone
                  </Text>
                </View>
                <View style={[styles.zonePill, { backgroundColor: theme.surfaceContainerHigh }]}>
                  <Text style={[styles.zonePillText, { color: theme.textSecondary }]}>
                    Littoral / Atlantique
                  </Text>
                </View>
              </View>
              <Text style={[styles.consoleTitle, { color: theme.text }]}>
                Console de Modération & Titres
              </Text>
            </View>

            <View style={[styles.policyIconBox, { backgroundColor: `${theme.primaryContainer}15` }]}>
              <SymbolView
                name={{ ios: 'shield.lefthalf.filled', android: 'policy', web: 'policy' }}
                size={22}
                tintColor={theme.primaryContainer}
              />
            </View>
          </View>

          {/* Ruban Déontologique Immuable */}
          <View style={[styles.charteRibbon, { backgroundColor: theme.surfaceContainerLow }]}>
            <View style={styles.charteRibbonLeft}>
              <SymbolView
                name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }}
                size={18}
                tintColor={theme.tertiary}
              />
              <Text numberOfLines={1} style={[styles.charteRibbonText, { color: theme.textSecondary }]}>
                Charte Non-Contournement signée le <Text style={{ fontWeight: '700', color: theme.text }}>15/01/2025</Text>
              </Text>
            </View>
            <SymbolView
              name={{ ios: 'hammer.fill', android: 'gavel', web: 'gavel' }}
              size={16}
              tintColor={theme.secondary}
            />
          </View>
        </View>

        {/* 2. NAVIGATION PAR ONGLETS MÉTIERS (STITCH EXACT) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}>
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tabBtn,
                  {
                    backgroundColor: active
                      ? theme.primaryContainer
                      : theme.surfaceContainerLowest,
                    borderColor: theme.cardBorder,
                  },
                ]}>
                {tab.icon && (
                  <SymbolView
                    name={{ ios: 'clock.badge.checkmark', android: tab.icon as any, web: tab.icon as any }}
                    size={15}
                    tintColor={active ? '#FFFFFF' : theme.tertiary}
                  />
                )}
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: active ? '#FFFFFF' : theme.text },
                  ]}>
                  {tab.label}
                </Text>
                {tab.badge !== undefined && (
                  <View
                    style={[
                      styles.tabBadge,
                      {
                        backgroundColor: active
                          ? '#FFFFFF'
                          : theme.surfaceContainerHigh,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.tabBadgeText,
                        {
                          color: active
                            ? theme.primaryContainer
                            : theme.text,
                        },
                      ]}>
                      {tab.badge}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* 3. CONTENU DYNAMIQUE SELON L'ONGLET */}
        {(activeTab === 'moderation' || activeTab === 'demasquages') && (
          <View style={styles.sectionWrap}>
            {/* MODULE VEDETTE : DÉMASQUAGE TEMPORAIRE TTL (SÉCURITÉ & ANTI-CONTOURNEMENT) */}
            <View
              style={[
                styles.ttlFeaturedCard,
                { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
              ]}>
              {/* Header indicateur statut */}
              <View style={styles.ttlCardHeader}>
                <View style={styles.ttlPulseRow}>
                  <View style={[styles.pulseDot, { backgroundColor: theme.tertiary }]} />
                  <Text style={[styles.ttlHeaderTag, { color: theme.tertiary }]}>
                    ACCÈS TTL OPÉRATIONNEL
                  </Text>
                </View>

                <View style={[styles.accordedPill, { backgroundColor: `${theme.tertiary}20` }]}>
                  <Text style={[styles.accordedPillText, { color: theme.tertiary }]}>
                    Accordé : Super Admin
                  </Text>
                </View>
              </View>

              {/* Titre & Visiteuse */}
              <View style={styles.ttlSubjectBlock}>
                <Text style={[styles.ttlSubjectTitle, { color: theme.text }]}>
                  Demande Visite — Villa Moderne Haie-Vive
                </Text>
                <Text style={[styles.ttlSubjectSub, { color: theme.textSecondary }]}>
                  Visiteuse qualifiée :{' '}
                  <Text style={{ fontWeight: '700', color: theme.text }}>
                    Mme Aïcha Bio
                  </Text>{' '}
                  (Mandat d'acquisition direct)
                </Text>
              </View>

              {/* Compteur TTL Actif */}
              <View style={[styles.ttlCounterBox, { backgroundColor: theme.surfaceContainerLow }]}>
                <View style={styles.ttlCounterRow}>
                  <View style={styles.ttlTimerLabelRow}>
                    <SymbolView
                      name={{ ios: 'timer', android: 'timer', web: 'timer' }}
                      size={18}
                      tintColor={theme.tertiary}
                    />
                    <Text style={[styles.ttlTimerLabel, { color: theme.text }]}>
                      Compte à rebours TTL :
                    </Text>
                  </View>
                  <Text style={[styles.ttlTimerDigits, { color: theme.tertiary }]}>
                    {formatTtlTime(ttlSeconds)}
                  </Text>
                </View>

                {/* Barre de jauge temporelle */}
                <View style={[styles.ttlBarTrack, { backgroundColor: theme.surfaceContainerHigh }]}>
                  <View
                    style={[
                      styles.ttlBarFill,
                      {
                        backgroundColor: theme.tertiary,
                        width: `${ttlPercent}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Bloc Coordonnées Démasquées */}
              <View style={[styles.unmaskedPhoneRow, { backgroundColor: `${theme.primaryFixed}35` }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.unmaskedPhoneLabel, { color: theme.textSecondary }]}>
                    Ligne directe autorisée :
                  </Text>
                  <Text style={[styles.unmaskedPhoneNumber, { color: theme.primary }]}>
                    +229 01 54 88 12
                  </Text>
                </View>

                <Pressable
                  onPress={() => Linking.openURL('tel:+22901548812')}
                  style={[styles.callBtn, { backgroundColor: theme.primaryContainer }]}>
                  <SymbolView
                    name={{ ios: 'phone.fill', android: 'call', web: 'call' }}
                    size={16}
                    tintColor="#FFFFFF"
                  />
                  <Text style={styles.callBtnText}>Appeler</Text>
                </Pressable>
              </View>

              {/* Mention d'avertissement traçabilité */}
              <View style={[styles.legalWarningRow, { backgroundColor: theme.surfaceContainerLow }]}>
                <SymbolView
                  name={{ ios: 'lock.shield.fill', android: 'encrypted', web: 'encrypted' }}
                  size={16}
                  tintColor={theme.secondary}
                />
                <Text style={[styles.legalWarningText, { color: theme.textSecondary }]}>
                  Tous les appels, SMS et consultations sont indexés sur le{' '}
                  <Text style={{ fontWeight: '700', color: theme.text }}>
                    Journal d'Audit Immuable E-Mobilier
                  </Text>{' '}
                  (ID Audit : BJ-LIT-9824). Tout contournement notifié entraîne le blocage immédiat du compte.
                </Text>
              </View>

              {/* Bouton d'alerte contournement */}
              <Pressable
                onPress={handleSignalCircumvention}
                style={[styles.reportBtn, { backgroundColor: '#FFDAD6' }]}>
                <SymbolView
                  name={{ ios: 'flag.fill', android: 'flag', web: 'flag' }}
                  size={16}
                  tintColor="#93000A"
                />
                <Text style={styles.reportBtnText}>Signaler une tentative de contournement</Text>
              </Pressable>
            </View>

            {/* DOSSIER FONCIER PRIORITAIRE (FILE DE MODÉRATION) */}
            <View style={styles.dossierSectionHeader}>
              <View style={styles.dossierSectionHeaderLeft}>
                <SymbolView
                  name={{ ios: 'checklist.checked', android: 'fact_check', web: 'fact_check' }}
                  size={18}
                  tintColor={theme.primary}
                />
                <Text style={[styles.dossierSectionTitle, { color: theme.text }]}>
                  Dossier Foncier Prioritaire
                </Text>
              </View>
              <View style={[styles.queueBadge, { backgroundColor: '#FFE088' }]}>
                <Text style={styles.queueBadgeText}>1/12 EN ATTENTE</Text>
              </View>
            </View>

            <View
              style={[
                styles.dossierCard,
                { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
              ]}>
              {/* Photo du bien foncier */}
              <View style={styles.dossierPhotoWrap}>
                <Image
                  source={{
                    uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD88x9q3hPQsgIQl_9KnxsGXvimLjEV47uMUFCspHB_2GdbNU6UdygAdND4rThAhau3dAMd1mir6KVzbL1S0exn8vkdq9-UV3GJVb_BljF1N6hl4w6fNd1rTfuYmXpeHGUXrkDvwhfVC4-Mn_8DsgNphWL5OU9WUtiUZnMXaUOIX7-YIB4reWAuyQEJ7PQI0QjIVrb4eNniRdP6CXjhkMbiTXhPdMrnk6qO236C-9E',
                  }}
                  style={styles.dossierPhoto}
                  contentFit="cover"
                />
                <View style={styles.dossierPhotoBadges}>
                  <View style={[styles.salePill, { backgroundColor: theme.primaryContainer }]}>
                    <Text style={styles.salePillText}>À VENDRE</Text>
                  </View>
                  <View style={styles.surfPill}>
                    <Text style={[styles.surfPillText, { color: theme.text }]}>600 m²</Text>
                  </View>
                </View>
                <View style={styles.priceFloatingPill}>
                  <Text style={styles.priceFloatingVal}>
                    45.000.000 <Text style={styles.priceFloatingCurrency}>FCFA</Text>
                  </Text>
                </View>
              </View>

              {/* Détails du titre foncier */}
              <View style={styles.dossierBody}>
                <Text style={[styles.dossierTitle, { color: theme.text }]}>
                  Terrain 600m² Titre Foncier — Cotonou Fidjrossè Calvaire
                </Text>

                <View style={styles.dossierMetaRow}>
                  <SymbolView
                    name={{ ios: 'person.fill', android: 'person', web: 'person' }}
                    size={15}
                    tintColor={theme.primary}
                  />
                  <Text style={[styles.dossierMetaText, { color: theme.textSecondary }]}>
                    Déposant :{' '}
                    <Text style={{ fontWeight: '700', color: theme.text }}>
                      M. Jean K. (Propriétaire certifié)
                    </Text>
                  </Text>
                </View>

                <View style={styles.dossierMetaRow}>
                  <SymbolView
                    name={{ ios: 'mappin.and.ellipse', android: 'pin_drop', web: 'pin_drop' }}
                    size={15}
                    tintColor={theme.secondary}
                  />
                  <Text style={[styles.dossierMetaText, { color: theme.textSecondary }]}>
                    Lot 142 — Îlot 21 bis, Zone résidentielle Fidjrossè
                  </Text>
                </View>

                {/* Pièce Jointe Juridique */}
                <View style={[styles.pdfAttachmentRow, { backgroundColor: theme.surfaceContainerLow }]}>
                  <View style={styles.pdfAttachmentLeft}>
                    <View style={[styles.pdfIconBox, { backgroundColor: theme.surfaceContainerHigh }]}>
                      <SymbolView
                        name={{ ios: 'doc.text.fill', android: 'description', web: 'description' }}
                        size={22}
                        tintColor={theme.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={[styles.pdfName, { color: theme.text }]}>
                        Titre_Foncier_Livre_Cotonou.pdf
                      </Text>
                      <View style={styles.pdfStatusRow}>
                        <SymbolView
                          name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                          size={13}
                          tintColor={theme.primary}
                        />
                        <Text style={[styles.pdfStatusText, { color: theme.primary }]}>
                          Statut Cadastre : Conforme ANF
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Pressable
                    onPress={() =>
                      Alert.alert(
                        'Acte Foncier ANF',
                        'Aperçu du certificat d’inscription cadastrale scellé (Référence TF-7821-COT).'
                      )
                    }
                    style={[styles.seePdfBtn, { backgroundColor: theme.surfaceContainerHigh }]}>
                    <SymbolView
                      name={{ ios: 'eye.fill', android: 'visibility', web: 'visibility' }}
                      size={15}
                      tintColor={theme.text}
                    />
                    <Text style={[styles.seePdfBtnText, { color: theme.text }]}>Voir</Text>
                  </Pressable>
                </View>

                {/* Grille de Contrôle Notarial Rapide */}
                <View style={[styles.controlGrid, { backgroundColor: theme.surfaceContainerLow }]}>
                  <View style={styles.controlItem}>
                    <SymbolView
                      name={{ ios: 'checkmark.circle.fill', android: 'task_alt', web: 'task_alt' }}
                      size={16}
                      tintColor={theme.primary}
                    />
                    <Text style={[styles.controlItemText, { color: theme.text }]}>
                      Bornage Ouest vérifié
                    </Text>
                  </View>
                  <View style={styles.controlItem}>
                    <SymbolView
                      name={{ ios: 'checkmark.circle.fill', android: 'task_alt', web: 'task_alt' }}
                      size={16}
                      tintColor={theme.primary}
                    />
                    <Text style={[styles.controlItemText, { color: theme.text }]}>
                      Non-hypothèque validée
                    </Text>
                  </View>
                </View>

                {/* Actions d'Arbitrage Immédiates */}
                {priorityDossierStatus === 'pending' ? (
                  <View style={styles.arbitrageActions}>
                    <Pressable
                      onPress={handleApprovePriorityDossier}
                      style={[styles.approveBtn, { backgroundColor: theme.primaryContainer }]}>
                      <SymbolView
                        name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                        size={20}
                        tintColor="#FFFFFF"
                      />
                      <Text style={styles.approveBtnText}>
                        Approuver & Publier au catalogue
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setRejectModalVisible(true)}
                      style={[styles.rejectBtn, { backgroundColor: theme.surfaceContainerHigh }]}>
                      <SymbolView
                        name={{ ios: 'xmark.circle.fill', android: 'block', web: 'block' }}
                        size={18}
                        tintColor="#BA1A1A"
                      />
                      <Text style={styles.rejectBtnText}>
                        Rejeter l'annonce (Motif requis)
                      </Text>
                    </Pressable>
                  </View>
                ) : priorityDossierStatus === 'approved' ? (
                  <View style={[styles.statusConfirmedBox, { backgroundColor: theme.badgeGreenBg }]}>
                    <SymbolView
                      name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }}
                      size={18}
                      tintColor={theme.badgeGreenText}
                    />
                    <Text style={[styles.statusConfirmedText, { color: theme.badgeGreenText }]}>
                      Dossier approuvé et indexé au catalogue officiel !
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.statusConfirmedBox, { backgroundColor: '#FFDAD6' }]}>
                    <SymbolView
                      name={{ ios: 'exclamationmark.triangle.fill', android: 'error', web: 'error' }}
                      size={18}
                      tintColor="#93000A"
                    />
                    <Text style={[styles.statusConfirmedText, { color: '#93000A' }]}>
                      Dossier rejeté — Notification de non-conformité émise.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Section Visites Terrain */}
        {activeTab === 'visites' && (
          <VisitesOpsSection onCharteRequired={handleCharteRequired} />
        )}

        {/* Section Audit Foncier & Indicateurs */}
        {(activeTab === 'audit' || activeTab === 'metrics') && (
          <MetricsSection onCharteRequired={handleCharteRequired} />
        )}

        {/* Section Demandes */}
        {activeTab === 'demandes' && (
          <DemandesMatchingSection onCharteRequired={handleCharteRequired} />
        )}

        {/* Section KYC */}
        {activeTab === 'kyc' && <AgentsKycSection />}

        {/* Section Gouvernance */}
        {activeTab === 'governance' && <GovernanceSection />}

        {/* Section Tech */}
        {activeTab === 'tech' && <TechHealthSection />}
      </ScrollView>

      {/* MODAL DE REJET FONCIER (INTERACTIVE STITCH) */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.rejectModalCard,
              { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
            ]}>
            <View style={styles.rejectModalTop}>
              <View style={styles.rejectModalTitleRow}>
                <SymbolView
                  name={{ ios: 'hammer.fill', android: 'gavel', web: 'gavel' }}
                  size={20}
                  tintColor="#BA1A1A"
                />
                <Text style={[styles.rejectModalTitle, { color: theme.text }]}>
                  Motif du Rejet Notarié
                </Text>
              </View>
              <Pressable
                onPress={() => setRejectModalVisible(false)}
                hitSlop={12}
                style={[styles.closeIconBtn, { backgroundColor: theme.surfaceContainerLow }]}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={14}
                  tintColor={theme.textSecondary}
                />
              </Pressable>
            </View>

            <Text style={[styles.rejectModalDesc, { color: theme.textSecondary }]}>
              Précisez la non-conformité constatée sur le titre ou les coordonnées pour notification au propriétaire.
            </Text>

            <View style={styles.radioGroup}>
              <Pressable
                onPress={() => setRejectReason('cadastre')}
                style={[
                  styles.radioRow,
                  { backgroundColor: theme.surfaceContainerLow },
                ]}>
                <View
                  style={[
                    styles.radioCircle,
                    { borderColor: rejectReason === 'cadastre' ? theme.primaryContainer : theme.outline },
                  ]}>
                  {rejectReason === 'cadastre' && (
                    <View style={[styles.radioDot, { backgroundColor: theme.primaryContainer }]} />
                  )}
                </View>
                <Text style={[styles.radioLabel, { color: theme.text }]}>
                  Incohérence numéro de parcelle cadastre
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setRejectReason('qualite')}
                style={[
                  styles.radioRow,
                  { backgroundColor: theme.surfaceContainerLow },
                ]}>
                <View
                  style={[
                    styles.radioCircle,
                    { borderColor: rejectReason === 'qualite' ? theme.primaryContainer : theme.outline },
                  ]}>
                  {rejectReason === 'qualite' && (
                    <View style={[styles.radioDot, { backgroundColor: theme.primaryContainer }]} />
                  )}
                </View>
                <Text style={[styles.radioLabel, { color: theme.text }]}>
                  Document scanné illisible ou incomplet
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setRejectReason('fraude')}
                style={[
                  styles.radioRow,
                  { backgroundColor: theme.surfaceContainerLow },
                ]}>
                <View
                  style={[
                    styles.radioCircle,
                    { borderColor: rejectReason === 'fraude' ? theme.primaryContainer : theme.outline },
                  ]}>
                  {rejectReason === 'fraude' && (
                    <View style={[styles.radioDot, { backgroundColor: theme.primaryContainer }]} />
                  )}
                </View>
                <Text style={[styles.radioLabel, { color: theme.text }]}>
                  Suspicion de doublon ou tentative de contournement
                </Text>
              </Pressable>
            </View>

            <View style={styles.rejectModalBtnRow}>
              <Pressable
                onPress={handleConfirmReject}
                style={[styles.confirmRejectBtn, { backgroundColor: '#BA1A1A' }]}>
                <Text style={styles.confirmRejectBtnText}>Confirmer Rejet</Text>
              </Pressable>
              <Pressable
                onPress={() => setRejectModalVisible(false)}
                style={[styles.cancelRejectBtn, { backgroundColor: theme.surfaceContainerHigh }]}>
                <Text style={[styles.cancelRejectBtnText, { color: theme.text }]}>Annuler</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* TOAST FLOTTANT D'ACTION */}
      {toastVisible && (
        <View
          style={[
            styles.floatingToast,
            { backgroundColor: toastIsError ? '#BA1A1A' : theme.primary },
          ]}>
          <SymbolView
            name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }}
            size={18}
            tintColor="#FFFFFF"
          />
          <Text style={styles.floatingToastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Charte Modal */}
      <Modal
        visible={charteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCharteModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.rejectModalCard,
              { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
            ]}>
            <Text style={[styles.rejectModalTitle, { color: theme.text }]}>
              Charte Anti-Contournement
            </Text>
            <Text style={[styles.rejectModalDesc, { color: theme.textSecondary }]}>
              {charteMsg ||
                'Signature requise pour accéder aux coordonnées et pièces foncières.'}
            </Text>
            <View style={styles.rejectModalBtnRow}>
              <Pressable
                onPress={() => setCharteModalVisible(false)}
                style={[styles.cancelRejectBtn, { borderColor: theme.cardBorder }]}>
                <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Fermer</Text>
              </Pressable>
              <Pressable
                disabled={signing}
                onPress={handleSignCharte}
                style={[styles.confirmRejectBtn, { backgroundColor: theme.primaryContainer }]}>
                <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>
                  {signing ? 'Signature...' : 'Signer la Charte'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  deniedBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.five,
  },
  deniedTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  // Context Card
  contextCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
    shadowColor: '#0B1C30',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  contextHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  contextTitlesWrap: {
    flex: 1,
    gap: 6,
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  zonePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  zonePillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  consoleTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  policyIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  charteRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  charteRibbonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  charteRibbonText: {
    fontSize: 12,
  },
  // Tabs
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  sectionWrap: {
    gap: Spacing.four,
  },
  // Featured TTL Module
  ttlFeaturedCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
    shadowColor: '#0B1C30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  ttlCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ttlPulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ttlHeaderTag: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  accordedPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  accordedPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  ttlSubjectBlock: {
    gap: 2,
  },
  ttlSubjectTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  ttlSubjectSub: {
    fontSize: 12,
  },
  ttlCounterBox: {
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  ttlCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ttlTimerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ttlTimerLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  ttlTimerDigits: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ttlBarTrack: {
    height: 6,
    borderRadius: 9999,
    overflow: 'hidden',
  },
  ttlBarFill: {
    height: '100%',
    borderRadius: 9999,
  },
  unmaskedPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    gap: 8,
  },
  unmaskedPhoneLabel: {
    fontSize: 11,
  },
  unmaskedPhoneNumber: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  callBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  legalWarningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 9,
    borderRadius: 8,
  },
  legalWarningText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  reportBtnText: {
    color: '#93000A',
    fontSize: 12,
    fontWeight: '700',
  },
  // Dossier Foncier Prioritaire
  dossierSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dossierSectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dossierSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  queueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  queueBadgeText: {
    color: '#574500',
    fontSize: 10,
    fontWeight: '800',
  },
  dossierCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#0B1C30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  dossierPhotoWrap: {
    width: '100%',
    height: 180,
    position: 'relative',
    backgroundColor: '#E5EEFF',
  },
  dossierPhoto: {
    width: '100%',
    height: '100%',
  },
  dossierPhotoBadges: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    gap: 6,
  },
  salePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  salePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  surfPill: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  surfPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  priceFloatingPill: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(11, 28, 48, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  priceFloatingVal: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  priceFloatingCurrency: {
    fontSize: 10,
    fontWeight: '500',
  },
  dossierBody: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  dossierTitle: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  dossierMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dossierMetaText: {
    fontSize: 12,
  },
  pdfAttachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    gap: 8,
  },
  pdfAttachmentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pdfIconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfName: {
    fontSize: 12,
    fontWeight: '700',
  },
  pdfStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  pdfStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  seePdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  seePdfBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  controlGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  controlItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  controlItemText: {
    fontSize: 11,
    fontWeight: '600',
  },
  arbitrageActions: {
    gap: 8,
    paddingTop: 4,
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#008751',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  rejectBtnText: {
    color: '#BA1A1A',
    fontSize: 13,
    fontWeight: '700',
  },
  statusConfirmedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  statusConfirmedText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  // Modal de Rejet Foncier
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 28, 48, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  rejectModalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  rejectModalTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rejectModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rejectModalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  closeIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectModalDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  radioGroup: {
    gap: 8,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  radioLabel: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  rejectModalBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  confirmRejectBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmRejectBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  cancelRejectBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelRejectBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  // Floating Toast
  floatingToast: {
    position: 'absolute',
    bottom: 30,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingToastText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
});
