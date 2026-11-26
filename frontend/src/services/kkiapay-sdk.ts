import { Platform } from 'react-native';

export const KKIAPAY_DEFAULT_SCRIPT_URL = 'https://cdn.kkiapay.me/k.js';

export interface KkiapayLoadResult {
  ok: boolean;
  code?: 'NOT_WEB' | 'SCRIPT_LOAD_ERROR' | 'SCRIPT_TIMEOUT' | 'SDK_API_MISSING';
  message?: string;
}

export interface KkiapayOpenParams {
  amount: number;
  publicKey: string;
  sandbox: boolean;
  reference: string;
  theme?: string;
  name?: string;
  email?: string;
  phone?: string;
  scriptUrl?: string;
}

export interface KkiapayOpenCallbacks {
  onSuccess: (transactionId: string, raw: any) => void;
  onPending: (raw?: any) => void;
  onFailed: (raw?: any) => void;
  onClose: () => void;
}

export interface KkiapayOpenResult {
  ok: boolean;
  code?:
    | 'NOT_WEB'
    | 'WIDGET_ALREADY_OPEN'
    | 'INVALID_PARAMS'
    | 'SCRIPT_LOAD_ERROR'
    | 'SCRIPT_TIMEOUT'
    | 'SDK_API_MISSING'
    | 'WIDGET_OPEN_EXCEPTION'
    | 'IFRAME_NOT_MOUNTED';
  message?: string;
}

let inFlightLoadPromise: Promise<KkiapayLoadResult> | null = null;
let widgetCurrentlyOpen = false;

function hasKkiapayGlobal(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof (window as any).openKkiapayWidget === 'function';
}

export function isKkiapaySdkReady(): boolean {
  return Platform.OS === 'web' && hasKkiapayGlobal();
}

export function isKkiapayWidgetOpen(): boolean {
  return widgetCurrentlyOpen;
}

/**
 * Réinitialise proprement tous les handlers enregistrés sur l'instance globale k.js.
 * D'après le code source officiel de cdn.kkiapay.me/k.js :
 * - removeKkiapayListener ne nettoie que N['PAYMENT_*'], pas CLOSE_WIDGET ni PENDING_PAYMENT.
 * - On remet donc explicitement des no-op via chaque setter officiel.
 */
export function resetKkiapayWebListeners(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const w = window as any;
  const noop = () => {};
  try {
    if (typeof w.addSuccessListener === 'function') w.addSuccessListener(noop);
    if (typeof w.addFailedListener === 'function') w.addFailedListener(noop);
    if (typeof w.addPendingListener === 'function') w.addPendingListener(noop);
    if (typeof w.addPaymentAbortedListener === 'function') w.addPaymentAbortedListener(noop);
    if (typeof w.addKkiapayCloseListener === 'function') w.addKkiapayCloseListener(noop);
  } catch (err) {
    console.warn('[KKIAPAY_SDK] Erreur lors du nettoyage des listeners:', err);
  }
}

export function closeKkiapayWebWidgetIfOpen(): void {
  widgetCurrentlyOpen = false;
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const w = window as any;
  try {
    if (typeof w.closeKkiapayWidget === 'function') {
      w.closeKkiapayWidget();
    }
  } catch (err) {
    console.warn('[KKIAPAY_SDK] Impossible de fermer le widget précédent:', err);
  }
}

/**
 * Charge le SDK officiel Kkiapay (https://cdn.kkiapay.me/k.js) en mode singleton.
 * - Évite toute initialisation multiple du script.
 * - Détecte un script déjà présent (ex: +html.tsx) sans rater un événement `load` déjà passé.
 * - En cas d'échec précédent, `forceRetry = true` recharge proprement le script.
 */
