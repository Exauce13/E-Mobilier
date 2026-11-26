import { Unlock } from 'lucide-react-native';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { KkiapayCheckoutModal } from '@/components/kkiapay-checkout-modal';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { usePlatformConfig } from '@/context/platform-config-context';
import { useTheme } from '@/hooks/use-theme';
import { proprietesApi } from '@/services/api';
import type { BackendProperty } from '@/types/api';
import { PropertyItem } from '@/types/property';

interface UnlockModalProps {
  visible: boolean;
  property: PropertyItem | null;
  onClose: () => void;
  onConfirmUnlock: (property: PropertyItem, updatedBackend?: BackendProperty) => void;
  onOpenFullDetails?: (property: PropertyItem) => void;
}

export function UnlockModal({
  visible,
  property,
  onClose,
  onConfirmUnlock,
  onOpenFullDetails,
}: UnlockModalProps) {
  const theme = useTheme();
  const { isAuthenticated, openAuthModal } = useAuth();
  const { tarifs } = usePlatformConfig();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!property) return null;

  const fee = property.unlockFee > 0 ? property.unlockFee : tarifs?.deblocage_coordonnees ?? null;
  const feeShortLabel = fee !== null ? `${fee} F` : 'tarif officiel';
  const feeFullLabel = fee !== null ? `${fee} F CFA` : 'Tarif serveur';

  const handleStartUnlock = () => {
    setErrorMsg(null);
    if (!isAuthenticated) {
      onClose();
      openAuthModal('login');
      return;
    }
    setCheckoutOpen(true);
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable
            style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
            onPress={(e) => e.stopPropagation()}>
            <View style={[styles.iconCircle, { backgroundColor: theme.primaryLight }]}>
              <Unlock size={26} color={theme.primary} strokeWidth={2.2} />
            </View>

            <Text style={[styles.title, { color: theme.text }]}>
              {property.isUnlocked ? 'Coordonnées déjà débloquées' : 'Débloquer les détails du bien'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {property.title}
            </Text>

            {property.isUnlocked ? (
              <View style={[styles.infoBox, { backgroundColor: theme.badgeGreenBg }]}>
                <Text style={[styles.infoTitle, { color: theme.badgeGreenText }]}>
                  Accès complet actif
                </Text>
                <Text style={[styles.infoDesc, { color: theme.text }]}>
                  {property.locationDetails || property.location.fullAddress}
                </Text>
                {property.owner?.telephone && (
                  <Text style={[styles.infoDesc, { color: theme.text, fontWeight: '700' }]}>
                    Contact : {property.owner.name} — {property.owner.telephone}
                  </Text>
                )}
              </View>
            ) : (
              <View style={[styles.priceBox, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.priceLabel, { color: theme.textSecondary }]}>
                  Frais officiels de déblocage (Kkiapay)
                </Text>
                <Text style={[styles.priceValue, { color: theme.primaryDark }]}>{feeFullLabel}</Text>
                <Text style={[styles.priceHint, { color: theme.textSecondary }]}>
                  Accès immédiat aux repères précis, téléphone du propriétaire/agent et documents légaux.
                </Text>
              </View>
            )}

            {errorMsg && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            <View style={styles.actions}>
              {!property.isUnlocked ? (
                <Pressable
                  onPress={handleStartUnlock}
                  style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
                  <Text style={styles.primaryBtnText}>Débloquer via Kkiapay ({feeShortLabel})</Text>
                </Pressable>
              ) : null}

              {onOpenFullDetails && (
                <Pressable
                  onPress={() => {
                    onClose();
                    onOpenFullDetails(property);
                  }}
                  style={[styles.secondaryBtn, { borderColor: theme.primary }]}>
                  <Text style={[styles.secondaryBtnText, { color: theme.primary }]}>
                    Voir la fiche complète & Planifier visite
                  </Text>
                </Pressable>
              )}

              <Pressable onPress={onClose} style={styles.cancelBtn}>
                <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Fermer</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <KkiapayCheckoutModal
        visible={checkoutOpen}
        operationType="deblocage_coordonnees"
        entityId={property.backendId ?? null}
        title={`Déblocage Bien #${property.id}`}
        description={`Déblocage unique des coordonnées et documents du bien (${feeFullLabel}).`}
        onClose={() => setCheckoutOpen(false)}
        onSuccess={async ({ transactionId, internalReference }) => {
          const idToUnlock = property.backendId ?? property.id;
          const res = await proprietesApi.unlockDetails(idToUnlock, transactionId, internalReference);
          if (!res.success) {
            throw new Error(res.message || 'Échec du déblocage côté serveur.');
          }
          setCheckoutOpen(false);
          onConfirmUnlock(property, res.data);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.three,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    borderRadius: 24,
    borderWidth: 1,
    padding: Spacing.four,
    alignItems: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  title: { fontSize: 19, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: Spacing.three },
  priceBox: {
    width: '100%',
    borderRadius: 14,
    padding: Spacing.three,
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  priceLabel: { fontSize: 12, fontWeight: '600' },
  priceValue: { fontSize: 24, fontWeight: '900', marginVertical: 4 },
  priceHint: { fontSize: 12, textAlign: 'center', lineHeight: 17 },
  infoBox: {
    width: '100%',
    borderRadius: 14,
    padding: Spacing.three,
    gap: 6,
    marginBottom: Spacing.three,
  },
  infoTitle: { fontSize: 13, fontWeight: '800' },
  infoDesc: { fontSize: 13, lineHeight: 19 },
  errorBox: { width: '100%', backgroundColor: '#FEE2E2', padding: 10, borderRadius: 10, marginBottom: 10 },
  errorText: { color: '#B91C1C', fontSize: 13, textAlign: 'center', fontWeight: '600' },
  actions: { width: '100%', gap: 10 },
  primaryBtn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryBtn: { borderRadius: 14, borderWidth: 1.5, paddingVertical: 13, alignItems: 'center' },
  secondaryBtnText: { fontSize: 14, fontWeight: '700' },
  cancelBtn: { paddingVertical: 10, alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '600' },
});
