import { router } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReceiptModal } from '@/components/receipt-modal';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { usePlatformConfig } from '@/context/platform-config-context';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { paiementsApi } from '@/services/api';
import type { PaymentStatusItem } from '@/types/api';
import { formatFcfa } from '@/types/property';
import { showMessage } from '@/utils/dialog';

function getPaymentBadge(status: string) {
  switch (status) {
    case 'successful':
    case 'success':
      return { label: 'Confirmé', bg: '#DCFCE7', text: '#166534' };
    case 'pending':
      return { label: 'En attente', bg: '#FEF3C7', text: '#92400E' };
    case 'failed':
      return { label: 'Échoué', bg: '#FEE2E2', text: '#991B1B' };
    case 'cancelled':
      return { label: 'Annulé', bg: '#F1F5F9', text: '#475569' };
    case 'expired':
      return { label: 'Expiré', bg: '#F3E8FF', text: '#6B21A8' };
    default:
      return { label: status, bg: '#E2E8F0', text: '#334155' };
  }
}

function getPaymentTypeLabel(type: string) {
  switch (type) {
    case 'owner_post_submission':
      return 'Publication annonce (Client)';
    case 'agent_post':
      return 'Publication annonce (Agent)';
    case 'view_details':
      return 'Déblocage fiche bien';
    case 'visit_fee':
      return 'Visite physique encadrée';
    default:
      return type;
  }
}