export function ensureKkiapaySdkLoaded(
  scriptUrl = KKIAPAY_DEFAULT_SCRIPT_URL,
  forceRetry = false
): Promise<KkiapayLoadResult> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve({
      ok: false,
      code: 'NOT_WEB',
      message: 'Environnement non-web détecté.',
    });
  }

  if (hasKkiapayGlobal()) {
    return Promise.resolve({ ok: true });
  }

  if (inFlightLoadPromise && !forceRetry) {
    return inFlightLoadPromise;
  }

  const targetUrl = (scriptUrl || KKIAPAY_DEFAULT_SCRIPT_URL).trim();

  inFlightLoadPromise = new Promise<KkiapayLoadResult>((resolve) => {
    let settled = false;
    let pollInterval: number | null = null;
    let timeoutId: number | null = null;

    const finish = (result: KkiapayLoadResult) => {
      if (settled) return;
      settled = true;
      if (pollInterval !== null) window.clearInterval(pollInterval);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (!result.ok) {
        inFlightLoadPromise = null;
        console.error('[KKIAPAY_SDK] Échec chargement SDK:', result);
      }
      resolve(result);
    };

    // Polling léger (100 ms) : garantit de détecter le SDK même si l'événement `load` du <script>
    // inclus dans +html.tsx s'est déjà déclenché avant l'appel à cette fonction.
    pollInterval = window.setInterval(() => {
      if (hasKkiapayGlobal()) {
        finish({ ok: true });
      }
    }, 100);

    timeoutId = window.setTimeout(() => {
      if (hasKkiapayGlobal()) {
        finish({ ok: true });
      } else {
        finish({
          ok: false,
          code: 'SCRIPT_TIMEOUT',
          message: `Délai dépassé (12 s) lors du chargement du SDK Kkiapay (${targetUrl}). Vérifiez votre connexion internet ou un bloqueur de scripts.`,
        });
      }
    }, 12000);

    const existing =
      (document.getElementById('kkiapay-web-sdk') as HTMLScriptElement | null) ||
      (document.querySelector('script[src*="cdn.kkiapay.me/k.js"]') as HTMLScriptElement | null);

    const injectFreshScript = (withCacheBust: boolean) => {
      const script = document.createElement('script');
      script.id = 'kkiapay-web-sdk';
      script.setAttribute('data-loading', 'true');
      script.src = withCacheBust ? `${targetUrl}?retry=${Date.now()}` : targetUrl;
      script.async = true;
      script.onload = () => {
        script.removeAttribute('data-loading');
        script.setAttribute('data-loaded', 'true');
        if (hasKkiapayGlobal()) {
          finish({ ok: true });
        } else {
          finish({
            ok: false,
            code: 'SDK_API_MISSING',
            message: 'Le script Kkiapay est chargé mais la fonction openKkiapayWidget() est indisponible.',
          });
        }
      };
      script.onerror = () => {
        script.removeAttribute('data-loading');
        script.setAttribute('data-failed', 'true');
        finish({
          ok: false,
          code: 'SCRIPT_LOAD_ERROR',
          message: `Échec réseau ou blocage du script Kkiapay (${targetUrl}). Vérifiez votre connexion ou un bloqueur de scripts.`,
        });
      };
      document.head.appendChild(script);
    };

    if (existing && !forceRetry) {
      const isMarkedFailed = existing.getAttribute('data-failed') === 'true';
      const isStaleCompletedDoc =
        document.readyState === 'complete' &&
        existing.getAttribute('data-loading') !== 'true' &&
        !hasKkiapayGlobal();

      if (isMarkedFailed || isStaleCompletedDoc) {
        // Balise <script> morte ou déjà terminée sans avoir exposé openKkiapayWidget :
        // on la remplace immédiatement au lieu d'attendre un événement `load` qui ne viendra plus.
        existing.remove();
        injectFreshScript(isMarkedFailed);
        return;
      }

      let recovered = false;
      const staleGuard = window.setTimeout(() => {
        if (!settled && !hasKkiapayGlobal() && !recovered) {
          recovered = true;
          existing.remove();
          injectFreshScript(true);
        }
      }, 3000);

      existing.addEventListener(
        'load',
        () => {
          window.clearTimeout(staleGuard);
          if (hasKkiapayGlobal()) {
            finish({ ok: true });
          } else {
            finish({
              ok: false,
              code: 'SDK_API_MISSING',
              message: 'Le script Kkiapay a été chargé mais window.openKkiapayWidget est introuvable.',
            });
          }
        },
        { once: true }
      );
      existing.addEventListener(
        'error',
        () => {
          window.clearTimeout(staleGuard);
          existing.setAttribute('data-failed', 'true');
          if (!recovered) {
            recovered = true;
            existing.remove();
            injectFreshScript(true);
          } else {
            finish({
              ok: false,
              code: 'SCRIPT_LOAD_ERROR',
              message: `Impossible de charger le script officiel Kkiapay (${targetUrl}). Vérifiez votre connexion ou désactivez tout bloqueur de contenu pour cdn.kkiapay.me.`,
            });
          }
        },
        { once: true }
      );
      return;
    } else if (existing && forceRetry) {
      existing.remove();
    }

    injectFreshScript(forceRetry);
  });

  return inFlightLoadPromise;
}

/**
 * Ouvre le widget Kkiapay Web de manière sécurisée et unique :
 * - Vérifie que le SDK est chargé.
 * - Valide strictement les paramètres (montant, clé publique, référence interne).
 * - Empêche l'ouverture simultanée de plusieurs widgets.
 * - Remonte la véritable cause technique en cas d'erreur sans jamais la masquer.
 */
