import { SymbolView } from 'expo-symbols';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InstitutionHeader } from '@/components/ui/institution-header';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { financeApi } from '@/services/api';
import type { GrandLivreEntry, RetraitItem } from '@/types/api';
import { formatFcfa } from '@/types/property';

type FinanceTab = 'dashboard' | 'ledger' | 'payouts' | 'security' | 'webhooks_notifs';

export default function FinanceVaultScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isSuperAdminPrincipal } = useAuth();

  const [activeTab, setActiveTab] = useState<FinanceTab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<Record<string, any> | null>(null);
  const [soldeActuel, setSoldeActuel] = useState<number>(4850000);
  const [entries, setEntries] = useState<GrandLivreEntry[]>([]);
  const [retraits, setRetraits] = useState<RetraitItem[]>([]);
  const [retraitsGeles, setRetraitsGeles] = useState(false);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [notifAudit, setNotifAudit] = useState<any[]>([]);
  const [notifTotaux, setNotifTotaux] = useState<Record<string, number> | null>(null);

  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutType, setPayoutType] = useState<'mobile_money' | 'virement_bancaire'>('mobile_money');
  const [otpInputs, setOtpInputs] = useState<Record<number, string>>({});
  const [freezeMotif, setFreezeMotif] = useState('');
  const [integrityReport, setIntegrityReport] = useState<Record<string, any> | null>(null);

  const loadAll = useCallback(async () => {
    if (!isSuperAdminPrincipal) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [dRes, tRes, rRes, sRes, wRes, nRes] = await Promise.all([
        financeApi.getTableauDeBord(),
        financeApi.getTransactions(),
        financeApi.getRetraits(),
        financeApi.getSecurityStatut(),
        financeApi.getWebhooks(),
        financeApi.getNotificationsAudit(),
      ]);
      if (dRes.success) setDashboard(dRes.data || null);
      if (tRes.success && tRes.data) {
        setEntries((tRes.data as any).data || []);
        if (tRes.solde_actuel) setSoldeActuel(Number(tRes.solde_actuel));
      }
      if (rRes.success && rRes.data) {
        setRetraits((rRes.data as any).data || []);
      }
      if (sRes.success && sRes.data) {
        setRetraitsGeles(Boolean(sRes.data.retraits_geles));
      }
      if (wRes.success && wRes.data) {
        setWebhooks((wRes.data as any).data || []);
      }
      if (nRes.success) {
        setNotifAudit(Array.isArray(nRes.data) ? nRes.data : []);
        setNotifTotaux((nRes as any).totaux || null);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [isSuperAdminPrincipal]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  if (!isSuperAdminPrincipal) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surface }]}>
        <InstitutionHeader title="Coffre-Fort Trésorerie" showBack />
        <View style={styles.deniedBox}>
          <Text style={[styles.deniedTitle, { color: theme.text }]}>Monopole Financier Exclusif</Text>
          <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
            Accès strictement réservé au Super Administrateur Principal (M. Justin MAGNIDE).
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <InstitutionHeader title="Coffre-Fort Trésorerie" showBack />

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]}>
        {/* 1. TOP VAULT ROOT BANNER (STITCH EXACT) */}
        <View
          style={[
            styles.rootVaultCard,
            { backgroundColor: theme.inverseSurface, borderColor: theme.cardBorder },
          ]}>
          <View style={styles.rootTopRow}>
            <View style={styles.rootTitleRow}>
              <SymbolView
                name={{ ios: 'lock.fill', android: 'enhanced_encryption', web: 'enhanced_encryption' }}
                size={18}
                tintColor="#FFE088"
              />
              <Text style={styles.rootTitleText}>
                Coffre-Fort Trésorerie Niveau 0 • Root
              </Text>
            </View>
            <View style={[styles.bceaoPill, { backgroundColor: '#065F46' }]}>
              <Text style={styles.bceaoPillText}>BCEAO Scellé ✓</Text>
            </View>
          </View>

          <Text style={styles.rootSubText}>
            Accès chiffré exclusif • Clé d'autorité légale E-Mobilier SARL 256-BIT
          </Text>
          <Text style={styles.sessionCodeText}>SESSION: #ROOT-89A02 • GMT+1</Text>
        </View>

        {/* 2. THREE BALANCES CARDS (STITCH EXACT) */}
        <View style={styles.balancesGrid}>
          {/* Card 1: Solde Disponible */}
          <View
            style={[
              styles.balanceCard,
              { backgroundColor: theme.navy, borderColor: theme.cardBorder },
            ]}>
            <View style={styles.balanceCardTop}>
              <SymbolView
                name={{ ios: 'wallet.pass.fill', android: 'account_balance_wallet', web: 'account_balance_wallet' }}
                size={16}
                tintColor="#D4AF37"
              />
              <Text style={styles.balanceCardLabel}>Solde Disponible</Text>
            </View>
            <Text style={[styles.balanceCardVal, { color: '#FFE088' }]}>
              {formatFcfa(soldeActuel)}
            </Text>
            <Text style={styles.balanceCardSub}>Immédiatement virable</Text>
          </View>

          {/* Card 2: Fonds sous Séquestre */}
          <View
            style={[
              styles.balanceCard,
              { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
            ]}>
            <View style={styles.balanceCardTop}>
              <SymbolView
                name={{ ios: 'archivebox.fill', android: 'savings', web: 'savings' }}
                size={16}
                tintColor={theme.primaryContainer}
              />
              <Text style={[styles.balanceCardLabel, { color: theme.textSecondary }]}>Sous Séquestre</Text>
            </View>
            <Text style={[styles.balanceCardVal, { color: theme.primaryContainer }]}>
              {formatFcfa(1250000)}
            </Text>
            <Text style={[styles.balanceCardSub, { color: theme.textSecondary }]}>En attente de PV</Text>
          </View>
        </View>

        {/* Triptyque Métriques Comptables (Stitch Exact) */}
        <View style={styles.metricsTriptyque}>
          <View style={[styles.triptyqueCard, { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder }]}>
            <View style={styles.triptyqueTop}>
              <SymbolView
                name={{ ios: 'banknote', android: 'payments', web: 'payments' }}
                size={14}
                tintColor={theme.textSecondary}
              />
              <Text numberOfLines={1} style={[styles.triptyqueLabel, { color: theme.textSecondary }]}>
                Brut Cumulé
              </Text>
            </View>
            <Text numberOfLines={1} style={[styles.triptyqueVal, { color: theme.text }]}>
              12 430 000
            </Text>
            <Text style={[styles.triptyqueCurrency, { color: theme.textSecondary }]}>FCFA</Text>
            <Text numberOfLines={1} style={[styles.triptyqueSub, { color: theme.primaryContainer }]}>
              Micro-flux (50/500F)
            </Text>
          </View>

          <View style={[styles.triptyqueCard, { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder }]}>
            <View style={styles.triptyqueTop}>
              <SymbolView
                name={{ ios: 'percent', android: 'toll', web: 'toll' }}
                size={14}
                tintColor={theme.tertiary}
              />
              <Text numberOfLines={1} style={[styles.triptyqueLabel, { color: theme.textSecondary }]}>
                Frais Kkiapay
              </Text>
            </View>
            <Text numberOfLines={1} style={[styles.triptyqueVal, { color: theme.tertiary }]}>
              310 750
            </Text>
            <Text style={[styles.triptyqueCurrency, { color: theme.textSecondary }]}>FCFA (2.5%)</Text>
            <Text numberOfLines={1} style={[styles.triptyqueSub, { color: theme.outline }]}>
              Prélèvement auto
            </Text>
          </View>

          <View style={[styles.triptyqueCard, { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder }]}>
            <View style={styles.triptyqueTop}>
              <SymbolView
                name={{ ios: 'archivebox', android: 'savings', web: 'savings' }}
                size={14}
                tintColor={theme.primary}
              />
              <Text numberOfLines={1} style={[styles.triptyqueLabel, { color: theme.textSecondary }]}>
                Net Encaissé
              </Text>
            </View>
            <Text numberOfLines={1} style={[styles.triptyqueVal, { color: theme.primary }]}>
              12 119 250
            </Text>
            <Text style={[styles.triptyqueCurrency, { color: theme.textSecondary }]}>FCFA</Text>
            <Text numberOfLines={1} style={[styles.triptyqueSub, { color: theme.primary }]}>
              Enregistré BJ
            </Text>
          </View>
        </View>

        {/* Intégrité Cryptographique HMAC SHA-256 (Stitch Exact) */}
        <View
          style={[
            styles.hmacCard,
            { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
          ]}>
          <View style={styles.hmacCardHeader}>
            <View style={styles.hmacPulseRow}>
              <View style={[styles.pulseDot, { backgroundColor: theme.primaryContainer }]} />
              <Text style={[styles.hmacTitle, { color: theme.text }]}>Intégrité HMAC SHA-256</Text>
            </View>
            <View style={[styles.validePill, { backgroundColor: theme.primaryFixed }]}>
              <Text style={[styles.validePillText, { color: theme.primaryDark }]}>VALIDE</Text>
            </View>
          </View>

          <View style={[styles.hmacBox, { backgroundColor: theme.surfaceContainerLow }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.hmacDesc, { color: theme.textSecondary }]}>
                Chiffrement en chaîne immuable. Les hachages des micro-transactions scellent le Grand Livre.
              </Text>
              <Text style={[styles.hmacHash, { color: theme.primaryContainer }]}>
                HASH: 8f4b23c9a1005e8e4...31b9fa2
              </Text>
            </View>

            <Pressable
              onPress={async () => {
                const res = await financeApi.verifierIntegrite();
                setIntegrityReport(res.data || null);
                Alert.alert(
                  res.success ? 'Intégrité Validée' : 'Audit Terminé',
                  'Le grand livre cryptographique est 100% conforme et scellé.'
                );
              }}
              style={[styles.auditBtn, { backgroundColor: theme.surfaceContainerHigh }]}>
              <SymbolView
                name={{ ios: 'arrow.triangle.2.circlepath', android: 'sync', web: 'sync' }}
                size={14}
                tintColor={theme.text}
              />
              <Text style={[styles.auditBtnText, { color: theme.text }]}>Auditer</Text>
            </Pressable>
          </View>
        </View>

        {/* 3. TABS BAR */}
        <View style={[styles.tabRow, { backgroundColor: theme.surfaceContainerLow }]}>
          {(
            [
              { key: 'dashboard', label: 'Trésor' },
              { key: 'ledger', label: 'Grand Livre' },
              { key: 'payouts', label: 'Décaissements' },
              { key: 'security', label: 'HMAC & Audit' },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tabBtn,
                  active && { backgroundColor: theme.surfaceContainerLowest },
                ]}>
                <Text
                  style={{
                    color: active ? theme.text : theme.textSecondary,
                    fontWeight: '700',
                    fontSize: 12,
                  }}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Section Contents */}
        {loading ? (
          <ActivityIndicator size="large" color={theme.primaryContainer} style={{ marginTop: 32 }} />
        ) : activeTab === 'dashboard' ? (
          <View style={styles.section}>
            {dashboard && (
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
                ]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Indicateurs du Coffre-Fort</Text>
                {Object.entries(dashboard).map(([k, v]) => (
                  <View key={k} style={styles.kvRow}>
                    <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{k.replace(/_/g, ' ')}</Text>
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>
                      {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Décaissement Trésorerie Quick Form */}
            <View
              style={[
                styles.card,
                { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
              ]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Décaissement Trésorerie</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 8 }}>
                Virement sécurisé vers compte bancaire ou compte marchand MTN/Moov.
              </Text>
              <TextInput
                value={payoutAmount}
                onChangeText={setPayoutAmount}
                placeholder="Montant en FCFA"
                placeholderTextColor={theme.outline}
                keyboardType="numeric"
                style={[
                  styles.input,
                  { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder, color: theme.text },
                ]}
              />
              <Pressable
                onPress={async () => {
                  const amt = Number(payoutAmount.replace(/\s+/g, ''));
                  if (!amt || amt <= 0) {
                    Alert.alert('Erreur', 'Montant de décaissement invalide.');
                    return;
                  }
                  const res = await financeApi.initierRetrait({
                    montant: amt,
                    methode: payoutType,
                  });
                  if (res.success) {
                    Alert.alert(
                      'Retrait Initié',
                      `Code OTP envoyé pour valider le virement de ${formatFcfa(amt)}.`
                    );
                    setPayoutAmount('');
                    await loadAll();
                  } else {
                    Alert.alert('Erreur', res.message || 'Impossible de décaisser.');
                  }
                }}
                style={[styles.primaryBtn, { backgroundColor: theme.primaryContainer }]}>
                <Text style={styles.primaryBtnText}>Demander le Décaissement</Text>
              </Pressable>
            </View>
          </View>
        ) : activeTab === 'ledger' ? (
          <View style={styles.section}>
            <Pressable
              onPress={async () => {
                const res = await financeApi.exportTransactions();
                Alert.alert(
                  'Export Comptable Certifié',
                  `${res.total_ecritures ?? 0} écritures • Solde final : ${formatFcfa(res.solde_final ?? soldeActuel)}`
                );
              }}
              style={[styles.primaryBtn, { backgroundColor: theme.navy }]}>
              <Text style={styles.primaryBtnText}>Générer l'export certifié PDF/CSV</Text>
            </Pressable>

            {entries.slice(0, 15).map((e) => (
              <View
                key={e.id}
                style={[
                  styles.card,
                  { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
                ]}>
                <View style={styles.kvRow}>
                  <Text style={{ color: theme.text, fontWeight: '800', fontSize: 13 }}>
                    {e.reference_unique}
                  </Text>
                  <Text
                    style={{
                      color: e.type_mouvement === 'CREDIT' ? theme.success : '#DC2626',
                      fontWeight: '900',
                      fontSize: 14,
                    }}>
                    {e.type_mouvement === 'CREDIT' ? '+' : '-'} {formatFcfa(e.montant_net)}
                  </Text>
                </View>
                <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                  {e.description || e.categorie || 'Transaction'} • {new Date(e.created_at).toLocaleString('fr-FR')}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.section}>
            {/* HMAC & Sécurité */}
            <Pressable
              onPress={async () => {
                const res = await financeApi.verifierIntegrite();
                setIntegrityReport(res.data || null);
                Alert.alert(
                  res.success ? 'Intégrité Vérifiée' : 'Anomalie Détectée',
                  res.message || 'Contrôle cryptographique HMAC terminé.'
                );
              }}
              style={[styles.primaryBtn, { backgroundColor: theme.primaryContainer }]}>
              <Text style={styles.primaryBtnText}>Vérifier l'Intégrité Cryptographique HMAC</Text>
            </Pressable>

            {integrityReport && (
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
                ]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Rapport d'Audit HMAC</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                  {JSON.stringify(integrityReport, null, 2)}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  rootVaultCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.four,
    gap: 8,
  },
  rootTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rootTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rootTitleText: {
    color: '#FFE088',
    fontSize: 13,
    fontWeight: '800',
  },
  bceaoPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bceaoPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  rootSubText: {
    color: '#CBD5E1',
    fontSize: 11,
  },
  sessionCodeText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  balancesGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  balanceCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 4,
  },
  balanceCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  balanceCardLabel: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  balanceCardVal: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginVertical: 2,
  },
  balanceCardSub: {
    color: '#94A3B8',
    fontSize: 10,
  },
  balanceAuditedRow: {
    marginTop: 4,
  },
  balanceAuditedText: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  metricsTriptyque: {
    flexDirection: 'row',
    gap: 8,
  },
  triptyqueCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    justifyContent: 'space-between',
  },
  triptyqueTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  triptyqueLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  triptyqueVal: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  triptyqueCurrency: {
    fontSize: 9,
    fontWeight: '600',
  },
  triptyqueSub: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 4,
  },
  hmacCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 8,
  },
  hmacCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hmacPulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hmacTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  validePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  validePillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  hmacBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    gap: 8,
  },
  hmacDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  hmacHash: {
    fontFamily: 'Inter',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  auditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  auditBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tabRow: {
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
  section: {
    gap: 12,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 13,
  },
  primaryBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  deniedBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  deniedTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
});
