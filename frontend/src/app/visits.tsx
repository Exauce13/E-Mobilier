import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';

export interface VisitRequestItem {
  id: string;
  clientFullName: string;
  clientPhone: string;
  propertyTitle: string;
  propertyCommune: string;
  propertyQuartier: string;
  propertyPrice: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  isFeePaid: boolean;
}

const INITIAL_VISITS: VisitRequestItem[] = [
  {
    id: 'vis-1',
    clientFullName: 'Koffi MENSAH',
    clientPhone: '+229 01 97 12 34 56',
    propertyTitle: 'Villa d\'Exception avec Piscine - Fidjrossè Plage',
    propertyCommune: 'Cotonou',
    propertyQuartier: 'Fidjrossè',
    propertyPrice: '85 000 000 F CFA',
    scheduledDate: 'Samedi 31 Octobre 2026',
    scheduledTime: '10:00',
    status: 'pending',
    isFeePaid: true,
  },
  {
    id: 'vis-2',
    clientFullName: 'Amina DOSSOU-YOVO',
    clientPhone: '+229 01 66 88 99 00',
    propertyTitle: 'Parcelle Clôturée avec Titre Foncier - Calavi',
    propertyCommune: 'Abomey-Calavi',
    propertyQuartier: 'Calavi Kpota',
    propertyPrice: '15 000 000 F CFA',
    scheduledDate: 'Dimanche 1er Novembre 2026',
    scheduledTime: '15:30',
    status: 'confirmed',
    isFeePaid: true,
  },
  {
    id: 'vis-3',
    clientFullName: 'Rodrigue HOUNKPATIN',
    clientPhone: '+229 01 95 44 22 11',
    propertyTitle: 'Maison 3 Chambres Salon - Akpakpa Dodomè',
    propertyCommune: 'Cotonou',
    propertyQuartier: 'Akpakpa',
    propertyPrice: '150 000 F CFA/mois',
    scheduledDate: 'Lundi 2 Novembre 2026',
    scheduledTime: '11:15',
    status: 'pending',
    isFeePaid: true,
  },
];

