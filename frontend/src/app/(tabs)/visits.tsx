import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { visitesApi } from '@/services/api';
import type { VisiteBackendItem } from '@/types/api';
import { formatFcfa } from '@/types/property';

const STATUS_TABS = [
  { key: 'tous', label: 'Toutes' },
  { key: 'pending', label: 'En attente' },
  { key: 'confirmed', label: 'Confirmées' },
  { key: 'completed', label: 'Terminées' },
  { key: 'cancelled', label: 'Annulées' },
] as const;

export default function VisitsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, openAuthModal, isAgentMobilier, isAdminStaff } = useAuth();

  const [statusFilter, setStatusFilter] = useState<string>('tous');
  const [visits, setVisits] = useState<VisiteBackendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadVisits = useCallback(async () => {
    if (!isAuthenticated) {
      setVisits([]);
      setLoading(false);
      return;
    }
    const res = await visitesApi.getMyVisits(statusFilter === 'tous' ? undefined : statusFilter);
    if (res.success && res.data) {
      setVisits(res.data.data || []);
    }
  }, [isAuthenticated, statusFilter]);

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

  const handleCancel = (visitId: number) => {
    Alert.alert(
      'Annuler cette visite ?',
      'Cette action marquera la demande de visite comme annulée.',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            const res = await visitesApi.cancelVisit(visitId);
            if (res.success) {
              await loadVisits();
            } else {
              Alert.alert('Erreur', res.message || "Impossible d'annuler.");
            }
          },
        },
      ]
    );
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.authGate}>
          <Text style={[styles.gateTitle, { color: theme.text }]}>Mes Visites Physiques</Text>
          <Text style={[styles.gateDesc, { color: theme.textSecondary }]}>
            Connectez-vous pour consulter vos demandes de visites (500 F CFA) et rendez-vous confirmés.
          </Text>
          <Pressable onPress={() => openAuthModal('login')} style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
            <Text style={styles.primaryBtnText}>Se connecter</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={visits}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: BottomTabInset + Spacing.six + insets.bottom },
        ]}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pageTitle, { color: theme.text }]}>Suivi des Visites</Text>
                <Text style={[styles.pageSub, { color: theme.textSecondary }]}>
                  {isAdminStaff
                    ? 'Vue globale administrateur'
                    : isAgentMobilier
                    ? 'Visites reçues & demandées (coordonnées protégées)'
                    : 'Vos demandes de visites physiques'}
                </Text>
              </View>
              {isAdminStaff && (
                <Pressable
                  onPress={() => router.push('/admin' as any)}
                  style={[styles.adminBtn, { backgroundColor: theme.navy }]}>
                  <Text style={styles.adminBtnText}>Back-Office</Text>
                </Pressable>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
              {STATUS_TABS.map((tab) => {
                const active = statusFilter === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => setStatusFilter(tab.key)}
                    style={[
                      styles.tabChip,
                      {
                        backgroundColor: active ? theme.primary : theme.cardBackground,
                        borderColor: active ? theme.primary : theme.cardBorder,
                      },
                    ]}>
                    <Text style={{ color: active ? '#FFFFFF' : theme.text, fontWeight: '700', fontSize: 13 }}>
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => {
          const clientName = item.client
            ? `${item.client.prenom ?? ''} ${item.client.name ?? ''}`.trim() || item.client.nom_complet || 'Client'
            : `Demande #${item.id}`;
          const prop = item.propriete;

          return (
            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.refText, { color: theme.gold }]}>VIS-{String(item.id).padStart(5, '0')}</Text>
                  <Text style={[styles.clientName, { color: theme.text }]}>
                    {isAgentMobilier && !isAdminStaff ? `Demandeur : ${clientName}` : clientName}
                  </Text>
                  {item.client?.telephone ? (
                    <Text style={[styles.phoneText, { color: theme.textSecondary }]}>
                      📞 {item.client.telephone}
                    </Text>
                  ) : isAgentMobilier && !isAdminStaff ? (
                    <Text style={[styles.maskedNote, { color: theme.textSecondary }]}>
                      🔒 Coordonnées protégées (gestion E-Mobilier)
                    </Text>
                  ) : null}
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        item.status === 'confirmed'
                          ? theme.badgeGreenBg
                          : item.status === 'cancelled'
                          ? '#FEE2E2'
                          : theme.badgeGoldBg,
                    },
                  ]}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color:
                        item.status === 'confirmed'
                          ? theme.badgeGreenText
                          : item.status === 'cancelled'
                          ? '#B91C1C'
                          : theme.badgeGoldText,
                    }}>
                    {item.status === 'pending'
                      ? 'EN ATTENTE'
                      : item.status === 'confirmed'
                      ? 'CONFIRMÉE'
                      : item.status === 'completed'
                      ? 'TERMINÉE'
                      : item.status === 'cancelled'
                      ? 'ANNULÉE'
                      : item.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={[styles.infoStrip, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.infoText, { color: theme.text }]}>
                  📅 {new Date(item.scheduled_date).toLocaleString('fr-FR')}
                </Text>
                <Text style={[styles.infoText, { color: theme.primary }]}>
                  {item.is_fee_paid ? '✅ Frais 500 F acquittés' : '⏳ Frais de visite requis'}
                </Text>
              </View>

              {/* Propriété associée */}
              {prop && (
                <Pressable
                  onPress={() => router.push(`/property/${prop.id}` as any)}
                  style={[styles.propBox, { borderColor: theme.cardBorder }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.propTitle, { color: theme.text }]}>
                      {prop.type.toUpperCase()} — {prop.commune} {prop.quartier ? `(${prop.quartier})` : ''}
                    </Text>
                    <Text style={[styles.propSub, { color: theme.textSecondary }]}>
                      Voir la fiche du bien →
                    </Text>
                  </View>
                  <Text style={[styles.propPrice, { color: theme.primary }]}>{formatFcfa(prop.prix)}</Text>
                </Pressable>
              )}

              {/* Agent assigné (si vue client) */}
              {!isAgentMobilier && item.agent && (
                <View style={[styles.agentBox, { backgroundColor: theme.primaryLight, borderColor: theme.primaryBorder }]}>
                  <Text style={[styles.agentBoxTitle, { color: theme.primaryDark }]}>
                    👨‍💼 Agent mandaté : {item.agent.prenom ? `${item.agent.prenom} ${item.agent.name}` : item.agent.name}
                  </Text>
                  {item.agent.telephone ? (
                    <Text style={[styles.agentBoxPhone, { color: theme.textSecondary }]}>
                      Contact : {item.agent.telephone}
                    </Text>
                  ) : null}
                </View>
              )}

              {!isAgentMobilier && !item.agent && item.status === 'pending' && (
                <Text style={[styles.pendingAgentNote, { color: theme.textSecondary }]}>
                  ⏳ Attribution d'un agent de zone en cours par l'équipe E-Mobilier.
                </Text>
              )}

              {item.instructions_itineraire ? (
                <Text style={[styles.instructions, { color: theme.textSecondary }]}>
                  📍 Consignes : {item.instructions_itineraire}
                </Text>
              ) : null}

              {item.compte_rendu ? (
                <Text style={[styles.instructions, { color: theme.text }]}>
                  📝 Compte-rendu : {item.compte_rendu}
                </Text>
              ) : null}

              {item.status === 'pending' && (
                <Pressable
                  onPress={() => handleCancel(item.id)}
                  style={[styles.cancelBtn, { borderColor: '#FCA5A5' }]}>
                  <Text style={styles.cancelBtnText}>Annuler cette visite</Text>
                </Pressable>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.emptyBox}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Aucune visite enregistrée</Text>
              <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
                Ouvrez la fiche d'un bien depuis le catalogue pour planifier une visite physique (500 F CFA).
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.three,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  headerBlock: { gap: Spacing.two },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pageTitle: { fontSize: 22, fontWeight: '900' },
  pageSub: { fontSize: 13 },
  adminBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  adminBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  tabsRow: { gap: 8, paddingVertical: 4 },
  tabChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1 },
  card: { borderRadius: 18, borderWidth: 1, padding: Spacing.three, gap: 10, marginBottom: Spacing.two },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  refText: { fontSize: 11, fontWeight: '800' },
  clientName: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  phoneText: { fontSize: 13, marginTop: 2 },
  maskedNote: { fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  infoStrip: { borderRadius: 12, padding: 10, gap: 4 },
  infoText: { fontSize: 13, fontWeight: '600' },
  propBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  propTitle: { fontSize: 13, fontWeight: '700', flex: 1 },
  propSub: { fontSize: 11, marginTop: 1 },
  propPrice: { fontSize: 13, fontWeight: '800' },
  agentBox: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
  },
  agentBoxTitle: { fontSize: 13, fontWeight: '700' },
  agentBoxPhone: { fontSize: 12 },
  pendingAgentNote: { fontSize: 12, fontStyle: 'italic' },
  instructions: { fontSize: 13, lineHeight: 18 },
  cancelBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  cancelBtnText: { color: '#DC2626', fontWeight: '700', fontSize: 13 },
  emptyBox: { alignItems: 'center', paddingVertical: Spacing.six, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptyDesc: { fontSize: 13, textAlign: 'center', paddingHorizontal: Spacing.four },
  authGate: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.five, gap: 12 },
  gateTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  gateDesc: { fontSize: 14, textAlign: 'center' },
  primaryBtn: { borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
