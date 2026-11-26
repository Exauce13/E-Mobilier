import { AlertTriangle, Check, CheckCircle2, Clock, RefreshCw, ShieldCheck, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { usePlatformConfig } from '@/context/platform-config-context';
import { useTheme } from '@/hooks/use-theme';
import { cguApi, paiementsApi } from '@/services/api';
import {
  closeKkiapayWebWidgetIfOpen,
  ensureKkiapaySdkLoaded,
  isKkiapaySdkReady,
  KKIAPAY_DEFAULT_SCRIPT_URL,
  openKkiapayWebWidget,
  resetKkiapayWebListeners,
} from '@/services/kkiapay-sdk';
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

type PaymentPhase =
  | 'ready'
  | 'initiating'
  | 'widget_open'
  | 'verifying'
  | 'pending'
  | 'confirmed'
  | 'failed'
  | 'cancelled';

type WebSdkStatus = 'loading' | 'ready' | 'error';

function formatVersionLabel(version: string): string {
  const clean = version.trim();
  return clean.toLowerCase().startsWith('v') ? clean : `v${clean}`;
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
  const { tarifs } = usePlatformConfig();

  const [cguDoc, setCguDoc] = useState<LegalDocumentItem | null>(null);
  const [cguExpanded, setCguExpanded] = useState(false);
  const [cguAccepted, setCguAccepted] = useState(false);

  const [sdkStatus, setSdkStatus] = useState<WebSdkStatus>(() =>
    Platform.OS !== 'web' || isKkiapaySdkReady() ? 'ready' : 'loading'
  );
  const [sdkError, setSdkError] = useState<string | null>(null);

  const [phase, setPhase] = useState<PaymentPhase>('ready');
  const [initData, setInitData] = useState<PaymentInitData | null>(null);
  const [showNativeWebView, setShowNativeWebView] = useState(false);
  const [widgetOpenOnWeb, setWidgetOpenOnWeb] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Verrous anti-concurrence et anti-double traitement
  const handledTransactionRef = useRef<string | null>(null);
  const paymentResolvedRef = useRef<boolean>(false);
  const startingPaymentRef = useRef<boolean>(false);

  const estimatedOfficialAmount = useMemo(() => {
    if (initData?.montant_officiel) return initData.montant_officiel;
    if (!tarifs) return null;
    switch (operationType) {
      case 'visite':
        return tarifs.visite;
      case 'deblocage_coordonnees':
        return tarifs.deblocage_coordonnees;
      case 'publication_agent':
        return tarifs.post_agent;
      case 'publication_client':
        return tarifs.post_client;
      default:
        return null;
    }
  }, [initData, tarifs, operationType]);

  const preloadWebSdk = useCallback(async (forceRetry = false): Promise<{ ok: boolean; message?: string }> => {
    if (Platform.OS !== 'web') {
      setSdkStatus('ready');
      setSdkError(null);
      return { ok: true };
    }
    if (!forceRetry && isKkiapaySdkReady()) {
      setSdkStatus('ready');
      setSdkError(null);
      return { ok: true };
    }
    setSdkStatus('loading');
    setSdkError(null);
    const res = await ensureKkiapaySdkLoaded(KKIAPAY_DEFAULT_SCRIPT_URL, forceRetry);
    if (res.ok) {
      setSdkStatus('ready');
      setSdkError(null);
      return { ok: true };
    }
    const errMessage = res.message || 'Impossible de charger le SDK JavaScript Kkiapay.';
    setSdkStatus('error');
    setSdkError(errMessage);
    return { ok: false, message: errMessage };
  }, []);

  useEffect(() => {
    if (!visible) {
      resetKkiapayWebListeners();
      closeKkiapayWebWidgetIfOpen();
      setInitData(null);
      setShowNativeWebView(false);
      setWidgetOpenOnWeb(false);
      setPhase('ready');
      setErrorMsg(null);
      setStatusMessage(null);
      setCheckingStatus(false);
      handledTransactionRef.current = null;
      paymentResolvedRef.current = false;
      startingPaymentRef.current = false;
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

    if (Platform.OS === 'web') {
      void preloadWebSdk(false);
    }

    return () => {
      cancelled = true;
      resetKkiapayWebListeners();
      closeKkiapayWebWidgetIfOpen();
    };
  }, [visible, preloadWebSdk]);

  const verifyWithBackend = useCallback(
    async (txId: string, activeInit: PaymentInitData) => {
      const cleanTxId = txId.trim();
      if (!cleanTxId) {
        setWidgetOpenOnWeb(false);
        setShowNativeWebView(false);
        setPhase('failed');
        setErrorMsg("Kkiapay n'a pas retourné d'identifiant de transaction exploitable.");
        return;
      }

      if (handledTransactionRef.current === cleanTxId) {
        return;
      }
      handledTransactionRef.current = cleanTxId;
      paymentResolvedRef.current = true;

      setWidgetOpenOnWeb(false);
      setShowNativeWebView(false);
      setErrorMsg(null);
      setPhase('verifying');
      setStatusMessage('Vérification serveur-à-serveur auprès de Kkiapay en cours...');

      try {
        const verifyRes = await paiementsApi.verifier({
          transactionId: cleanTxId,
          reference: activeInit.reference,
        });

        // Paiement en attente ou passerelle temporairement indisponible -> NE JAMAIS publier
        if (
          !verifyRes.success &&
          (verifyRes.statusCode === 202 ||
            verifyRes.statusCode === 503 ||
            verifyRes.status === 'pending' ||
            verifyRes.code === 'PAYMENT_PENDING' ||
            verifyRes.code === 'GATEWAY_UNAVAILABLE')
        ) {
          handledTransactionRef.current = null;
          setPhase('pending');
          setStatusMessage(
            verifyRes.message ||
              'Paiement en attente de confirmation définitive par Kkiapay. Cliquez sur « Actualiser le statut » dans quelques instants.'
          );
          return;
        }

        if (!verifyRes.success) {
          handledTransactionRef.current = null;
          // Libérer la référence interne échouée/expirée/refusée afin qu'une nouvelle tentative initie une référence fraîche côté serveur
          setInitData(null);
          setPhase('failed');
          setErrorMsg(
            verifyRes.message ||
              'Le serveur E-Mobilier a refusé la validation de ce paiement après vérification Kkiapay.'
          );
          return;
        }

        const verifiedAmount = Number(verifyRes.data?.amount ?? activeInit.montant_officiel);
        const verifiedInternalRef = String(verifyRes.data?.reference ?? activeInit.reference);

        await paymentHistoryStorage.add({
          reference: verifiedInternalRef,
          transactionId: cleanTxId,
          operation: operationType,
          amount: verifiedAmount,
          label: title,
          createdAt: new Date().toISOString(),
        });

        setPhase('confirmed');
        setStatusMessage('Paiement confirmé par le serveur ! Finalisation de votre opération...');

        await onSuccess({
          transactionId: cleanTxId,
          internalReference: verifiedInternalRef,
          amount: verifiedAmount,
        });
      } catch (err: any) {
        handledTransactionRef.current = null;
        setPhase('failed');
        setErrorMsg(err?.message || 'Erreur lors de la vérification serveur du paiement.');
      }
    },
    [onSuccess, operationType, title]
  );

  const handleRefreshPendingStatus = useCallback(async () => {
    if (!initData?.reference || checkingStatus) return;
    setCheckingStatus(true);
    setErrorMsg(null);
    try {
      const res = await paiementsApi.getStatut(initData.reference);
      if (!res.success || !res.data) {
        setErrorMsg(res.message || 'Impossible de consulter le statut du paiement.');
        return;
      }

      const st = res.data.normalized_status || res.data.status;
      if (st === 'success' || st === 'successful') {
        setPhase('confirmed');
        setStatusMessage('Paiement confirmé par le serveur ! Finalisation en cours...');
        await onSuccess({
          transactionId: res.data.gateway_transaction_id || res.data.reference,
          internalReference: res.data.reference,
          amount: Number(res.data.amount || initData.montant_officiel),
        });
        return;
      }

      if (st === 'failed') {
        setInitData(null);
        setPhase('failed');
        setErrorMsg(res.data.failure_reason || 'Le paiement a échoué auprès de Kkiapay.');
        return;
      }

      if (st === 'cancelled' || st === 'expired') {
        setPhase('cancelled');
        setInitData(null);
        setStatusMessage(
          st === 'expired'
            ? 'Cette intention de paiement a expiré. Veuillez lancer un nouveau paiement.'
            : 'Ce paiement a été annulé.'
        );
        return;
      }

      setPhase('pending');
      setStatusMessage(
        'Le paiement est toujours en attente de confirmation Kkiapay. Réessayez dans quelques secondes.'
      );
    } finally {
      setCheckingStatus(false);
    }
  }, [checkingStatus, initData, onSuccess]);

  const handleWidgetCancelled = useCallback(async (activeInit: PaymentInitData) => {
    if (paymentResolvedRef.current) return;
    paymentResolvedRef.current = true;
    setWidgetOpenOnWeb(false);
    setShowNativeWebView(false);
    setPhase('cancelled');
    setInitData(null);
    setStatusMessage("Paiement annulé. Aucune annonce ni opération n'a été validée.");
    try {
      await paiementsApi.annuler(activeInit.reference, 'Guichet Kkiapay fermé avant finalisation.');
    } catch {
      // Meilleur effort
    }
  }, []);

  const handleStartPayment = async () => {
    if (startingPaymentRef.current || phase === 'initiating' || phase === 'verifying' || phase === 'widget_open') {
      return;
    }
    if (!cguAccepted) {
      setErrorMsg("Veuillez accepter les Conditions Générales d'Utilisation avant de payer.");
      return;
    }

    startingPaymentRef.current = true;
    setErrorMsg(null);
    setStatusMessage(null);
    handledTransactionRef.current = null;
    paymentResolvedRef.current = false;

    try {
      // 1. Sur Web, vérifier que le SDK officiel Kkiapay est bien chargé avant d'ouvrir le widget
      if (Platform.OS === 'web') {
        const sdkRes = await preloadWebSdk(sdkStatus === 'error');
        if (!sdkRes.ok) {
          setPhase('failed');
          setErrorMsg(
            sdkRes.message ||
              "Le SDK JavaScript Kkiapay (https://cdn.kkiapay.me/k.js) n'a pas pu être chargé. Vérifiez votre connexion ou un bloqueur de scripts."
          );
          return;
        }
      }

      setPhase('initiating');

      // 2. Réutiliser une intention pending déjà créée dans cette modale (si ouverture précédente échouée)
      //    sinon initier une nouvelle intention côté serveur
      let activeInit = initData && initData.status === 'pending' ? initData : null;
      if (!activeInit) {
        const res = await paiementsApi.initier({
          type_operation: operationType,
          entity_id: entityId ?? null,
          cgu_acceptees: true,
        });

        if (!res.success || !res.data) {
          setPhase('failed');
          setErrorMsg(res.message || "Impossible d'initialiser le paiement auprès du serveur.");
          return;
        }

        activeInit = res.data;
        setInitData(res.data);

        await paymentHistoryStorage.add({
          reference: res.data.reference,
          transactionId: '',
          operation: operationType,
          amount: res.data.montant_officiel,
          label: title,
          createdAt: new Date().toISOString(),
        });
      }

      const cfg = activeInit.widget_config;
      if (!cfg?.public_key) {
        setPhase('failed');
        setErrorMsg('Clé publique Kkiapay non configurée dans les variables d’environnement du serveur.');
        return;
      }

      if (Platform.OS === 'web') {
        // Masquer le Modal RN Web juste avant l'injection de l'iframe Kkiapay afin qu'elle soit 100 % accessible
        setWidgetOpenOnWeb(true);
        setPhase('widget_open');

        const openRes = await openKkiapayWebWidget(
          {
            amount: cfg.amount,
            publicKey: cfg.public_key,
            sandbox: cfg.sandbox,
            reference: activeInit.reference,
            theme: cfg.theme,
            name: user?.name || '',
            email: user?.email || '',
            phone: user?.phone || '',
            scriptUrl: cfg.script_url,
          },
          {
            onSuccess: (txId) => {
              void verifyWithBackend(txId, activeInit!);
            },
            onPending: () => {
              paymentResolvedRef.current = true;
              setWidgetOpenOnWeb(false);
              setPhase('pending');
              setStatusMessage(
                'Paiement initié auprès de votre opérateur Mobile Money. En attente de confirmation serveur Kkiapay...'
              );
            },
            onFailed: (err) => {
              const failedTxId = String(err?.transactionId || err?.transaction_id || '').trim();
              if (failedTxId && activeInit) {
                // Si Kkiapay fournit un transactionId même en échec (ex: 61000001 / 61000002 / 61000003 en Sandbox),
                // laisser le backend vérifier S2S et enregistrer le statut exact `failed` en base de données.
                void verifyWithBackend(failedTxId, activeInit);
                return;
              }
              paymentResolvedRef.current = true;
              setWidgetOpenOnWeb(false);
              setPhase('failed');
              setInitData(null);
              const detail =
                typeof err === 'string'
                  ? err
                  : err?.message || err?.reason?.message || err?.reason || "Le paiement a été refusé par l'opérateur Mobile Money.";
              setErrorMsg(`${detail} Vous pouvez réessayer.`);
            },
            onClose: () => {
              void handleWidgetCancelled(activeInit!);
            },
          }
        );

        if (!openRes.ok) {
          setWidgetOpenOnWeb(false);
          setPhase('failed');
          setErrorMsg(
            openRes.message ||
              `Impossible d'ouvrir le guichet Kkiapay (code : ${openRes.code || 'UNKNOWN'}).`
          );
        }
      } else {
        setPhase('widget_open');
        setShowNativeWebView(true);
      }
    } catch (err: any) {
      setWidgetOpenOnWeb(false);
      setPhase('failed');
      setErrorMsg(err?.message || "Erreur inattendue lors du lancement du paiement Kkiapay.");
    } finally {
      startingPaymentRef.current = false;
    }
  };

  const kkiapayNativeHtml = useMemo(() => {
    if (!initData?.widget_config) return '';
    const cfg = initData.widget_config;
    const scriptUrl = cfg.script_url || KKIAPAY_DEFAULT_SCRIPT_URL;
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
  <script src="${scriptUrl}"></script>
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
      if (typeof addPendingListener === 'function') {
        addPendingListener(function() {
          postMsg({ event: 'pending' });
        });
      }
      if (typeof addFailedListener === 'function') {
        addFailedListener(function(error) {
          postMsg({ event: 'failed', error: error });
        });
      }
      if (typeof addKkiapayCloseListener === 'function') {
        addKkiapayCloseListener(function() {
          postMsg({ event: 'closed' });
        });
      }
      if (typeof addPaymentAbortedListener === 'function') {
        addPaymentAbortedListener(function() {
          postMsg({ event: 'closed' });
        });
      }
      setTimeout(launch, 350);
    });
  </script>
</body>
</html>`;
  }, [initData, user]);

  // Sur Web, quand l'iframe Kkiapay plein-écran est ouverte, on masque temporairement notre Modal
  const modalVisible = visible && !(Platform.OS === 'web' && widgetOpenOnWeb);
  const payBtnDisabled =
    phase === 'initiating' ||
    !cguAccepted ||
    (Platform.OS === 'web' && sdkStatus === 'loading');

  return (
    <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.cardBorder }]}>
          <View style={styles.headerTitleWrap}>
            <ShieldCheck size={20} color={theme.primary} strokeWidth={2.3} />
            <Text style={[styles.headerTitle, { color: theme.text }]}>{title}</Text>
          </View>
          <Pressable
            onPress={() => {
              if (phase === 'verifying') return;
              onClose();
            }}
            hitSlop={10}
            style={styles.closeBtn}>
            <X size={20} color={theme.text} strokeWidth={2.2} />
          </Pressable>
        </View>

        {showNativeWebView && initData ? (
          <View style={styles.webviewContainer}>
            <WebView
              originWhitelist={['*']}
              source={{ html: kkiapayNativeHtml, baseUrl: 'https://cdn.kkiapay.me' }}
              javaScriptEnabled
              domStorageEnabled
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.event === 'success' && data.transactionId) {
                    void verifyWithBackend(String(data.transactionId), initData);
                  } else if (data.event === 'pending') {
                    setShowNativeWebView(false);
                    setPhase('pending');
                    setStatusMessage('Paiement en attente de confirmation auprès de votre opérateur Mobile Money.');
                  } else if (data.event === 'failed') {
                    setShowNativeWebView(false);
                    setPhase('failed');
                    setInitData(null);
                    setErrorMsg('Paiement refusé par Mobile Money. Veuillez réessayer.');
                  } else if (data.event === 'closed') {
                    void handleWidgetCancelled(initData);
                  } else if (data.event === 'error') {
                    setShowNativeWebView(false);
                    setPhase('failed');
                    setErrorMsg(data.message || 'Impossible de lancer le guichet Kkiapay.');
                  }
                } catch {
                  // Ignore malformed webview messages
                }
              }}
            />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {/* Official Server Pricing Card */}
            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: theme.badgeGreenBg }]}>
                  <Text style={[styles.badgeText, { color: theme.badgeGreenText }]}>
                    TARIFICATION SERVEUR OFFICIELLE
                  </Text>
                </View>
                {initData?.widget_config?.sandbox ? (
                  <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.badgeText, { color: '#92400E' }]}>
                      MODE SANDBOX (TEST)
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.descText, { color: theme.textSecondary }]}>
                {description ||
                  'Le montant exact est calculé et scellé par le serveur E-Mobilier puis vérifié automatiquement auprès de Kkiapay.'}
              </Text>
              {estimatedOfficialAmount !== null && (
                <View style={[styles.amountBox, { backgroundColor: theme.primaryLight }]}>
                  <Text style={[styles.amountLabel, { color: theme.textSecondary }]}>Montant officiel à régler</Text>
                  <Text style={[styles.amountValue, { color: theme.primaryDark }]}>
                    {formatFcfa(estimatedOfficialAmount)}
                  </Text>
                  {initData?.reference ? (
                    <Text style={[styles.refText, { color: theme.textSecondary }]}>
                      Référence interne : {initData.reference}
                    </Text>
                  ) : (
                    <Text style={[styles.refText, { color: theme.textSecondary }]}>
                      Mobile Money (MTN, Moov, Celtiis) &amp; Carte bancaire via Kkiapay
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* CGU acceptance */}
            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Pressable
                onPress={() => phase !== 'verifying' && phase !== 'confirmed' && setCguAccepted((v) => !v)}
                style={styles.cguRow}>
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
                  J'accepte les Conditions Générales d'Utilisation{' '}
                  {cguDoc ? `(${formatVersionLabel(cguDoc.version)}) ` : ''}d'E-Mobilier.
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

            {/* SDK Load Error Diagnostic Banner (Web) */}
            {Platform.OS === 'web' && sdkStatus === 'error' && sdkError ? (
              <View style={[styles.feedbackBox, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                <AlertTriangle size={18} color="#B45309" strokeWidth={2.2} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[styles.feedbackText, { color: '#92400E' }]}>{sdkError}</Text>
                  <Pressable onPress={() => void preloadWebSdk(true)} style={{ alignSelf: 'flex-start' }}>
                    <Text style={{ color: '#B45309', fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' }}>
                      Recharger le SDK Kkiapay
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* Error Banner */}
            {errorMsg && (
              <View style={[styles.feedbackBox, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
                <AlertTriangle size={18} color="#B91C1C" strokeWidth={2.2} />
                <Text style={[styles.feedbackText, { color: '#B91C1C' }]}>{errorMsg}</Text>
              </View>
            )}

            {/* Status States */}
            {phase === 'verifying' ? (
              <View style={[styles.statusCard, { backgroundColor: theme.cardBackground, borderColor: theme.primary }]}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.statusTitle, { color: theme.text }]}>Vérification serveur en cours</Text>
                <Text style={[styles.statusSub, { color: theme.textSecondary }]}>
                  {statusMessage || 'Confirmation automatique de votre transaction auprès des serveurs Kkiapay...'}
                </Text>
              </View>
            ) : phase === 'confirmed' ? (
              <View style={[styles.statusCard, { backgroundColor: '#ECFDF5', borderColor: '#10B981' }]}>
                <CheckCircle2 size={34} color="#059669" strokeWidth={2.2} />
                <Text style={[styles.statusTitle, { color: '#065F46' }]}>Paiement confirmé</Text>
                <Text style={[styles.statusSub, { color: '#047857' }]}>
                  {statusMessage || 'Validation serveur réussie. Finalisation en cours...'}
                </Text>
              </View>
            ) : phase === 'pending' ? (
              <View style={[styles.statusCard, { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' }]}>
                <Clock size={30} color="#D97706" strokeWidth={2.2} />
                <Text style={[styles.statusTitle, { color: '#92400E' }]}>Paiement en attente de confirmation</Text>
                <Text style={[styles.statusSub, { color: '#92400E' }]}>{statusMessage}</Text>
                {initData?.reference ? (
                  <Text style={[styles.refBadge, { color: '#78350F' }]}>
                    Référence de suivi : {initData.reference}
                  </Text>
                ) : null}
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => void handleRefreshPendingStatus()}
                    disabled={checkingStatus}
                    style={[styles.primaryBtn, { backgroundColor: '#D97706', width: '100%' }]}>
                    {checkingStatus ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <View style={styles.btnIconRow}>
                        <RefreshCw size={16} color="#FFFFFF" strokeWidth={2.4} />
                        <Text style={styles.primaryBtnText}>Actualiser le statut serveur</Text>
                      </View>
                    )}
                  </Pressable>
                  <Pressable onPress={onClose} style={[styles.secondaryBtn, { borderColor: '#D97706', width: '100%' }]}>
                    <Text style={[styles.secondaryBtnText, { color: '#92400E' }]}>
                      Fermer et vérifier plus tard
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : phase === 'cancelled' ? (
              <View style={[styles.statusCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <Text style={[styles.statusTitle, { color: theme.text }]}>Paiement annulé</Text>
                <Text style={[styles.statusSub, { color: theme.textSecondary }]}>
                  {statusMessage || "Vous avez fermé le guichet Kkiapay. Aucune publication n'a été effectuée."}
                </Text>
                <View style={[styles.actions, { width: '100%' }]}>
                  <Pressable
                    onPress={() => void handleStartPayment()}
                    disabled={payBtnDisabled}
                    style={[
                      styles.primaryBtn,
                      {
                        backgroundColor: theme.primary,
                        opacity: payBtnDisabled ? 0.55 : 1,
                      },
                    ]}>
                    {Platform.OS === 'web' && sdkStatus === 'loading' ? (
                      <View style={styles.btnIconRow}>
                        <ActivityIndicator color="#FFFFFF" size="small" />
                        <Text style={styles.primaryBtnText}>Chargement du guichet Kkiapay...</Text>
                      </View>
                    ) : (
                      <Text style={styles.primaryBtnText}>Réessayer le paiement via Kkiapay</Text>
                    )}
                  </Pressable>
                  <Pressable onPress={onClose} style={[styles.secondaryBtn, { borderColor: theme.cardBorder }]}>
                    <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Retour</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.actions}>
                <Pressable
                  onPress={() => void handleStartPayment()}
                  disabled={payBtnDisabled}
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor: theme.primary,
                      opacity: payBtnDisabled ? 0.55 : 1,
                    },
                  ]}>
                  {phase === 'initiating' || (Platform.OS === 'web' && sdkStatus === 'loading') ? (
                    <View style={styles.btnIconRow}>
                      <ActivityIndicator color="#FFFFFF" size="small" />
                      <Text style={styles.primaryBtnText}>
                        {phase === 'initiating'
                          ? 'Initialisation du paiement...'
                          : 'Chargement du guichet Kkiapay...'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      {phase === 'failed'
                        ? 'Réessayer le paiement via Kkiapay'
                        : estimatedOfficialAmount !== null
                        ? `Payer ${formatFcfa(estimatedOfficialAmount)} via Kkiapay`
                        : 'Payer via Kkiapay'}
                    </Text>
                  )}
                </Pressable>
                <Text style={[styles.securityNote, { color: theme.textSecondary }]}>
                  Le guichet Kkiapay s'ouvre automatiquement et notre serveur vérifie votre paiement en temps réel.
                  Aucun identifiant de transaction n'est à saisir manuellement.
                </Text>
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
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 16, fontWeight: '800', flex: 1 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  webviewContainer: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  descText: { fontSize: 14, lineHeight: 20 },
  amountBox: { padding: Spacing.three, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  amountLabel: { fontSize: 12, fontWeight: '600' },
  amountValue: { fontSize: 26, fontWeight: '900', marginVertical: 2 },
  refText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  cguRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cguText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  cguToggle: { marginTop: 4 },
  cguToggleText: { fontSize: 12, fontWeight: '700' },
  cguBox: { maxHeight: 150, padding: Spacing.three, borderRadius: 10, marginTop: 6 },
  cguBody: { fontSize: 12, lineHeight: 17 },
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
  },
  feedbackText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  statusCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: Spacing.four,
    alignItems: 'center',
    gap: 10,
  },
  statusTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  statusSub: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  refBadge: { fontSize: 12, fontWeight: '800' },
  actions: { gap: Spacing.two, marginTop: Spacing.one },
  btnIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryBtn: {
    borderRadius: 14,
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  secondaryBtn: {
    borderRadius: 14,
    minHeight: 46,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700' },
  securityNote: { fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 4 },
});
