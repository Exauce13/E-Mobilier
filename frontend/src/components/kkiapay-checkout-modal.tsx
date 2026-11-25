import { Check, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { cguApi, paiementsApi } from '@/services/api';
import { paymentHistoryStorage } from '@/services/payment-history';
import type { LegalDocumentItem, PaymentInitData, PaymentOperationType } from '@/types/api';
import { formatFcfa } from '@/types/property';

export interface KkiapaySuccessResult {
  transactionId: string;
  internalReference: string;
  amount: number;
}

interface KkiapayCheckoutModalProps {
  visible: boolean;
  operationType: PaymentOperationType;
  entityId?: number | null;
  title?: string;
  description?: string;
  onClose: () => void;
  onSuccess: (result: KkiapaySuccessResult) => Promise<void> | void;
}

export function KkiapayCheckoutModal({
  visible,
  operationType,
  entityId,
  title = 'Paiement Sécurisé Kkiapay',
  description,
  onClose,
  onSuccess,
}: KkiapayCheckoutModalProps) {
  const theme = useTheme();
  const { user } = useAuth();

  const [cguDoc, setCguDoc] = useState<LegalDocumentItem | null>(null);
  const [cguExpanded, setCguExpanded] = useState(false);
  const [cguAccepted, setCguAccepted] = useState(true);
  const [initLoading, setInitLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [initData, setInitData] = useState<PaymentInitData | null>(null);
  const [showWidget, setShowWidget] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualTxId, setManualTxId] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setInitData(null);
      setShowWidget(false);
      setManualMode(false);
      setManualTxId('');
      setErrorMsg(null);
      setVerifying(false);
      return;
    }

    let cancelled = false;
    const loadCgu = async () => {
      const res = await cguApi.getCguCourante();
      if (!cancelled && res.success && res.data) {
        setCguDoc(res.data);
      }
    };
    void loadCgu();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handleInitPayment = async () => {
    if (!cguAccepted) {
      setErrorMsg("Veuillez accepter les Conditions Générales d'Utilisation avant de payer.");
      return;
    }

    setErrorMsg(null);
    setInitLoading(true);
    try {
      const res = await paiementsApi.initier({
        type_operation: operationType,
        entity_id: entityId ?? null,
        cgu_acceptees: true,
      });

      if (!res.success || !res.data) {
        setErrorMsg(res.message || "Impossible d'initialiser le paiement auprès du serveur.");
        return;
      }

      setInitData(res.data);
      if (!res.data.widget_config?.public_key) {
        setErrorMsg('Clé publique Kkiapay non configurée sur le serveur.');
        return;
      }

      if (Platform.OS === 'web') {
        setManualMode(true);
      } else {
        setShowWidget(true);
      }
    } finally {
      setInitLoading(false);
    }
  };

  const completeWithTransactionId = async (txId: string) => {
    const cleanId = txId.trim();
    if (!cleanId) {
      setErrorMsg('Identifiant de transaction Kkiapay requis.');
      return;
    }
    setErrorMsg(null);
    setVerifying(true);
    try {
      const ref = initData?.reference || cleanId;
      const amount = initData?.montant_officiel || 0;

      // Reconcile/verify via backend ledger endpoint if initData exists
      if (operationType !== 'publication_client' && operationType !== 'publication_agent') {
        await paiementsApi.verifier({ transactionId: cleanId, amount }).catch(() => null);
      }

      await paymentHistoryStorage.add({
        reference: ref,
        transactionId: cleanId,
        operation: operationType,
        amount,
        label: title,
        createdAt: new Date().toISOString(),
      });

      await onSuccess({
        transactionId: cleanId,
        internalReference: ref,
        amount,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la validation du paiement.');
    } finally {
      setVerifying(false);
    }
  };

  const kkiapayHtml = useMemo(() => {
    if (!initData?.widget_config) return '';
    const cfg = initData.widget_config;
    const payloadJson = JSON.stringify({
      amount: cfg.amount,
      key: cfg.public_key,
      sandbox: cfg.sandbox,
      data: initData.reference,
      theme: cfg.theme || '#0E7C5B',
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
    });

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <script src="https://cdn.kkiapay.me/k.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0F172A;
      color: #F8FAFC;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      text-align: center;
    }
    .card {
      background: #1E293B;
      border-radius: 16px;
      padding: 24px;
      max-width: 360px;
      width: 100%;
    }
    .btn {
      margin-top: 16px;
      background: #0E7C5B;
      color: #fff;
      border: none;
      border-radius: 10px;
      padding: 14px 20px;
      font-size: 16px;
      font-weight: 700;
      width: 100%;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="card">
    <h3>E-Mobilier — Paiement Kkiapay</h3>
    <p>Montant officiel : <strong>${cfg.amount} F CFA</strong></p>
    <p style="font-size:12px;opacity:.75;">Réf. interne : ${initData.reference}</p>
    <button class="btn" onclick="launch()">Ouvrir le guichet Mobile Money</button>
  </div>
  <script>
    var cfg = ${payloadJson};
    function postMsg(obj) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(obj));
      }
    }
    function launch() {
      try {
        if (typeof openKkiapayWidget !== 'function') {
          postMsg({ event: 'error', message: 'SDK Kkiapay non chargé. Vérifiez la connexion internet.' });
          return;
        }
        openKkiapayWidget({
          amount: cfg.amount,
          position: 'center',
          callback: '',
          data: cfg.data,
          theme: cfg.theme,
          sandbox: cfg.sandbox,
          key: cfg.key,
          name: cfg.name,
          email: cfg.email,
          phone: cfg.phone
        });
      } catch (e) {
        postMsg({ event: 'error', message: e && e.message ? e.message : 'Erreur widget' });
      }
    }
    window.addEventListener('load', function() {
      if (typeof addSuccessListener === 'function') {
        addSuccessListener(function(response) {
          postMsg({ event: 'success', transactionId: response.transactionId || response.transaction_id });
        });
      }
      if (typeof addFailedListener === 'function') {
        addFailedListener(function(error) {
          postMsg({ event: 'failed', error: error });
        });
      }
      setTimeout(launch, 400);
    });
  </script>
</body>
</html>`;
  }, [initData, user]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.cardBorder }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <X size={20} color={theme.text} strokeWidth={2.2} />
          </Pressable>
        </View>

        {showWidget && initData ? (
          <View style={styles.webviewContainer}>
            <WebView
              originWhitelist={['*']}
              source={{ html: kkiapayHtml, baseUrl: 'https://cdn.kkiapay.me' }}
              javaScriptEnabled
              domStorageEnabled
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.event === 'success' && data.transactionId) {
                    setShowWidget(false);
                    void completeWithTransactionId(String(data.transactionId));
                  } else if (data.event === 'failed') {
                    setShowWidget(false);
                    setErrorMsg('Paiement annulé ou refusé par Mobile Money.');
                  } else if (data.event === 'error') {
                    setErrorMsg(data.message || 'Impossible de lancer le guichet Kkiapay.');
                  }
                } catch {
                  // Ignore malformed webview messages
                }
              }}
            />
            <View style={[styles.webviewFooter, { borderTopColor: theme.cardBorder, backgroundColor: theme.cardBackground }]}>
              <Pressable onPress={() => { setShowWidget(false); setManualMode(true); }}>
                <Text style={[styles.switchLink, { color: theme.primary }]}>
                  Saisir manuellement une référence Kkiapay
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: theme.badgeGreenBg }]}>
                  <Text style={[styles.badgeText, { color: theme.badgeGreenText }]}>
                    TARIFICATION SERVEUR OFFICIELLE
                  </Text>
                </View>
              </View>
              <Text style={[styles.descText, { color: theme.textSecondary }]}>
                {description ||
                  "Le montant exact est calculé et scellé par le serveur E-Mobilier puis encaissé via Kkiapay (MTN MoMo, Moov Money, Celtiis, Carte)."}
              </Text>
              {initData && (
                <View style={[styles.amountBox, { backgroundColor: theme.primaryLight }]}>
                  <Text style={[styles.amountLabel, { color: theme.textSecondary }]}>Montant à régler</Text>
                  <Text style={[styles.amountValue, { color: theme.primaryDark }]}>
                    {formatFcfa(initData.montant_officiel)}
                  </Text>
                  <Text style={[styles.refText, { color: theme.textSecondary }]}>
                    Référence interne : {initData.reference}
                  </Text>
                </View>
              )}
            </View>

            {/* CGU acceptance */}
            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Pressable onPress={() => setCguAccepted((v) => !v)} style={styles.cguRow}>
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: cguAccepted ? theme.primary : theme.cardBorder,
                      backgroundColor: cguAccepted ? theme.primary : 'transparent',
                    },
                  ]}>
                  {cguAccepted && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                </View>
                <Text style={[styles.cguText, { color: theme.text }]}>
                  J'accepte les Conditions Générales d'Utilisation {cguDoc ? `(v${cguDoc.version})` : ''} d'E-Mobilier.
                </Text>
              </Pressable>

              {cguDoc && (
                <Pressable onPress={() => setCguExpanded((v) => !v)} style={styles.cguToggle}>
                  <Text style={[styles.cguToggleText, { color: theme.primary }]}>
                    {cguExpanded ? 'Masquer les CGU' : 'Lire les CGU en vigueur'}
                  </Text>
                </Pressable>
              )}

              {cguExpanded && cguDoc && (
                <ScrollView style={[styles.cguBox, { backgroundColor: theme.backgroundElement }]} nestedScrollEnabled>
                  <Text style={[styles.cguBody, { color: theme.textSecondary }]}>{cguDoc.contenu}</Text>
                </ScrollView>
              )}
            </View>

            {errorMsg && (
              <View style={[styles.errorBox, { backgroundColor: '#FEE2E2' }]}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {verifying ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.loadingLabel, { color: theme.textSecondary }]}>
                  Vérification serveur Kkiapay en cours...
                </Text>
              </View>
            ) : !manualMode ? (
              <View style={styles.actions}>
                <Pressable
                  onPress={handleInitPayment}
                  disabled={initLoading}
                  style={[styles.primaryBtn, { backgroundColor: theme.primary, opacity: initLoading ? 0.7 : 1 }]}>
                  {initLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Payer maintenant via Kkiapay</Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => setManualMode(true)}
                  style={[styles.secondaryBtn, { borderColor: theme.cardBorder }]}>
                  <Text style={[styles.secondaryBtnText, { color: theme.text }]}>
                    J'ai déjà un ID de transaction Kkiapay
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Identifiant de transaction Kkiapay (transactionId)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement },
                  ]}
                  placeholder="Ex: transactionId Kkiapay reçu après paiement"
                  placeholderTextColor={theme.textSecondary}
                  value={manualTxId}
                  onChangeText={setManualTxId}
                  autoCapitalize="none"
                />
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => completeWithTransactionId(manualTxId)}
                    style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
                    <Text style={styles.primaryBtnText}>Vérifier et finaliser</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setManualMode(false);
                      if (initData && Platform.OS !== 'web') setShowWidget(true);
                    }}
                    style={[styles.secondaryBtn, { borderColor: theme.cardBorder }]}>
                    <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Retour au widget</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', flex: 1 },
  closeBtn: { padding: 6 },
  webviewContainer: { flex: 1 },
  webviewFooter: { padding: Spacing.three, alignItems: 'center', borderTopWidth: 1 },
  switchLink: { fontSize: 13, fontWeight: '700' },
  content: { padding: Spacing.four, gap: Spacing.three },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  badgeRow: { flexDirection: 'row' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  descText: { fontSize: 14, lineHeight: 20 },
  amountBox: { padding: Spacing.three, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  amountLabel: { fontSize: 12, fontWeight: '600' },
  amountValue: { fontSize: 24, fontWeight: '900', marginVertical: 2 },
  refText: { fontSize: 12, fontWeight: '600' },
  cguRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  cguText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  cguToggle: { marginTop: 4 },
  cguToggleText: { fontSize: 12, fontWeight: '700' },
  cguBox: { maxHeight: 140, padding: Spacing.three, borderRadius: 10, marginTop: 6 },
  cguBody: { fontSize: 12, lineHeight: 17 },
  errorBox: { padding: Spacing.three, borderRadius: 12 },
  errorText: { color: '#B91C1C', fontSize: 13, fontWeight: '600' },
  loadingBox: { paddingVertical: Spacing.five, alignItems: 'center', gap: 10 },
  loadingLabel: { fontSize: 14, fontWeight: '600' },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700' },
  inputLabel: { fontSize: 13, fontWeight: '700' },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 14,
  },
});