export default function VisitsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, openLogin } = useAuth();

  const [visits, setVisits] = useState<VisitRequestItem[]>(INITIAL_VISITS);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'confirmed' | 'completed'>('all');

  const isAgent = isAuthenticated && user?.role === 'agent_immobilier';

  const filteredVisits = useMemo(() => {
    if (filterStatus === 'all') return visits;
    return visits.filter((v) => v.status === filterStatus);
  }, [visits, filterStatus]);

  const handleConfirmVisit = (id: string) => {
    setVisits((prev) =>
      prev.map((v) => (v.id === id ? { ...v, status: 'confirmed' } : v))
    );
  };

  const handleCompleteVisit = (id: string) => {
    setVisits((prev) =>
      prev.map((v) => (v.id === id ? { ...v, status: 'completed' } : v))
    );
  };

  const handleCallClient = (phone: string) => {
    const cleanPhone = phone.replace(/\s+/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      if (Platform.OS === 'web') {
        alert(`Numéro de téléphone du client : ${phone}`);
      }
    });
  };

  if (!isAuthenticated || !isAgent) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.restrictedContainer}>
          <View style={[styles.lockIconBox, { backgroundColor: theme.badgeBlueBg }]}>
            <SymbolView
              name={{ ios: 'calendar.badge.clock', android: 'calendar_today', web: 'calendar_today' }}
              size={48}
              tintColor={theme.primary}
            />
          </View>
          <Text style={[styles.restrictedTitle, { color: theme.text }]}>
            Visites Reçues (Espace Agent)
          </Text>
          <Text style={[styles.restrictedSubtitle, { color: theme.textSecondary }]}>
            Cette section permet aux agents immobiliers agréés de gérer et confirmer les visites demandées par les clients acquéreurs.
          </Text>

          {!isAuthenticated ? (
            <Pressable
              onPress={openLogin}
              style={[styles.primaryActionBtn, { backgroundColor: theme.primary }]}>
              <Text style={styles.primaryActionText}>Se connecter en tant qu'Agent</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push('/profile' as any)}
              style={[styles.primaryActionBtn, { backgroundColor: theme.primary }]}>
              <Text style={styles.primaryActionText}>Voir mon profil</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerBadgeRow}>
          <Text style={[styles.pageTitle, { color: theme.text }]}>Visites Reçues</Text>
          <View style={styles.badgeCount}>
            <Text style={styles.badgeCountText}>
              {visits.filter((v) => v.status === 'pending').length} en attente
            </Text>
          </View>
        </View>
        <Text style={[styles.pageSubtitle, { color: theme.textSecondary }]}>
          Demandes de rendez-vous de visite avec identification complète du client acquéreur.
        </Text>

        {/* STATUS FILTER CHIPS */}
        <View style={styles.statusFiltersRow}>
          {(
            [
              { id: 'all', label: 'Toutes' },
              { id: 'pending', label: 'En attente' },
              { id: 'confirmed', label: 'Confirmées' },
              { id: 'completed', label: 'Terminées' },
            ] as const
          ).map((item) => {
            const isSelected = filterStatus === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setFilterStatus(item.id)}
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: isSelected ? theme.primary : theme.backgroundElement,
                    borderColor: isSelected ? theme.primary : theme.cardBorder,
                  },
                ]}>
                <Text
                  style={[
                    styles.statusChipText,
                    {
                      color: isSelected ? '#FFFFFF' : theme.textSecondary,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* VISITS LIST */}
      <FlatList
        data={filteredVisits}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: BottomTabInset + Spacing.six + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isPending = item.status === 'pending';
          const isConfirmed = item.status === 'confirmed';

          return (
            <View
              style={[
                styles.visitCard,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}>
              {/* TOP: CLIENT IDENTITY (NOM & PRÉNOM EN GRAND) */}
              <View style={[styles.clientSection, { borderBottomColor: theme.cardBorder }]}>
                <View style={styles.clientInfoRow}>
                  <View style={[styles.avatarBox, { backgroundColor: theme.primaryLight }]}>
                    <Text style={[styles.avatarText, { color: theme.primary }]}>
                      {item.clientFullName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.clientLabel, { color: theme.gold }]}>
                      CLIENT DEMANDEUR DE VISITE
                    </Text>
                    {/* NOM ET PRENOM EN GRAND */}
                    <Text style={[styles.clientFullName, { color: theme.text }]}>
                      {item.clientFullName}
                    </Text>
                    {/* NUMERO DE TELEPHONE BENINOIS */}
                    <Text style={[styles.clientPhone, { color: theme.textSecondary }]}>
                      🇧🇯 {item.clientPhone}
                    </Text>
                  </View>

                  {/* Status Badge */}
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: isPending
                          ? theme.badgeGoldBg
                          : isConfirmed
                          ? theme.badgeGreenBg
                          : theme.backgroundElement,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.statusPillText,
                        {
                          color: isPending
                            ? theme.badgeGoldText
                            : isConfirmed
                            ? theme.badgeGreenText
                            : theme.textSecondary,
                        },
                      ]}>
                      {isPending
                        ? '⏳ En attente'
                        : isConfirmed
                        ? '✅ Confirmée'
                        : '🏁 Terminée'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* MIDDLE: RENDEZ-VOUS DATE & PROPERTY */}
              <View style={styles.detailsSection}>
                <View style={[styles.dateBadgeBox, { backgroundColor: theme.backgroundElement }]}>
                  <SymbolView
                    name={{ ios: 'clock.fill', android: 'schedule', web: 'schedule' }}
                    size={16}
                    tintColor={theme.primary}
                  />
                  <Text style={[styles.dateText, { color: theme.text }]}>
                    {item.scheduledDate} à <Text style={{ fontWeight: '800' }}>{item.scheduledTime}</Text>
                  </Text>
                </View>

                {/* Property Preview Block */}
                <View style={[styles.propertyCardMini, { borderColor: theme.cardBorder }]}>
                  <View style={styles.propertyInfo}>
                    <Text style={[styles.propertyMiniTitle, { color: theme.text }]} numberOfLines={1}>
                      {item.propertyTitle}
                    </Text>
                    <Text style={[styles.propertyMiniLocation, { color: theme.textSecondary }]}>
                      📍 {item.propertyQuartier}, {item.propertyCommune}
                    </Text>
                    <Text style={[styles.propertyMiniPrice, { color: theme.primary }]}>
                      {item.propertyPrice}
                    </Text>
                  </View>
                </View>

                {/* Fee Paid Badge */}
                {item.isFeePaid && (
                  <View style={styles.feePaidRow}>
                    <SymbolView
                      name={{ ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' }}
                      size={14}
                      tintColor={theme.primary}
                    />
                    <Text style={[styles.feePaidText, { color: theme.primary }]}>
                      Frais de visite réglés via Mobile Money Bénin (FIFA)
                    </Text>
                  </View>
                )}
              </View>

              {/* BOTTOM: ACTIONS BUTTONS */}
              <View style={[styles.actionsRow, { borderTopColor: theme.cardBorder }]}>
                <Pressable
                  onPress={() => handleCallClient(item.clientPhone)}
                  style={[styles.callBtn, { borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
                  hitSlop={8}>
                  <SymbolView
                    name={{ ios: 'phone.fill', android: 'phone', web: 'phone' }}
                    size={15}
                    tintColor={theme.text}
                  />
                  <Text style={[styles.callBtnText, { color: theme.text }]}>Appeler</Text>
                </Pressable>

                {isPending && (
                  <Pressable
                    onPress={() => handleConfirmVisit(item.id)}
                    style={[styles.confirmBtn, { backgroundColor: theme.primary }]}>
                    <SymbolView
                      name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                      size={16}
                      tintColor="#FFFFFF"
                    />
                    <Text style={styles.confirmBtnText}>Confirmer le RDV</Text>
                  </Pressable>
                )}

                {isConfirmed && (
                  <Pressable
                    onPress={() => handleCompleteVisit(item.id)}
                    style={[styles.completeBtn, { backgroundColor: theme.badgeGreenBg, borderColor: theme.badgeGreenText }]}>
                    <SymbolView
                      name={{ ios: 'checkmark.circle.fill', android: 'done_all', web: 'done_all' }}
                      size={16}
                      tintColor={theme.badgeGreenText}
                    />
                    <Text style={[styles.completeBtnText, { color: theme.badgeGreenText }]}>
                      Marquer effectuée
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconBox, { backgroundColor: theme.backgroundElement }]}>
              <SymbolView
                name={{ ios: 'calendar', android: 'event_busy', web: 'event_busy' }}
                size={38}
                tintColor={theme.textSecondary}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Aucune visite trouvée</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {filterStatus === 'all'
                ? 'Vous n\'avez pas encore reçu de demandes de visites pour vos propriétés.'
                : 'Aucune visite avec ce statut pour le moment.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  badgeCount: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeCountText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '800',
  },
  pageSubtitle: {
    fontSize: 13,
    marginBottom: Spacing.three,
  },
  statusFiltersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 12,
  },

  /* RESTRICTED ACCESS */
  restrictedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },
  lockIconBox: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.four,
  },
  restrictedTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  restrictedSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.five,
  },
  primaryActionBtn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  /* LIST CONTENT */
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.four,
  },
  visitCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  clientSection: {
    padding: Spacing.four,
    borderBottomWidth: 1,
  },
  clientInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatarBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '800',
  },
  clientLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  clientFullName: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
  },
  clientPhone: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* DETAILS SECTION */
  detailsSection: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  dateBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  dateText: {
    fontSize: 13,
  },
  propertyCardMini: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    marginTop: 4,
  },
  propertyInfo: {
    gap: 3,
  },
  propertyMiniTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  propertyMiniLocation: {
    fontSize: 12,
  },
  propertyMiniPrice: {
    fontSize: 13,
    fontWeight: '800',
  },
  feePaidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  feePaidText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* ACTIONS ROW */
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderTopWidth: 1,
    gap: 10,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
  },
  callBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 10,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  completeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
  },
  completeBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* EMPTY STATE */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 260,
  },
});