export default function TransactionsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { horizontalPadding } = useResponsive();
  const { isAuthenticated, isAgentMobilier, isAdminStaff, openAuthModal } = useAuth();
  const isAgentBlocked = isAuthenticated && isAgentMobilier && !isAdminStaff;
  const { config, tarifs, loading: configLoading, error: configError, refresh: refreshConfig } =
    usePlatformConfig();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pricing, setPricing] = useState<{
    post_client: number;
    post_agent: number;
    unlock_details: number;
    visit_fee?: number;
    current_user_post_fee: number;
  } | null>(null);
  const [payments, setPayments] = useState<PaymentStatusItem[]>([]);
  const [checkingRef, setCheckingRef] = useState<string | null>(null);
  const [lookupRef, setLookupRef] = useState('');
  const [activeReceiptRef, setActiveReceiptRef] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setPayments([]);
      setPricing(null);
      return;
    }

    const [cfgRes, payRes] = await Promise.all([
      paiementsApi.getKkiapayConfig(),
      paiementsApi.getMyPayments({ page: 1, per_page: 30 }),
    ]);

    if (cfgRes.success && cfgRes.data?.pricing) {
      setPricing(cfgRes.data.pricing);
    }
    if (payRes.success && payRes.data?.data) {
      setPayments(payRes.data.data);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const handleRefreshSingleStatus = async (ref: string) => {
    setCheckingRef(ref);
    try {
      const res = await paiementsApi.getStatut(ref);
      if (res.success && res.data) {
        const st = getPaymentBadge(res.data.normalized_status || res.data.status);
        showMessage('Statut actualisé', `Référence ${ref} : ${st.label}.`);
        await load();
      } else {
        showMessage('Information', res.message || 'Impossible de vérifier le statut pour le moment.');
      }
    } finally {
      setCheckingRef(null);
    }
  };

  if (isAgentBlocked) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
        <ScreenHeader title="Espace Agent" subtitle="Section non disponible" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 }}>
          <Text style={[styles.sectionTitle, { color: theme.text, textAlign: 'center' }]}>
            Cette page n'est pas incluse dans l'interface Agent
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center', maxWidth: 420 }}>
            Retrouvez vos biens immobiliers, vos visites et votre profil directement dans votre Espace Agent.
          </Text>
          <Pressable
            onPress={() => router.replace('/agent-space' as any)}
            style={[styles.primaryBtn, { backgroundColor: theme.primary, paddingHorizontal: 22 }]}>
            <Text style={styles.primaryBtnText}>Ouvrir mon Espace Agent</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Paiements & Quittances" subtitle="Suivi serveur Kkiapay en temps réel" />

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={theme.primary}
          />
        }
        contentContainerStyle={[
          styles.scroll,
          { paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + 28 },
        ]}>
        <View style={styles.innerWrap}>
          {loading || configLoading ? (
            <ActivityIndicator size="large" color={theme.primary} />
          ) : configError && !pricing && !tarifs ? (
            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Tarifs indisponibles</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{configError}</Text>
              <Pressable
                onPress={() => void refreshConfig()}
                style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
                <Text style={styles.primaryBtnText}>Réessayer</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: theme.navy }]}>
              <Text style={styles.tariffsTitle}>
                Tarifs Officiels {config?.platform_name || 'E-Mobilier'}
              </Text>
              <Text style={styles.tariffLine}>
                • Déblocage fiche bien :{' '}
                {pricing?.unlock_details !== undefined
                  ? formatFcfa(pricing.unlock_details)
                  : tarifs
                  ? formatFcfa(tarifs.deblocage_coordonnees)
                  : '—'}
              </Text>
              <Text style={styles.tariffLine}>
                • Visite physique encadrée :{' '}
                {pricing?.visit_fee !== undefined
                  ? formatFcfa(pricing.visit_fee)
                  : tarifs
                  ? formatFcfa(tarifs.visite)
                  : '—'}
              </Text>
              <Text style={styles.tariffLine}>
                • Publication Client :{' '}
                {pricing?.post_client !== undefined
                  ? formatFcfa(pricing.post_client)
                  : tarifs
                  ? formatFcfa(tarifs.post_client)
                  : '—'}
              </Text>
              <Text style={styles.tariffLine}>
                • Publication Agent mobilier :{' '}
                {pricing?.post_agent !== undefined
                  ? formatFcfa(pricing.post_agent)
                  : tarifs
                  ? formatFcfa(tarifs.post_agent)
                  : '—'}
              </Text>
              {pricing ? (
                <Text style={[styles.tariffHighlight, { color: '#FDE68A' }]}>
                  Votre tarif publication actif : {formatFcfa(pricing.current_user_post_fee)}
                </Text>
              ) : null}
            </View>
          )}

          {!isAuthenticated ? (
            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Connectez-vous pour consulter vos paiements et quittances serveur
              </Text>
              <Pressable
                onPress={() => openAuthModal('login')}
                style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
                <Text style={styles.primaryBtnText}>Se connecter</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Real Server Payment History */}
              <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Mes paiements enregistrés ({payments.length})
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                  En cas de fermeture accidentelle du navigateur pendant un paiement, actualisez son statut ici sans rien ressaisir.
                </Text>

                {payments.length === 0 ? (
                  <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                    Aucun paiement enregistré sur votre compte pour le moment.
                  </Text>
                ) : (
                  payments.map((item) => {
                    const badge = getPaymentBadge(item.normalized_status || item.status);
                    const isConfirmed = item.status === 'successful' || item.normalized_status === 'success';
                    const isPending = item.status === 'pending';

                    return (
                      <View
                        key={item.id}
                        style={[styles.historyRow, { borderBottomColor: theme.cardBorder }]}>
                        <View style={{ flex: 1, gap: 3 }}>
                          <View style={styles.rowTop}>
                            <Text style={{ color: theme.text, fontWeight: '800', fontSize: 13 }}>
                              {getPaymentTypeLabel(item.payment_type)}
                            </Text>
                            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                              <Text style={{ color: badge.text, fontSize: 11, fontWeight: '800' }}>
                                {badge.label}
                              </Text>
                            </View>
                          </View>
                          <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                            Réf. interne : {item.reference}
                          </Text>
                          {item.gateway_transaction_id ? (
                            <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                              Réf. Kkiapay : {item.gateway_transaction_id}
                            </Text>
                          ) : null}
                          {item.created_at ? (
                            <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                              {new Date(item.created_at).toLocaleString('fr-FR')}
                            </Text>
                          ) : null}
                          {item.failure_reason ? (
                            <Text style={{ color: '#B91C1C', fontSize: 11 }}>{item.failure_reason}</Text>
                          ) : null}
                        </View>

                        <View style={{ alignItems: 'flex-end', gap: 6 }}>
                          <Text style={{ color: theme.primary, fontWeight: '900', fontSize: 14 }}>
                            {formatFcfa(item.amount)}
                          </Text>
                          {isConfirmed ? (
                            <Pressable
                              onPress={() => setActiveReceiptRef(item.reference)}
                              style={[styles.miniBtn, { backgroundColor: theme.primaryLight }]}>
                              <Text style={{ color: theme.primaryDark, fontSize: 11, fontWeight: '800' }}>
                                Quittance
                              </Text>
                            </Pressable>
                          ) : isPending ? (
                            <Pressable
                              onPress={() => void handleRefreshSingleStatus(item.reference)}
                              disabled={checkingRef === item.reference}
                              style={[styles.miniBtn, { backgroundColor: '#FEF3C7', flexDirection: 'row', gap: 4, alignItems: 'center' }]}>
                              <RefreshCw size={12} color="#92400E" strokeWidth={2.4} />
                              <Text style={{ color: '#92400E', fontSize: 11, fontWeight: '800' }}>
                                {checkingRef === item.reference ? '...' : 'Actualiser'}
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Lookup Receipt by Internal Reference */}
              <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Rechercher une quittance</Text>
                <TextInput
                  style={[
                    styles.input,
                    { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement },
                  ]}
                  placeholder="Référence interne (ex: PAY-20261126-XXXX)"
                  placeholderTextColor={theme.textSecondary}
                  value={lookupRef}
                  onChangeText={setLookupRef}
                  autoCapitalize="characters"
                />
                <Pressable
                  onPress={() => lookupRef.trim() && setActiveReceiptRef(lookupRef.trim())}
                  style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
                  <Text style={styles.primaryBtnText}>Afficher le reçu officiel</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <ReceiptModal
        visible={Boolean(activeReceiptRef)}
        reference={activeReceiptRef}
        onClose={() => setActiveReceiptRef(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingTop: Spacing.three },
  innerWrap: { width: '100%', maxWidth: 860, alignSelf: 'center', gap: Spacing.three },
  card: { borderRadius: 18, borderWidth: 1, padding: Spacing.three, gap: 10 },
  tariffsTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  tariffLine: { color: '#E2E8F0', fontSize: 13 },
  tariffHighlight: { fontSize: 14, fontWeight: '900', marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  input: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14 },
  primaryBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  historyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  miniBtn: { paddingHorizontal: 12, paddingVertical: 8, minHeight: 36, borderRadius: 8, justifyContent: 'center' },
});
