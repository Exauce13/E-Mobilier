import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { inquiriesApi, visitesApi } from '@/services/api';
import { localInquiriesStorage } from '@/services/local-store';
import type { PropertyInquiryItem, VisiteBackendItem } from '@/types/api';
import { formatFcfa } from '@/types/property';
import { getInquiryTypeLabel, getStatusDisplay } from '@/utils/validation';

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
  const { horizontalPadding } = useResponsive();
  const { isAuthenticated, openAuthModal, isAgentMobilier, isAdminStaff } = useAuth();

  const [section, setSection] = useState<'visites' | 'rdv'>('visites');
  const [statusFilter, setStatusFilter] = useState<string>('tous');
  const [visits, setVisits] = useState<VisiteBackendItem[]>([]);
  const [inquiries, setInquiries] = useState<PropertyInquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadVisits = useCallback(async () => {
    const localInqs = await localInquiriesStorage.list();

    if (!isAuthenticated) {
      setVisits([]);
      setInquiries(localInqs);
      return;
    }

    const [visRes, inqRes] = await Promise.all([
      visitesApi.getMyVisits(statusFilter === 'tous' ? undefined : statusFilter),
      inquiriesApi.getMyInquiries({ page: 1 }),
    ]);

    if (visRes.success && visRes.data) {
      setVisits(visRes.data.data || []);
    }
    if (inqRes.success && inqRes.data?.data) {
      const merged = [...inqRes.data.data];
      localInqs.forEach((loc) => {
        if (!merged.some((m) => m.id === loc.id)) merged.push(loc);
      });
      setInquiries(merged);
    } else {
      setInquiries(localInqs);
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
          <Text style={[styles.gateTitle, { color: theme.text }]}>Mes Visites & Rendez-vous</Text>
          <Text style={[styles.gateDesc, { color: theme.textSecondary }]}>
            Connectez-vous pour consulter vos visites physiques (500 F CFA), rendez-vous et prises de
            contact.
          </Text>
          <Pressable
            onPress={() => openAuthModal('login')}
            style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
            <Text style={styles.primaryBtnText}>Se connecter</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
        contentContainerStyle={[
          styles.list,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: BottomTabInset + insets.bottom + 84,
          },
        ]}>
        <View style={styles.innerWrap}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.pageTitle, { color: theme.text }]}>Suivi des Visites & RDV</Text>
              <Text style={[styles.pageSub, { color: theme.textSecondary }]}>
                {isAdminStaff
                  ? 'Vue globale administrateur'
                  : isAgentMobilier
                  ? 'Visites reçues, demandées et rendez-vous clients'
                  : 'Vos visites physiques, rendez-vous et prises de contact'}
              </Text>
            </View>
            {isAdminStaff ? (
              <Pressable
                onPress={() => router.push('/admin' as any)}
                style={[styles.adminBtn, { backgroundColor: theme.navy }]}>
                <Text style={styles.adminBtnText}>Back-Office</Text>
              </Pressable>
            ) : isAgentMobilier ? (
              <Pressable
                onPress={() => router.push('/agent' as any)}
                style={[styles.adminBtn, { backgroundColor: theme.navy }]}>
                <Text style={styles.adminBtnText}>Tableau Agent</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Section switcher */}
          <View style={[styles.sectionSwitch, { backgroundColor: theme.backgroundElement }]}>
            <Pressable
              onPress={() => setSection('visites')}
              style={[
                styles.sectionBtn,
                section === 'visites' && { backgroundColor: theme.cardBackground },
              ]}>
              <Text
                style={{
                  color: section === 'visites' ? theme.primary : theme.textSecondary,
                  fontWeight: '800',
                  fontSize: 13,
                }}>
                Visites encadrées ({visits.length})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSection('rdv')}
              style={[
                styles.sectionBtn,
                section === 'rdv' && { backgroundColor: theme.cardBackground },
              ]}>
              <Text
                style={{
                  color: section === 'rdv' ? theme.primary : theme.textSecondary,
                  fontWeight: '800',
                  fontSize: 13,
                }}>
                RDV & Contacts ({inquiries.length})
              </Text>
            </Pressable>
          </View>

          {section === 'visites' && (
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
                    <Text
                      style={{
                        color: active ? '#FFFFFF' : theme.text,
                        fontWeight: '700',
                        fontSize: 12,
                      }}>
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {loading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
          ) : section === 'visites' ? (
            visits.length === 0 ? (
              <View
                style={[
                  styles.emptyBox,
                  { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                ]}>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>
                  Aucune visite physique enregistrée
                </Text>
                <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
                  Ouvrez la fiche d'un bien depuis le catalogue pour planifier une visite physique.
                </Text>
                <Pressable
                  onPress={() => router.push('/explore' as any)}
                  style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
                  <Text style={styles.primaryBtnText}>Explorer les biens</Text>
                </Pressable>
              </View>
            ) : (
              visits.map((item) => {
                const clientName = item.client
                  ? `${item.client.prenom ?? ''} ${item.client.name ?? ''}`.trim() ||
                    item.client.nom_complet ||
                    'Client'
                  : `Demande #${item.id}`;
                const prop = item.propriete;
                const st = getStatusDisplay(item.status);

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.card,
                      { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                    ]}>
                    <View style={styles.cardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.refText, { color: theme.gold }]}>
                          VIS-{String(item.id).padStart(5, '0')}
                        </Text>
                        <Text style={[styles.clientName, { color: theme.text }]}>{clientName}</Text>
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

                      <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: st.text }}>
                          {st.label}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.infoStrip, { backgroundColor: theme.backgroundElement }]}>
                      <Text style={[styles.infoText, { color: theme.text }]}>
                        📅 {new Date(item.scheduled_date).toLocaleString('fr-FR')}
                      </Text>
                      <Text style={[styles.infoText, { color: theme.primary }]}>
                        {item.is_fee_paid ? '✅ Frais 500 F acquittés' : '⏳ Paiement requis'}
                      </Text>
                    </View>

                    {prop && (
                      <Pressable
                        onPress={() => router.push(`/property/${prop.id}` as any)}
                        style={[styles.propBox, { borderColor: theme.cardBorder }]}>
                        <Text style={[styles.propTitle, { color: theme.text }]}>
                          {prop.type.toUpperCase()} — {prop.commune}{' '}
                          {prop.quartier ? `(${prop.quartier})` : ''}
                        </Text>
                        <Text style={[styles.propPrice, { color: theme.primary }]}>
                          {formatFcfa(prop.prix)}
                        </Text>
                      </Pressable>
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
                        <Text style={styles.cancelBtnText}>Annuler la visite</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })
            )
          ) : inquiries.length === 0 ? (
            <View
              style={[
                styles.emptyBox,
                { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
              ]}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                Aucun rendez-vous ni contact enregistré
              </Text>
              <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
                Depuis la fiche de n'importe quel bien, cliquez sur « Demander une visite », « Prendre
                RDV » ou « Contacter ».
              </Text>
            </View>
          ) : (
            inquiries.map((inq) => {
              const st = getStatusDisplay(inq.status);
              return (
                <View
                  key={`inq-${inq.id}`}
                  style={[
                    styles.card,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.refText, { color: theme.primary }]}>
                        {getInquiryTypeLabel(inq.type).toUpperCase()}
                      </Text>
                      <Text style={[styles.clientName, { color: theme.text }]}>
                        {inq.sujet || inq.commune || 'Demande E-Mobilier'}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: st.text }}>
                        {st.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                    👤 {inq.prenom} {inq.nom} • 📞 {inq.telephone} • ✉️ {inq.email}
                  </Text>

                  {inq.scheduled_date ? (
                    <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '700' }}>
                      📅 {new Date(inq.scheduled_date).toLocaleString('fr-FR')}
                    </Text>
                  ) : null}

                  {inq.message ? (
                    <Text style={[styles.instructions, { color: theme.text }]}>{inq.message}</Text>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingTop: Spacing.two },
  innerWrap: { width: '100%', maxWidth: 860, alignSelf: 'center', gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pageTitle: { fontSize: 22, fontWeight: '900' },
  pageSub: { fontSize: 13, marginTop: 2 },
  adminBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  adminBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  sectionSwitch: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  sectionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabsRow: { gap: 8, paddingVertical: 2 },
  tabChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
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
  propPrice: { fontSize: 13, fontWeight: '800' },
  instructions: { fontSize: 13, lineHeight: 19 },
  cancelBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  cancelBtnText: { color: '#DC2626', fontWeight: '700', fontSize: 13 },
  emptyBox: {
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    gap: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptyDesc: { fontSize: 13, textAlign: 'center', maxWidth: 420 },
  authGate: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.five, gap: 12 },
  gateTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  gateDesc: { fontSize: 14, textAlign: 'center', maxWidth: 420 },
  primaryBtn: { borderRadius: 14, paddingHorizontal: 22, paddingVertical: 13 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
