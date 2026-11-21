import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { paiementsApi } from '@/services/api';
import type { PaymentReceiptData } from '@/types/api';
import { formatFcfa } from '@/types/property';

interface ReceiptModalProps {
  visible: boolean;
  reference: string | null;
  onClose: () => void;
}

export function ReceiptModal({ visible, reference, onClose }: ReceiptModalProps) {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<PaymentReceiptData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
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
  }, [visible, reference]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.title, { color: theme.text }]}>Quittance Officielle E-Mobilier</Text>
          {loading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 24 }} />
          ) : errorMsg ? (
            <Text style={styles.errorText}>{errorMsg}</Text>
          ) : receipt ? (
            <ScrollView style={styles.body}>
              <Row label="N° Quittance" value={receipt.quittance_numero} theme={theme} />
              <Row label="Référence" value={receipt.reference_transaction} theme={theme} />
              <Row label="Émetteur" value={receipt.emetteur} theme={theme} />
              <Row label="Payeur" value={receipt.payeur?.nom || receipt.payeur?.email || '-'} theme={theme} />
              <Row label="Montant" value={`${formatFcfa(receipt.montant_paye)} (${receipt.devise})`} theme={theme} bold />
              <Row label="Prestation" value={receipt.type_prestation} theme={theme} />
              <Row label="Mode" value={receipt.mode_reglement} theme={theme} />
              <Row label="Statut" value={receipt.statut} theme={theme} />
              {receipt.date_reglement && (
                <Row label="Date" value={new Date(receipt.date_reglement).toLocaleString('fr-FR')} theme={theme} />
              )}
            </ScrollView>
          ) : null}
          <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.primary }]}>
            <Text style={styles.closeBtnText}>Fermer</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value, theme, bold }: { label: string; value: string; theme: any; bold?: boolean }) {
  return (
    <View style={[styles.row, { borderBottomColor: theme.cardBorder }]}>
      <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowVal, { color: bold ? theme.primaryDark : theme.text, fontWeight: bold ? '800' : '600' }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.four,
    maxHeight: '85%',
  },
  title: { fontSize: 18, fontWeight: '800', marginBottom: Spacing.three, textAlign: 'center' },
  body: { marginBottom: Spacing.three },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  rowLabel: { fontSize: 13 },
  rowVal: { fontSize: 13, flex: 1, textAlign: 'right' },
  errorText: { color: '#DC2626', textAlign: 'center', marginVertical: 20, fontWeight: '600' },
  closeBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  closeBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
