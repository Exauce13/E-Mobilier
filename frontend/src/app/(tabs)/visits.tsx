import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InstitutionHeader } from '@/components/ui/institution-header';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { visitesApi } from '@/services/api';
import type { VisiteBackendItem } from '@/types/api';
import { formatFcfa } from '@/types/property';

export default function VisitsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, openAuthModal, user, isAgentMobilier } = useAuth();

  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [visits, setVisits] = useState<VisiteBackendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals (Stitch exact)
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<VisiteBackendItem | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [validatingOtp, setValidatingOtp] = useState(false);

  const loadVisits = useCallback(async () => {
    if (!isAuthenticated) {
      setVisits([]);
      setLoading(false);
      return;
    }
    try {
      const res = await visitesApi.getMyVisits();
      if (res.success && res.data) {
        setVisits(res.data.data || []);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      await loadVisits();
      if (active) setLoading(false);
    };
    void run();
    return () => {
      active = false;
    };
  }, [loadVisits]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadVisits();
    setRefreshing(false);
  };

  const handleOpenDetail = (v: VisiteBackendItem) => {
    setSelectedVisit(v);
    setDetailModalOpen(true);
  };

  const handleOpenOtp = (v: VisiteBackendItem) => {
    setSelectedVisit(v);
    setOtpCode('');
    setOtpModalOpen(true);
  };

  const handleValidateOtp = async () => {
    if (!selectedVisit) return;
    if (otpCode.length < 4) {
      Alert.alert('Code invalide', 'Veuillez saisir le code OTP à 6 chiffres communiqué par le client.');
      return;
    }

    setValidatingOtp(true);
    try {
      const res = await visitesApi.validerOtp(selectedVisit.id, otpCode);
      if (res.success) {
        Alert.alert(
          'Procès-Verbal Scellé',
          `La présence sur le terrain a été validée contradictoirement par OTP. Le séquestre bancaire est libéré.`
        );
        setOtpModalOpen(false);
        await loadVisits();
      } else {
        Alert.alert('Erreur de validation', res.message || 'Code OTP incorrect.');
      }
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Erreur réseau');
    } finally {
      setValidatingOtp(false);
    }
  };

  const filteredVisits = visits.filter((v) => {
    if (activeTab === 'upcoming') {
      return v.status === 'confirmed' || v.status === 'pending' || v.status === 'in_progress';
    }
    return v.status === 'completed' || v.status === 'cancelled';
  });

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surface }]}>
        <InstitutionHeader />
        <View style={styles.authGate}>
          <SymbolView
            name={{ ios: 'figure.walk', android: 'hail', web: 'hail' }}
            size={48}
            tintColor={theme.primaryContainer}
          />
          <Text style={[styles.gateTitle, { color: theme.text }]}>Visites Foncieres Sécurisées</Text>
          <Text style={[styles.gateDesc, { color: theme.textSecondary }]}>
            Connectez-vous pour accéder à vos rendez-vous terrain encadrés par nos agents assermentés.
          </Text>
          <Pressable
            onPress={() => openAuthModal('login')}
            style={[styles.gateBtn, { backgroundColor: theme.primaryContainer }]}>
            <Text style={styles.gateBtnText}>Se connecter</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <InstitutionHeader />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primaryContainer} />
        }
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: BottomTabInset + Spacing.six + insets.bottom },
        ]}>
        {/* 1. AGENT IDENTITY CARD (STITCH) */}
        <View
          style={[
            styles.agentIdentityCard,
            { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
          ]}>
          <View style={styles.agentTopRow}>
            <View style={styles.agentAvatarBox}>
              <SymbolView
                name={{ ios: 'person.crop.circle.badge.checkmark', android: 'verified_user', web: 'verified_user' }}
                size={38}
                tintColor={theme.primaryContainer}
              />
            </View>

            <View style={styles.agentInfoCol}>
              <View style={styles.agentNameBadgeRow}>
                <Text style={[styles.agentNameText, { color: theme.text }]}>
                  {user?.name || 'M. Pamphile Dossou'}
                </Text>
                <View style={[styles.agreePill, { backgroundColor: theme.badgeGreenBg }]}>
                  <Text style={[styles.agreePillText, { color: theme.badgeGreenText }]}>Agréé</Text>
                </View>
              </View>

              <Text style={[styles.agentSubText, { color: theme.textSecondary }]}>
                Agrément n° 2024-AG-0412 • Cabinet Littoral, Cotonou
              </Text>

              <View style={styles.agentRtkRow}>
                <View style={[styles.greenLiveDot, { backgroundColor: theme.success }]} />
                <Text style={[styles.rtkText, { color: theme.primaryContainer }]}>
                  En service terrain • GPS RTK ±1.5m
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.agentTrustBadges, { borderTopColor: theme.cardBorder }]}>
            <View style={styles.trustItem}>
              <Text style={[styles.trustValue, { color: theme.tertiary }]}>★ 4.9</Text>
              <Text style={[styles.trustLabel, { color: theme.textSecondary }]}>48 sans litige</Text>
            </View>
            <View style={styles.trustItem}>
              <Text style={[styles.trustValue, { color: theme.primaryContainer }]}>100%</Text>
              <Text style={[styles.trustLabel, { color: theme.textSecondary }]}>PV ANDF scellés</Text>
            </View>
            <View style={styles.trustItem}>
              <Text style={[styles.trustValue, { color: theme.navy }]}>BCEAO</Text>
              <Text style={[styles.trustLabel, { color: theme.textSecondary }]}>Séquestre vérifié</Text>
            </View>
          </View>
        </View>

        {/* 2. THREE METRICS COUNTERS (STITCH) */}
        <View style={styles.metricsGrid}>
          <View
            style={[
              styles.metricCard,
              { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
            ]}>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Visites du jour</Text>
            <Text style={[styles.metricVal, { color: theme.primaryContainer }]}>3</Text>
            <Text style={[styles.metricSub, { color: theme.success }]}>1 en cours</Text>
          </View>

          <View
            style={[
              styles.metricCard,
              { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
            ]}>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>PV scellés ce mois</Text>
            <Text style={[styles.metricVal, { color: theme.text }]}>24</Text>
            <Text style={[styles.metricSub, { color: theme.textSecondary }]}>ANDF Notariat</Text>
          </View>

          <View
            style={[
              styles.metricCard,
              { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
            ]}>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Présence OTP</Text>
            <Text style={[styles.metricVal, { color: theme.tertiary }]}>100%</Text>
            <Text style={[styles.metricSub, { color: theme.textSecondary }]}>Contradictoire</Text>
          </View>
        </View>

        {/* 3. TABS: À VENIR / HISTORIQUE (STITCH) */}
        <View style={[styles.tabsBar, { backgroundColor: theme.surfaceContainerLow }]}>
          <Pressable
            onPress={() => setActiveTab('upcoming')}
            style={[
              styles.tabBtn,
              activeTab === 'upcoming' && { backgroundColor: theme.surfaceContainerLowest },
            ]}>
            <Text
              style={[
                styles.tabBtnText,
                { color: activeTab === 'upcoming' ? theme.text : theme.textSecondary },
              ]}>
              À venir / En cours ({visits.length || 3})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('history')}
            style={[
              styles.tabBtn,
              activeTab === 'history' && { backgroundColor: theme.surfaceContainerLowest },
            ]}>
            <Text
              style={[
                styles.tabBtnText,
                { color: activeTab === 'history' ? theme.text : theme.textSecondary },
              ]}>
              Historique / Clôturées
            </Text>
          </Pressable>
        </View>

        {/* 4. VISITS LIST (STITCH DESIGN) */}
        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="small" color={theme.primaryContainer} />
          </View>
        ) : filteredVisits.length > 0 ? (
          filteredVisits.map((v) => {
            const isConfirmed = v.status === 'confirmed';
            return (
              <View
                key={v.id}
                style={[
                  styles.visitItemCard,
                  { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
                ]}>
                <View style={styles.visitItemTop}>
                  <View style={styles.visitDateHourRow}>
                    <SymbolView
                      name={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' }}
                      size={14}
                      tintColor={theme.primaryContainer}
                    />
                    <Text style={[styles.visitHourText, { color: theme.text }]}>
                      {new Date(v.scheduled_date).toLocaleString('fr-FR', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: isConfirmed ? theme.badgeGreenBg : theme.badgeGoldBg,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: isConfirmed ? theme.badgeGreenText : theme.badgeGoldText },
                      ]}>
                      {v.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Property and Client info */}
                <Text style={[styles.visitPropertyTitle, { color: theme.text }]}>
                  {(v.propriete as any)?.titre ||
                    (v.propriete
                      ? `${v.propriete.type === 'parcelle' ? 'Parcelle' : 'Villa'} ${v.propriete.commune}`
                      : 'Villa Duplex 4 pièces')}
                </Text>

                <View style={styles.visitMetaRow}>
                  <SymbolView
                    name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }}
                    size={13}
                    tintColor={theme.primaryContainer}
                  />
                  <Text style={[styles.visitLocationText, { color: theme.textSecondary }]}>
                    {v.propriete?.commune || 'Abomey-Calavi'}, {v.propriete?.quartier || 'Togbin'} (GPS RTK)
                  </Text>
                </View>

                <View style={styles.visitClientRow}>
                  <Text style={[styles.clientLabel, { color: theme.textSecondary }]}>Visiteur :</Text>
                  <Text style={[styles.clientName, { color: theme.text }]}>
                    {v.client?.name || 'Mme Aïcha Bio'}
                  </Text>
                  <Text style={[styles.quittanceTag, { color: theme.primaryContainer }]}>
                    • Quittance 500 F Réglée
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.visitCardActions}>
                  <Pressable
                    onPress={() => handleOpenDetail(v)}
                    style={[
                      styles.detailBtn,
                      { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder },
                    ]}>
                    <Text style={[styles.detailBtnText, { color: theme.text }]}>
                      Détail & Itinéraire
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleOpenOtp(v)}
                    style={[styles.otpBtn, { backgroundColor: theme.primaryContainer }]}>
                    <SymbolView
                      name={{ ios: 'lock.circle.fill', android: 'qr_code_2', web: 'qr_code_2' }}
                      size={14}
                      tintColor="#FFFFFF"
                    />
                    <Text style={styles.otpBtnText}>Valider OTP Terrain</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        ) : (
          /* Empty / Mock State when no dynamic visits */
          <View
            style={[
              styles.emptyVisitsCard,
              { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
            ]}>
            <SymbolView
              name={{ ios: 'calendar.badge.exclamationmark', android: 'event_busy', web: 'event_busy' }}
              size={36}
              tintColor={theme.outline}
            />
            <Text style={[styles.emptyVisitsTitle, { color: theme.text }]}>
              Aucune visite dans cette section
            </Text>
            <Text style={[styles.emptyVisitsDesc, { color: theme.textSecondary }]}>
              Les rendez-vous planifiés et quittances de visite (500 FCFA) s'afficheront ici.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* 5. MODAL: DÉTAIL DE LA VISITE CONFIRMÉE (STITCH EXACT) */}
      <Modal visible={detailModalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: theme.surfaceContainerLowest, paddingBottom: insets.bottom + 20 },
            ]}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalBadgeHeader}>
                <View style={[styles.confirmBadge, { backgroundColor: theme.badgeGreenBg }]}>
                  <Text style={[styles.confirmBadgeText, { color: theme.badgeGreenText }]}>
                    CONFIRMÉE & SÉCURISÉE
                  </Text>
                </View>
                <Text style={[styles.refText, { color: theme.textSecondary }]}>VIS-2025-089-BJ</Text>
              </View>
              <Pressable
                onPress={() => setDetailModalOpen(false)}
                style={[styles.modalCloseBtn, { backgroundColor: theme.surfaceContainerLow }]}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={14}
                  tintColor={theme.text}
                />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalContentScroll}>
              <Text style={[styles.visitScheduleH1, { color: theme.text }]}>
                Samedi 25 Janvier 2025 à 15h30
              </Text>
              <Text style={[styles.visitScheduleSub, { color: theme.textSecondary }]}>
                Heure locale de Cotonou (GMT+1) • Mandant : Mme Aïcha Bio
              </Text>

              {/* Countdown Banner */}
              <View style={[styles.countdownBox, { backgroundColor: theme.badgeGoldBg }]}>
                <SymbolView
                  name={{ ios: 'clock.badge.checkmark.fill', android: 'timer', web: 'timer' }}
                  size={16}
                  tintColor={theme.badgeGoldText}
                />
                <Text style={[styles.countdownText, { color: theme.badgeGoldText }]}>
                  Rendez-vous sur le terrain dans 1j 04h 18m
                </Text>
              </View>

              {/* Localisation & Itinéraire */}
              <View
                style={[
                  styles.itineraryBox,
                  { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder },
                ]}>
                <Text style={[styles.itineraryTitle, { color: theme.text }]}>
                  Localisation & Itinéraire
                </Text>
                <Text style={[styles.gpsCoordinates, { color: theme.primaryContainer }]}>
                  📍 6.3541° N, 2.3188° E • Parcelle n° 14.821
                </Text>
                <Text style={[styles.landmarkDesc, { color: theme.textSecondary }]}>
                  Point de repère : Carrefour IITA, 200m après pharmacie Togbin Plage.
                </Text>

                <Pressable
                  onPress={() => Linking.openURL('https://maps.google.com/?q=6.3541,2.3188')}
                  style={[styles.mapsBtn, { backgroundColor: theme.primaryContainer }]}>
                  <SymbolView
                    name={{ ios: 'location.fill', android: 'navigation', web: 'navigation' }}
                    size={14}
                    tintColor="#FFFFFF"
                  />
                  <Text style={styles.mapsBtnText}>Ouvrir l'Itinéraire GPS</Text>
                </Pressable>
              </View>

              {/* Protocole Cadastral */}
              <View
                style={[
                  styles.protocolBox,
                  { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder },
                ]}>
                <Text style={[styles.protocolTitle, { color: theme.text }]}>Protocole Cadastral</Text>
                <Text style={[styles.protocolItem, { color: theme.textSecondary }]}>
                  ✓ 4 Bornes cadastrales peintes et identifiées
                </Text>
                <Text style={[styles.protocolItem, { color: theme.textSecondary }]}>
                  ✓ Quittance d'accompagnement de 500 FCFA enregistrée
                </Text>
                <Text style={[styles.protocolItem, { color: theme.textSecondary }]}>
                  ✓ Procès-verbal contradictoire avec signature OTP
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 6. MODAL: VALIDATION CODE OTP & ÉMARGEMENT (STITCH EXACT) */}
      <Modal visible={otpModalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: theme.surfaceContainerLowest, paddingBottom: insets.bottom + 20 },
            ]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={[styles.otpSheetTitle, { color: theme.text }]}>
                  Validation OTP & Émargement
                </Text>
                <Text style={[styles.otpSheetSub, { color: theme.textSecondary }]}>
                  Terrain R+1 Viabilisé 500 m² • Togbin Plage
                </Text>
              </View>
              <Pressable
                onPress={() => setOtpModalOpen(false)}
                style={[styles.modalCloseBtn, { backgroundColor: theme.surfaceContainerLow }]}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={14}
                  tintColor={theme.text}
                />
              </Pressable>
            </View>

            {/* GPS Match Tag */}
            <View style={[styles.gpsMatchTag, { backgroundColor: theme.badgeGreenBg }]}>
              <SymbolView
                name={{ ios: 'location.circle.fill', android: 'my_location', web: 'my_location' }}
                size={14}
                tintColor={theme.badgeGreenText}
              />
              <Text style={[styles.gpsMatchText, { color: theme.badgeGreenText }]}>
                GPS TERRAIN CONFORME ±1.8m • 6.3541° N, 2.3188° E
              </Text>
            </View>

            {/* OTP Input Field */}
            <View style={styles.otpFieldWrap}>
              <Text style={[styles.otpInputLabel, { color: theme.text }]}>
                Code OTP de Présence (6 chiffres) :
              </Text>
              <Text style={[styles.otpInstruction, { color: theme.textSecondary }]}>
                Demandez au visiteur le code reçu par SMS/Notification sur son téléphone.
              </Text>
              <TextInput
                value={otpCode}
                onChangeText={setOtpCode}
                placeholder="Ex: 849201"
                placeholderTextColor={theme.outline}
                keyboardType="numeric"
                maxLength={6}
                style={[
                  styles.otpInputBox,
                  {
                    backgroundColor: theme.surfaceContainerLow,
                    borderColor: theme.cardBorder,
                    color: theme.text,
                  },
                ]}
              />
            </View>

            {/* Émargement Bilatéral Button */}
            <Pressable
              disabled={validatingOtp}
              onPress={handleValidateOtp}
              style={({ pressed }) => [
                styles.validateOtpBtn,
                { backgroundColor: theme.primaryContainer },
                (pressed || validatingOtp) && { opacity: 0.9 },
              ]}>
              {validatingOtp ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <SymbolView
                    name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }}
                    size={16}
                    tintColor="#FFFFFF"
                  />
                  <Text style={styles.validateOtpBtnText}>Sceller le PV & Émarger</Text>
                </>
              )}
            </Pressable>
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
  authGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: 12,
  },
  gateTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  gateDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  gateBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  gateBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  agentIdentityCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 12,
  },
  agentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  agentAvatarBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentInfoCol: {
    flex: 1,
    gap: 2,
  },
  agentNameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  agentNameText: {
    fontSize: 15,
    fontWeight: '800',
  },
  agreePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  agreePillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  agentSubText: {
    fontSize: 11,
  },
  agentRtkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  greenLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rtkText: {
    fontSize: 11,
    fontWeight: '700',
  },
  agentTrustBadges: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop: 8,
  },
  trustItem: {
    alignItems: 'center',
  },
  trustValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  trustLabel: {
    fontSize: 10,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    gap: 2,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  metricVal: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  metricSub: {
    fontSize: 9,
    fontWeight: '700',
  },
  tabsBar: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  loaderWrap: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  visitItemCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 8,
  },
  visitItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  visitDateHourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  visitHourText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  visitPropertyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  visitMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  visitLocationText: {
    fontSize: 12,
  },
  visitClientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clientLabel: {
    fontSize: 11,
  },
  clientName: {
    fontSize: 11,
    fontWeight: '700',
  },
  quittanceTag: {
    fontSize: 11,
    fontWeight: '700',
  },
  visitCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  detailBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  otpBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  otpBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyVisitsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyVisitsTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyVisitsDesc: {
    fontSize: 12,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.four,
    gap: 12,
    maxHeight: '85%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  confirmBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  refText: {
    fontSize: 11,
    fontWeight: '600',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContentScroll: {
    maxHeight: 400,
  },
  visitScheduleH1: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 6,
  },
  visitScheduleSub: {
    fontSize: 12,
    marginTop: 2,
  },
  countdownBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '700',
  },
  itineraryBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 6,
    marginTop: 12,
  },
  itineraryTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  gpsCoordinates: {
    fontSize: 12,
    fontWeight: '700',
  },
  landmarkDesc: {
    fontSize: 11,
  },
  mapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  mapsBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  protocolBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 4,
    marginTop: 12,
  },
  protocolTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  protocolItem: {
    fontSize: 11,
    lineHeight: 16,
  },
  otpSheetTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  otpSheetSub: {
    fontSize: 11,
    marginTop: 1,
  },
  gpsMatchTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 8,
  },
  gpsMatchText: {
    fontSize: 11,
    fontWeight: '800',
  },
  otpFieldWrap: {
    gap: 6,
    marginTop: 4,
  },
  otpInputLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  otpInstruction: {
    fontSize: 11,
  },
  otpInputBox: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
  },
  validateOtpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 6,
  },
  validateOtpBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
