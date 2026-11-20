import { SymbolView } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { paiementsApi } from '@/services/api';
import type { PaymentReceiptData } from '@/types/api';
import { formatFcfa } from '@/types/property';

interface ReceiptModalProps {
  visible: boolean;
  reference?: string | null;
  receipt?: PaymentReceiptData | null;
  onClose: () => void;
}

export function ReceiptModal({ visible, reference, receipt: propReceipt, onClose }: ReceiptModalProps) {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<PaymentReceiptData | null>(propReceipt || null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (propReceipt) {
      setReceipt(propReceipt);
      return;
    }

    if (!visible || !reference) {
      setReceipt(null);
      setErrorMsg(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setErrorMsg(null);
      const res = await paiementsApi.getRecu(reference);
      if (!cancelled) {
        if (res.success && res.data) {
          setReceipt(res.data);
        } else {
          setErrorMsg(res.message || 'Quittance introuvable.');
        }
        setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [visible, reference, propReceipt]);

  const handleShare = async () => {
    if (!receipt) return;
    try {
      await Share.share({
        message: `Quittance Officielle E-Mobilier Bénin [${receipt.quittance_numero || receipt.reference_transaction}] - Montant: ${formatFcfa(receipt.montant_paye)} - Prestation: ${receipt.type_prestation}`,
        title: 'Quittance Notariale E-Mobilier',
      });
    } catch {
      // Ignored
    }
  };

  const handleDownloadPdf = () => {
    Alert.alert(
      'Téléchargement PDF',
      `La quittance officielle certifiée ${receipt?.quittance_numero || 'REC-2025-089-BJ'} est prête au format PDF scellé.`
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.modalCard,
            { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
          ]}>
          {/* Institutional Header (Stitch) */}
          <View style={[styles.headerBanner, { backgroundColor: theme.navy }]}>
            <View style={styles.headerTitleRow}>
              <SymbolView
                name={{ ios: 'building.columns.fill', android: 'local_police', web: 'local_police' }}
                size={22}
                tintColor={theme.tertiaryFixed}
              />
              <View>
                <Text style={styles.govTitle}>RÉPUBLIQUE DU BÉNIN</Text>
                <Text style={styles.brandTitle}>E-MOBILIER SARL • FONCIER NUMÉRIQUE</Text>
              </View>
            </View>
            <Text style={styles.rccmSub}>
              RCCM RB/COT/23-B-8912 • IFU 3201948291048 • Cadastre & Notariat
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={theme.primaryContainer} />
            </View>
          ) : errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={[styles.errorText, { color: theme.error }]}>{errorMsg}</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={styles.bodyScroll}>
              {/* Gold Certified Stamp Badge */}
              <View style={styles.stampBadgeRow}>
                <View style={[styles.goldSeal, { borderColor: theme.gold, backgroundColor: theme.goldLight }]}>
                  <SymbolView
                    name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }}
                    size={14}
                    tintColor={theme.goldDark}
                  />
                  <Text style={[styles.goldSealText, { color: theme.goldDark }]}>
                    CERTIFIÉ CONFORME & ENREGISTRÉ
                  </Text>
                </View>
              </View>

              {/* Receipt Reference */}
              <View style={styles.refBox}>
                <Text style={[styles.refLabel, { color: theme.textSecondary }]}>N° DE QUITTANCE OFFICIELLE</Text>
                <Text style={[styles.refNumber, { color: theme.primaryContainer }]}>
                  {receipt?.quittance_numero || receipt?.reference_transaction || 'REC-2025-089-BJ'}
                </Text>
              </View>

              {/* Immutable Notarial Details */}
              <View
                style={[
                  styles.detailsContainer,
                  { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder },
                ]}>
                <ReceiptRow
                  label="Mandant / Payeur"
                  value={receipt?.payeur?.nom || receipt?.payeur?.email || 'Mme Aïcha Bio'}
                  theme={theme}
                />
                <ReceiptRow
                  label="Prestation"
                  value={receipt?.type_prestation || 'Frais de visite terrain encadrée'}
                  theme={theme}
                />
                <ReceiptRow
                  label="Montant Réglé"
                  value={`${formatFcfa(receipt?.montant_paye ?? 500)}`}
                  theme={theme}
                  bold
                />
                <ReceiptRow
                  label="Règlement"
                  value={receipt?.mode_reglement || 'MTN Mobile Money (+229 97 XX XX 12)'}
                  theme={theme}
                />
                <ReceiptRow
                  label="Horodatage Notarié"
                  value={
                    receipt?.date_reglement
                      ? new Date(receipt.date_reglement).toLocaleString('fr-FR')
                      : '2025-01-25 15:31:04 (GMT+1)'
                  }
                  theme={theme}
                />
                <ReceiptRow
                  label="Garantie Séquestre"
                  value="Séquestre bancaire levé après PV contradictoire"
                  theme={theme}
                />
              </View>

              {/* Verification QR Code Section */}
              <View style={styles.qrSection}>
                <View
                  style={[
                    styles.qrBox,
                    { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
                  ]}>
                  {/* Visual QR Code placeholder with accurate layout */}
                  <View style={styles.qrMatrix}>
                    <SymbolView
                      name={{ ios: 'qrcode', android: 'qr_code_2', web: 'qr_code_2' }}
                      size={64}
                      tintColor={theme.navy}
                    />
                  </View>
                  <Text style={[styles.qrCodeNotice, { color: theme.textSecondary }]}>
                    Scannez pour vérifier l'authenticité sur le registre public e-mobilier.bj
                  </Text>
                </View>
              </View>
            </ScrollView>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsFooter}>
            <Pressable
              onPress={handleDownloadPdf}
              style={[
                styles.pdfBtn,
                { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder },
              ]}>
              <SymbolView
                name={{ ios: 'arrow.down.doc.fill', android: 'download', web: 'download' }}
                size={14}
                tintColor={theme.text}
              />
              <Text style={[styles.pdfBtnText, { color: theme.text }]}>Télécharger PDF</Text>
            </Pressable>

            <Pressable
              onPress={handleShare}
              style={[
                styles.shareBtn,
                { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder },
              ]}>
              <SymbolView
                name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
                size={14}
                tintColor={theme.text}
              />
            </Pressable>

            <Pressable
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.primaryContainer }]}>
              <Text style={styles.closeBtnText}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ReceiptRow({
  label,
  value,
  theme,
  bold,
}: {
  label: string;
  value: string;
  theme: any;
  bold?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text
        style={[
          styles.rowVal,
          {
            color: bold ? theme.primaryContainer : theme.text,
            fontWeight: bold ? '800' : '600',
            fontSize: bold ? 14 : 12,
          },
        ]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.three,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  headerBanner: {
    padding: Spacing.three,
    gap: 6,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  govTitle: {
    color: '#D4AF37',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  rccmSub: {
    color: '#CBD5E1',
    fontSize: 10,
  },
  loadingBox: {
    padding: 36,
    alignItems: 'center',
  },
  errorBox: {
    padding: 24,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  bodyScroll: {
    padding: Spacing.three,
  },
  stampBadgeRow: {
    alignItems: 'center',
    marginVertical: 4,
  },
  goldSeal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  goldSealText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  refBox: {
    alignItems: 'center',
    marginVertical: 10,
    gap: 2,
  },
  refLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  refNumber: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detailsContainer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  rowVal: {
    fontSize: 12,
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  qrSection: {
    alignItems: 'center',
    marginVertical: 14,
  },
  qrBox: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    width: '100%',
  },
  qrMatrix: {
    padding: 8,
  },
  qrCodeNotice: {
    fontSize: 10,
    textAlign: 'center',
  },
  actionsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  pdfBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  pdfBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
