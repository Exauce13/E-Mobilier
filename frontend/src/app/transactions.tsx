import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReceiptModal } from '@/components/receipt-modal';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { usePlatformConfig } from '@/context/platform-config-context';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { paiementsApi } from '@/services/api';
import { paymentHistoryStorage, StoredPaymentRef } from '@/services/payment-history';
import { formatFcfa } from '@/types/property';

export default function TransactionsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { horizontalPadding } = useResponsive();
  const { isAuthenticated, openAuthModal } = useAuth();
  const { config, tarifs, loading: configLoading, error: configError, refresh: refreshConfig } =
    usePlatformConfig();

  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState<{
    post_client: number;
    post_agent: number;
    unlock_details: number;
    visit_fee?: number;
    current_user_post_fee: number;
  } | null>(null);
  const [history, setHistory] = useState<StoredPaymentRef[]>([]);
  const [lookupRef, setLookupRef] = useState('');
  const [activeReceiptRef, setActiveReceiptRef] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const refs = await paymentHistoryStorage.list();
      setHistory(refs);
      if (isAuthenticated) {
        const cfg = await paiementsApi.getKkiapayConfig();
        if (cfg.success && cfg.data?.pricing) {
          setPricing(cfg.data.pricing);
        }
      }
      setLoading(false);
    };
    void load();
  }, [isAuthenticated]);

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Paiements & Quittances" subtitle="Passerelle Kkiapay certifiée" />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + 28 },
        ]}>
        <View style={styles.innerWrap}>
          {loading || configLoading ? (
            <ActivityIndicator size="large" color={theme.primary} />
          ) : configError && !pricing && !tarifs ? (
            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Tarifs indisponibles
              </Text>
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
                • Déblocage coordonnées :{' '}
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
                Connectez-vous pour consulter vos quittances serveur
              </Text>
              <Pressable
                onPress={() => openAuthModal('login')}
                style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
                <Text style={styles.primaryBtnText}>Se connecter</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Rechercher une quittance</Text>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement },
                ]}
                placeholder="Référence (ex: PAY-20261114-XXXX)"
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
          )}

          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Transactions récentes sur cet appareil
            </Text>
            {history.length === 0 ? (
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                Aucune transaction initiée depuis cet appareil pour le moment.
              </Text>
            ) : (
              history.map((item) => (
                <Pressable
                  key={item.reference}
                  onPress={() => setActiveReceiptRef(item.reference)}
                  style={[styles.historyRow, { borderBottomColor: theme.cardBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>
                      {item.label}
                    </Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{item.reference}</Text>
                  </View>
                  <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 13 }}>
                    {formatFcfa(item.amount)}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
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
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
});
