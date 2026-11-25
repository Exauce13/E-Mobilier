import { router } from 'expo-router';
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  Mail,
  MapPin,
  Phone,
  User,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { usePlatformConfig } from '@/context/platform-config-context';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { inquiriesApi, visitesApi } from '@/services/api';
import type { PropertyInquiryItem, VisiteBackendItem } from '@/types/api';
import { formatFcfa } from '@/types/property';
import { confirmDialog, showMessage } from '@/utils/dialog';
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
  const { tarifs } = usePlatformConfig();
  const visitFeeLabel = tarifs ? formatFcfa(tarifs.visite) : '...';

  const [section, setSection] = useState<'visites' | 'rdv'>('visites');
  const [statusFilter, setStatusFilter] = useState<string>('tous');
  const [visits, setVisits] = useState<VisiteBackendItem[]>([]);
  const [inquiries, setInquiries] = useState<PropertyInquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadVisits = useCallback(async () => {
    setLoadError(null);
    if (!isAuthenticated) {
      setVisits([]);
      setInquiries([]);
      return;
    }

    const [visRes, inqRes] = await Promise.all([
      visitesApi.getMyVisits(statusFilter === 'tous' ? undefined : statusFilter),
      inquiriesApi.getMyInquiries({ page: 1 }),
    ]);

    if (visRes.success && visRes.data) {
      setVisits(visRes.data.data || []);
    } else {
      setLoadError(visRes.message || 'Impossible de charger vos visites.');
    }
    if (inqRes.success && inqRes.data?.data) {
      setInquiries(inqRes.data.data);
    } else {
      setInquiries([]);
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

  const handleCancel = async (visitId: number) => {
    const ok = await confirmDialog(
      'Annuler cette visite ?',
      'Cette action marquera la demande de visite comme annulée.',
      'Oui, annuler',
      'Non'
    );
    if (!ok) return;
    const res = await visitesApi.cancelVisit(visitId);
    if (res.success) {
      await loadVisits();
    } else {
      showMessage('Erreur', res.message || "Impossible d'annuler.");
    }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.authGate}>
          <Text style={[styles.gateTitle, { color: theme.text }]}>Mes Visites Physiques</Text>
          <Text style={[styles.gateDesc, { color: theme.textSecondary }]}>
            {tarifs
              ? `Connectez-vous pour consulter vos visites physiques encadrées (${formatFcfa(tarifs.visite)}) et leur suivi terrain.`
              : 'Connectez-vous pour consulter vos visites physiques encadrées E-Mobilier.'}
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
              <Text style={[styles.pageTitle, { color: theme.text }]}>Mes Visites Physiques</Text>
              <Text style={[styles.pageSub, { color: theme.textSecondary }]}>
                {isAdminStaff
                  ? 'Vos demandes personnelles — ouvrez le Back-Office pour gérer toutes les visites'
                  : isAgentMobilier
                  ? 'Vos visites demandées — consultez le Tableau Agent pour les visites reçues sur vos biens'
                  : 'Suivi de vos visites physiques encadrées par E-Mobilier'}
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

          {loadError ? (
            <View
              style={[
                styles.emptyBox,
                { backgroundColor: '#FEF2F2', borderColor: '#FECACA', paddingVertical: 14 },
              ]}>
              <Text style={{ color: '#B91C1C', fontWeight: '700', fontSize: 13 }}>{loadError}</Text>
              <Pressable
                onPress={() => void handleRefresh()}
                style={[styles.adminBtn, { backgroundColor: '#B91C1C' }]}>
                <Text style={styles.adminBtnText}>Réessayer</Text>
              </Pressable>
            </View>
          ) : null}

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
                Visites physiques ({visits.length})
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
                Historique demandes ({inquiries.length})
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
                          <View style={styles.inlineIconRow}>
                            <Phone size={13} color={theme.textSecondary} strokeWidth={2} />
                            <Text style={[styles.phoneText, { color: theme.textSecondary, marginTop: 0 }]}>
                              {item.client.telephone}
                            </Text>
                          </View>
                        ) : isAgentMobilier && !isAdminStaff ? (
                          <View style={styles.inlineIconRow}>
                            <Lock size={13} color={theme.textSecondary} strokeWidth={2} />
                            <Text style={[styles.maskedNote, { color: theme.textSecondary, marginTop: 0 }]}>
                              Coordonnées protégées (gestion E-Mobilier)
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: st.text }}>
                          {st.label}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.infoStrip, { backgroundColor: theme.backgroundElement }]}>
                      <View style={styles.inlineIconRow}>
                        <Calendar size={14} color={theme.text} strokeWidth={2} />
                        <Text style={[styles.infoText, { color: theme.text }]}>
                          {new Date(item.scheduled_date).toLocaleString('fr-FR')}
                        </Text>
                      </View>
                      <View style={styles.inlineIconRow}>
                        {item.is_fee_paid ? (
                          <CheckCircle2 size={14} color="#059669" strokeWidth={2.2} />
                        ) : (
                          <Clock size={14} color={theme.gold} strokeWidth={2.2} />
                        )}
                        <Text style={[styles.infoText, { color: theme.primary }]}>
                          {item.is_fee_paid ? `Frais ${visitFeeLabel} acquittés` : 'Paiement requis'}
                        </Text>
                      </View>
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
                      <View style={styles.inlineIconRowStart}>
                        <MapPin size={14} color={theme.primary} strokeWidth={2} style={{ marginTop: 2 }} />
                        <Text style={[styles.instructions, { color: theme.textSecondary, flex: 1 }]}>
                          Consignes : {item.instructions_itineraire}
                        </Text>
                      </View>
                    ) : null}

                    {item.compte_rendu ? (
                      <View style={styles.inlineIconRowStart}>
                        <FileText size={14} color={theme.text} strokeWidth={2} style={{ marginTop: 2 }} />
                        <Text style={[styles.instructions, { color: theme.text, flex: 1 }]}>
                          Compte-rendu : {item.compte_rendu}
                        </Text>
                      </View>
                    ) : null}

                    {(item.status === 'pending' || item.status === 'confirmed') && (
                      <Pressable
                        onPress={() => void handleCancel(item.id)}
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
                Pour visiter un bien, ouvrez sa fiche détaillée et réservez une visite physique encadrée
                par E-Mobilier.
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

                  <View style={styles.metaWrapRow}>
                    <View style={styles.inlineIconRow}>
                      <User size={13} color={theme.textSecondary} strokeWidth={2} />
                      <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                        {inq.prenom} {inq.nom}
                      </Text>
                    </View>
                    <View style={styles.inlineIconRow}>
                      <Phone size={13} color={theme.textSecondary} strokeWidth={2} />
                      <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{inq.telephone}</Text>
                    </View>
                    <View style={styles.inlineIconRow}>
                      <Mail size={13} color={theme.textSecondary} strokeWidth={2} />
                      <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{inq.email}</Text>
                    </View>
                  </View>

                  {inq.scheduled_date ? (
                    <View style={styles.inlineIconRow}>
                      <Calendar size={14} color={theme.primary} strokeWidth={2.2} />
                      <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '700' }}>
                        {new Date(inq.scheduled_date).toLocaleString('fr-FR')}
                      </Text>
                    </View>
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
  inlineIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inlineIconRowStart: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  metaWrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
});