export async function openKkiapayWebWidget(
  params: KkiapayOpenParams,
  callbacks: KkiapayOpenCallbacks
): Promise<KkiapayOpenResult> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
    return { ok: false, code: 'NOT_WEB', message: 'Widget Web indisponible sur cette plateforme.' };
  }

  if (widgetCurrentlyOpen) {
    return {
      ok: false,
      code: 'WIDGET_ALREADY_OPEN',
      message: 'Un guichet de paiement Kkiapay est déjà ouvert.',
    };
  }

  const amount = Math.round(Number(params.amount));
  const publicKey = (params.publicKey || '').trim().replace(/^["']|["']$/g, '');
  const theme = (params.theme || '#0E7C5B').trim().replace(/^["']|["']$/g, '') || '#0E7C5B';
  const reference = (params.reference || '').trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      code: 'INVALID_PARAMS',
      message: `Montant officiel invalide (${params.amount}). Impossible d'ouvrir Kkiapay.`,
    };
  }
  if (!publicKey) {
    return {
      ok: false,
      code: 'INVALID_PARAMS',
      message: 'Clé API publique Kkiapay absente dans la configuration serveur.',
    };
  }
  if (!reference) {
    return {
      ok: false,
      code: 'INVALID_PARAMS',
      message: 'Référence interne de paiement manquante.',
    };
  }

  const loadRes = await ensureKkiapaySdkLoaded(params.scriptUrl || KKIAPAY_DEFAULT_SCRIPT_URL);
  if (!loadRes.ok) {
    return {
      ok: false,
      code: loadRes.code,
      message: loadRes.message,
    };
  }

  const w = window as any;
  if (typeof w.openKkiapayWidget !== 'function') {
    return {
      ok: false,
      code: 'SDK_API_MISSING',
      message: 'La fonction openKkiapayWidget() est indisponible après chargement du SDK.',
    };
  }

  // Nettoyer toute instance précédente pour éviter des widgets simultanés ou des doublons d'événements
  closeKkiapayWebWidgetIfOpen();
  resetKkiapayWebListeners();

  let eventHandled = false;

  if (typeof w.addSuccessListener === 'function') {
    w.addSuccessListener((resp: any) => {
      if (eventHandled) return;
      eventHandled = true;
      widgetCurrentlyOpen = false;
      resetKkiapayWebListeners();
      const txId = String(resp?.transactionId || resp?.transaction_id || '').trim();
      callbacks.onSuccess(txId, resp);
    });
  }

  if (typeof w.addPendingListener === 'function') {
    w.addPendingListener((resp: any) => {
      if (eventHandled) return;
      eventHandled = true;
      widgetCurrentlyOpen = false;
      resetKkiapayWebListeners();
      callbacks.onPending(resp);
    });
  }

  if (typeof w.addFailedListener === 'function') {
    w.addFailedListener((err: any) => {
      if (eventHandled) return;
      eventHandled = true;
      widgetCurrentlyOpen = false;
      resetKkiapayWebListeners();
      callbacks.onFailed(err);
    });
  }

  const handleClose = () => {
    if (eventHandled) return;
    eventHandled = true;
    widgetCurrentlyOpen = false;
    resetKkiapayWebListeners();
    callbacks.onClose();
  };

  if (typeof w.addKkiapayCloseListener === 'function') {
    w.addKkiapayCloseListener(handleClose);
  }
  if (typeof w.addPaymentAbortedListener === 'function') {
    w.addPaymentAbortedListener(handleClose);
  }

  try {
    const widgetOptions: Record<string, any> = {
      amount,
      key: publicKey,
      sandbox: Boolean(params.sandbox),
      position: 'center',
      data: reference,
      theme,
    };
    if (params.name?.trim()) widgetOptions.name = params.name.trim();
    if (params.email?.trim()) widgetOptions.email = params.email.trim();
    if (params.phone?.trim()) widgetOptions.phone = params.phone.trim();

    widgetCurrentlyOpen = true;
    w.openKkiapayWidget(widgetOptions);

    // Vérifier que l'iframe Kkiapay a réellement été montée dans le DOM
    const iframeMounted = Boolean(document.querySelector('iframe[src*="kkiapay"]'));
    if (!iframeMounted) {
      widgetCurrentlyOpen = false;
      resetKkiapayWebListeners();
      return {
        ok: false,
        code: 'IFRAME_NOT_MOUNTED',
        message: "Le SDK Kkiapay a été appelé mais l'iframe du guichet n'a pas pu être injectée dans la page.",
      };
    }

    return { ok: true };
  } catch (err: any) {
    widgetCurrentlyOpen = false;
    resetKkiapayWebListeners();
    const detail = err?.message || String(err);
    console.error('[KKIAPAY_SDK] Exception lors de openKkiapayWidget:', err);
    return {
      ok: false,
      code: 'WIDGET_OPEN_EXCEPTION',
      message: `Erreur lors de l'ouverture du guichet Kkiapay : ${detail}`,
    };
  }
}
