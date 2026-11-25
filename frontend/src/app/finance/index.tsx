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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SuperAdminPrincipalPortal } from '@/components/super-admin/super-admin-portal';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { financeApi } from '@/services/api';
import type { GrandLivreEntry, RetraitItem } from '@/types/api';
import { formatFcfa } from '@/types/property';

type FinanceTab = 'dashboard' | 'ledger' | 'payouts' | 'security' | 'webhooks_notifs';

export default function FinanceVaultScreen() {
  const { isFinancialOwner } = useAuth();

  if (isFinancialOwner) {
    return <SuperAdminPrincipalPortal initialPage="finance" />;
  }

  return <LegacyFinanceVaultScreen />;
}

function LegacyFinanceVaultScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isFinancialOwner: isSuperAdminPrincipal } = useAuth();

  const [activeTab, setActiveTab] = useState<FinanceTab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<Record<string, any> | null>(null);
  const [soldeActuel, setSoldeActuel] = useState<number>(0);
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
      setSoldeActuel(Number(tRes.solde_actuel ?? 0));
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
    setLoading(false);
  }, [isSuperAdminPrincipal]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  if (!isSuperAdminPrincipal) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <ScreenHeader title="Coffre-Fort Financier" />
        <View style={styles.deniedBox}>
          <Text style={[styles.deniedTitle, { color: theme.text }]}>Monopole Financier Exclusif</Text>
          <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
            Accès strictement réservé au Super Administrateur Principal (M. Justin MAGNIDE).
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Coffre-Fort Financier" subtitle="Grand Livre & Retraits OTP" />

      <View style={[styles.tabRow, { borderBottomColor: theme.cardBorder, backgroundColor: theme.cardBackground }]}>
        {(
          [
            { key: 'dashboard', label: 'Trésor' },
            { key: 'ledger', label: 'Livre' },
            { key: 'payouts', label: 'Retraits' },
            { key: 'security', label: 'HMAC' },
            { key: 'webhooks_notifs', label: 'Logs' },
          ] as const
        ).map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabBtn, { backgroundColor: active ? theme.navy : theme.backgroundElement }]}>
              <Text style={{ color: active ? theme.gold : theme.text, fontWeight: '800', fontSize: 12 }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 32 }} />
        ) : activeTab === 'dashboard' ? (
          <View style={styles.section}>
            <View style={[styles.vaultCard, { backgroundColor: theme.navy }]}>
              <Text style={{ color: '#CBD5E1', fontSize: 12, fontWeight: '700' }}>SOLDE DISPONIBLE</Text>
              <Text style={{ color: theme.gold, fontSize: 28, fontWeight: '900', marginVertical: 4 }}>
                {formatFcfa(soldeActuel)}
              </Text>
              <Text style={{ color: retraitsGeles ? '#FCA5A5' : '#6EE7B7', fontSize: 12, fontWeight: '700' }}>
                {retraitsGeles ? '🔒 Retraits actuellement GELÉS' : '✅ Retraits actifs'}
              </Text>
            </View>

            {dashboard && (
              <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
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
              <Text style={styles.primaryBtnText}>Générer l'export certifié</Text>
            </Pressable>

            {entries.map((e) => (
              <View key={e.id} style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <View style={styles.kvRow}>
                  <Text style={{ color: theme.text, fontWeight: '800', fontSize: 13 }}>{e.reference_unique}</Text>
                  <Text
                    style={{
                      color: e.type_mouvement === 'CREDIT' ? theme.primaryDark : '#DC2626',
                      fontWeight: '900',
                      fontSize: 14,
                    }}>
                    {e.type_mouvement === 'CREDIT' ? '+' : '-'} {formatFcfa(e.montant_net)}
                  </Text>
                </View>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                  {e.categorie} • Solde après : {formatFcfa(e.solde_apres)}
                </Text>
                <Text style={{ color: theme.text, fontSize: 12 }}>{e.description}</Text>
              </View>
            ))}
          </View>
        ) : activeTab === 'payouts' ? (
          <View style={styles.section}>
            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Initier un retrait officiel</Text>
              <View style={styles.row}>
                {(['mobile_money', 'virement_bancaire'] as const).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setPayoutType(t)}
                    style={[
                      styles.pill,
                      { backgroundColor: payoutType === t ? theme.primary : theme.backgroundElement },
                    ]}>
                    <Text style={{ color: payoutType === t ? '#FFF' : theme.text, fontWeight: '700', fontSize: 12 }}>
                      {t === 'mobile_money' ? 'Mobile Money' : 'Virement Bancaire'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.cardBorder }]}
                placeholder="Montant (min 1000 F CFA)"
                keyboardType="numeric"
                value={payoutAmount}
                onChangeText={setPayoutAmount}
              />
              <Pressable
                onPress={async () => {
                  const res = await financeApi.initierRetrait(Number(payoutAmount), payoutType);
                  Alert.alert(res.success ? 'OTP envoyé' : 'Erreur', res.message || '');
                  if (res.success) {
                    setPayoutAmount('');
                    await loadAll();
                  }
                }}
                style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
                <Text style={styles.primaryBtnText}>Initier retrait (envoi OTP)</Text>
              </Pressable>
            </View>

            {retraits.map((r) => (
              <View key={r.id} style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <View style={styles.kvRow}>
                  <Text style={{ color: theme.text, fontWeight: '800' }}>{r.reference_retrait}</Text>
                  <Text style={{ color: theme.primaryDark, fontWeight: '900' }}>{formatFcfa(r.montant)}</Text>
                </View>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                  {r.type_compte} • Statut : {r.statut.toUpperCase()}
                </Text>

                {r.statut === 'en_attente_otp' && (
                  <View style={{ gap: 8, marginTop: 4 }}>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.cardBorder }]}
                      placeholder="Code OTP à 6 chiffres"
                      keyboardType="numeric"
                      maxLength={6}
                      value={otpInputs[r.id] || ''}
                      onChangeText={(txt) => setOtpInputs((prev) => ({ ...prev, [r.id]: txt }))}
                    />
                    <View style={styles.row}>
                      <Pressable
                        onPress={async () => {
                          const res = await financeApi.confirmerOtpRetrait(r.id, otpInputs[r.id] || '');
                          Alert.alert(res.success ? 'Exécuté' : 'Erreur', res.message || '');
                          await loadAll();
                        }}
                        style={[styles.smallBtn, { backgroundColor: theme.primary, flex: 1 }]}>
                        <Text style={styles.smallBtnText}>Confirmer OTP</Text>
                      </Pressable>
                      <Pressable
                        onPress={async () => {
                          const res = await financeApi.annulerRetrait(r.id);
                          Alert.alert(res.success ? 'Annulé' : 'Erreur', res.message || '');
                          await loadAll();
                        }}
                        style={[styles.smallBtn, { backgroundColor: '#EF4444', flex: 1 }]}>
                        <Text style={styles.smallBtnText}>Annuler</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : activeTab === 'security' ? (
          <View style={styles.section}>
            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Vérification Cryptographique HMAC</Text>
              <Pressable
                onPress={async () => {
                  const res = await financeApi.verifierIntegrite();
                  setIntegrityReport(res.data || null);
                  Alert.alert(res.success ? 'Chaîne Intacte' : 'ALERTE', res.message || '');
                }}
                style={[styles.primaryBtn, { backgroundColor: theme.navy }]}>
                <Text style={styles.primaryBtnText}>Auditer la chaîne du Grand Livre</Text>
              </Pressable>
              {integrityReport && (
                <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 6 }}>
                  {JSON.stringify(integrityReport)}
                </Text>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Coupe-Circuit des Retraits</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.cardBorder }]}
                placeholder="Motif de gel d'urgence..."
                value={freezeMotif}
                onChangeText={setFreezeMotif}
              />
              <View style={styles.row}>
                <Pressable
                  onPress={async () => {
                    const res = await financeApi.gelerRetraits(freezeMotif || 'Gel préventif');
                    Alert.alert(res.success ? 'Gel activé' : 'Erreur', res.message || '');
                    await loadAll();
                  }}
                  style={[styles.smallBtn, { backgroundColor: '#991B1B', flex: 1 }]}>
                  <Text style={styles.smallBtnText}>Geler retraits</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    const res = await financeApi.degelerRetraits();
                    Alert.alert(res.success ? 'Gel levé' : 'Erreur', res.message || '');
                    await loadAll();
                  }}
                  style={[styles.smallBtn, { backgroundColor: theme.primary, flex: 1 }]}>
                  <Text style={styles.smallBtnText}>Dégeler retraits</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Webhooks Financiers ({webhooks.length})
              </Text>
              {webhooks.length === 0 ? (
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Aucun webhook enregistré.</Text>
              ) : (
                webhooks.slice(0, 15).map((w) => (
                  <View key={w.id} style={[styles.kvRow, { paddingVertical: 4 }]}>
                    <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700', flex: 1 }}>
                      [{w.gateway}] {w.event_type} • {w.reconciliation_status}
                    </Text>
                    <Text style={{ color: w.is_signature_valid ? theme.primaryDark : '#DC2626', fontSize: 11, fontWeight: '800' }}>
                      {w.is_signature_valid ? 'HMAC OK' : 'INVALIDE'}
                    </Text>
                  </View>
                ))
              )}
            </View>

            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Audit Notifications Financières ({notifAudit.length})
              </Text>
              {notifTotaux && (
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                  Envoyés : {notifTotaux.total_expedies ?? 0} • Repli SMS : {notifTotaux.total_replis_sms ?? 0} • Échecs : {notifTotaux.total_echecs ?? 0}
                </Text>
              )}
              {notifAudit.slice(0, 15).map((n) => (
                <View key={n.id} style={[styles.kvRow, { paddingVertical: 4 }]}>
                  <Text style={{ color: theme.text, fontSize: 12, flex: 1 }}>
                    [{String(n.canal || '').toUpperCase()}] {n.sujet || n.type_evenement || `#${n.id}`}
                  </Text>
                  <Text style={{ color: n.statut === 'echec' ? '#DC2626' : theme.primaryDark, fontSize: 11, fontWeight: '700' }}>
                    {n.statut}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabRow: { flexDirection: 'row', padding: 8, gap: 6, borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  scroll: {
    padding: Spacing.three,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  section: { gap: Spacing.two },
  vaultCard: { borderRadius: 18, padding: Spacing.four },
  card: { borderRadius: 16, borderWidth: 1, padding: Spacing.three, gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  input: { borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 14 },
  primaryBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  smallBtn: { borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  smallBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  deniedBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.five, gap: 8 },
  deniedTitle: { fontSize: 18, fontWeight: '800' },
});
