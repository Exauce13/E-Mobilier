import { SymbolView } from 'expo-symbols';
import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PropertyItem } from '@/types/property';

interface UnlockModalProps {
  visible: boolean;
  property: PropertyItem | null;
  onClose: () => void;
  onConfirmUnlock: (propertyId: string) => void;
}

export function UnlockModal({
  visible,
  property,
  onClose,
  onConfirmUnlock,
}: UnlockModalProps) {
  const theme = useTheme();
  const [selectedMethod, setSelectedMethod] = useState<'momo' | 'flooz' | 'solde'>('momo');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!property) return null;

  const handleUnlock = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onConfirmUnlock(property.id);
    }, 600);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.cardBorder,
            },
          ]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconContainer}>
              <SymbolView
                name={{
                  ios: 'lock.shield.fill',
                  android: 'security',
                  web: 'security',
                }}
                size={24}
                tintColor={theme.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>
                Débloquer les informations
              </Text>
              <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
                Accès direct au propriétaire et détails complets
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <SymbolView
                name={{
                  ios: 'xmark',
                  android: 'close',
                  web: 'close',
                }}
                size={18}
                tintColor={theme.textSecondary}
              />
            </Pressable>
          </View>

          {/* Property Info Snippet */}
          <View
            style={[
              styles.infoBox,
              {
                backgroundColor: theme.tagBackground,
              },
            ]}>
            <Text style={[styles.propertyTitle, { color: theme.text }]} numberOfLines={1}>
              {property.title}
            </Text>
            <Text style={[styles.priceTag, { color: theme.primary }]}>
              {property.priceFormatted}
            </Text>
          </View>

          {/* Fee Highlight */}
          <View style={styles.feeContainer}>
            <Text style={[styles.feeLabel, { color: theme.textSecondary }]}>
              Tarif de consultation :
            </Text>
            <Text style={[styles.feeAmount, { color: theme.primary }]}>
              {property.unlockFee} F CFA
            </Text>
          </View>

          {/* Payment Method Selector */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Moyen de paiement :
          </Text>
          <View style={styles.methodsRow}>
            <Pressable
              onPress={() => setSelectedMethod('momo')}
              style={[
                styles.methodChip,
                {
                  borderColor:
                    selectedMethod === 'momo' ? theme.primary : theme.cardBorder,
                  backgroundColor:
                    selectedMethod === 'momo' ? theme.primaryLight : theme.cardBackground,
                },
              ]}>
              <Text
                style={[
                  styles.methodText,
                  {
                    color: selectedMethod === 'momo' ? theme.primaryDark : theme.text,
                    fontWeight: selectedMethod === 'momo' ? '700' : '500',
                  },
                ]}>
                MTN MoMo
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setSelectedMethod('flooz')}
              style={[
                styles.methodChip,
                {
                  borderColor:
                    selectedMethod === 'flooz' ? theme.primary : theme.cardBorder,
                  backgroundColor:
                    selectedMethod === 'flooz' ? theme.primaryLight : theme.cardBackground,
                },
              ]}>
              <Text
                style={[
                  styles.methodText,
                  {
                    color: selectedMethod === 'flooz' ? theme.primaryDark : theme.text,
                    fontWeight: selectedMethod === 'flooz' ? '700' : '500',
                  },
                ]}>
                Moov Flooz
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setSelectedMethod('solde')}
              style={[
                styles.methodChip,
                {
                  borderColor:
                    selectedMethod === 'solde' ? theme.primary : theme.cardBorder,
                  backgroundColor:
                    selectedMethod === 'solde' ? theme.primaryLight : theme.cardBackground,
                },
              ]}>
              <Text
                style={[
                  styles.methodText,
                  {
                    color: selectedMethod === 'solde' ? theme.primaryDark : theme.text,
                    fontWeight: selectedMethod === 'solde' ? '700' : '500',
                  },
                ]}>
                Solde App
              </Text>
            </Pressable>
          </View>

          {/* Confirm Button */}
          <Pressable
            disabled={isProcessing}
            style={({ pressed }) => [
              styles.payButton,
              { backgroundColor: theme.primary },
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleUnlock}>
            <Text style={styles.payButtonText}>
              {isProcessing
                ? 'Traitement en cours...'
                : `Confirmer et Payer (${property.unlockFee} F CFA)`}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    padding: Spacing.four,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  headerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
  },
  infoBox: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  propertyTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  priceTag: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  feeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  feeLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  feeAmount: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  methodsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  methodChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodText: {
    fontSize: 12,
  },
  payButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
