import { SymbolView } from 'expo-symbols';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { KkiapayCheckoutModal } from '@/components/kkiapay-checkout-modal';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { proprietesApi } from '@/services/api';
import type { BackendProperty } from '@/types/api';
import { formatFcfa, PropertyItem } from '@/types/property';

interface UnlockModalProps {
  visible: boolean;
  property: PropertyItem | null;
  onClose: () => void;
  onConfirm?: (property: PropertyItem, updatedBackend?: BackendProperty) => void;
  onConfirmUnlock?: (property: PropertyItem, updatedBackend?: BackendProperty) => void;
  onOpenFullDetails?: (property: PropertyItem) => void;
}

export function UnlockModal({
  visible,
  property,
  onClose,
  onConfirm,
  onConfirmUnlock,
  onOpenFullDetails,
}: UnlockModalProps) {
  const theme = useTheme();
  const { isAuthenticated, openAuthModal } = useAuth();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!property) return null;

  const fee = property.unlockFee || 50;
  const notifyConfirm = onConfirm || onConfirmUnlock;

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
            style={[
              styles.card,
              { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
            ]}
            onPress={(e) => e.stopPropagation()}>
            {/* Header (Stitch exact) */}
            <View style={styles.modalHeaderRow}>
              <View style={styles.headerTitleRow}>
                <SymbolView
                  name={{ ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' }}
                  size={20}
                  tintColor={theme.primaryContainer}
                />
                <Text style={[styles.title, { color: theme.text }]}>Démasquage Sécurisé</Text>
              </View>

              <Pressable
                onPress={onClose}
                hitSlop={8}
                style={[styles.closeBtn, { backgroundColor: theme.surfaceContainerLow }]}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={14}
                  tintColor={theme.text}
                />
              </Pressable>
            </View>

            {property.isUnlocked ? (
              <View style={[styles.infoBox, { backgroundColor: theme.badgeGreenBg }]}>
                <Text style={[styles.infoTitle, { color: theme.badgeGreenText }]}>
                  Accès direct actif
                </Text>
                <Text style={[styles.infoDesc, { color: theme.text }]}>
                  {property.locationDetails || property.location.fullAddress}
                </Text>
                {property.owner?.telephone && (
                  <Text style={[styles.contactLine, { color: theme.primaryContainer }]}>
                    📞 {property.owner.name} — {property.owner.telephone}
                  </Text>
                )}
              </View>
            ) : (
              /* TTL Box (Stitch exact) */
              <View
                style={[
                  styles.ttlBox,
                  { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder },
                ]}>
                <Text style={[styles.ttlTag, { color: theme.primaryContainer }]}>
                  SESSION TTL DE 15 MINUTES
                </Text>
                <Text style={[styles.ttlFee, { color: theme.text }]}>{formatFcfa(fee)}</Text>
                <Text style={[styles.ttlNotice, { color: theme.textSecondary }]}>
                  Débit instantané Mobile Money (MTN / Moov / Celtiis)
                </Text>
              </View>
            )}

            <Text style={[styles.description, { color: theme.textSecondary }]}>
              Accès direct aux coordonnées du propriétaire et repères parcellaires certifiés ANDF.
              Protégé contre le démarchage sauvage et la spéculation illégale.
            </Text>

            {errorMsg ? (
              <View style={[styles.errorBox, { backgroundColor: theme.errorContainer }]}>
                <Text style={[styles.errorText, { color: theme.error }]}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* CTA */}
            {property.isUnlocked ? (
              <Pressable
                onPress={() => {
                  onClose();
                  onOpenFullDetails?.(property);
                }}
                style={[styles.actionBtn, { backgroundColor: theme.primaryContainer }]}>
                <Text style={styles.actionBtnText}>Consulter la Fiche Complète</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleStartUnlock}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: theme.primaryContainer },
                  pressed && { opacity: 0.9 },
                ]}>
                <SymbolView
                  name={{ ios: 'key.fill', android: 'key', web: 'key' }}
                  size={16}
                  tintColor="#FFFFFF"
                />
                <Text style={styles.actionBtnText}>
                  Confirmer et Débloquer ({fee} F)
                </Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Kkiapay Checkout */}
      <KkiapayCheckoutModal
        visible={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        operationType="deblocage_coordonnees"
        proprieteId={property.id}
        amount={fee}
        title="Démasquage Notarié TTL"
        description={`Accès immédiat de 15 min pour : ${property.title}`}
        onSuccess={async () => {
          setCheckoutOpen(false);
          try {
            const res = await proprietesApi.demasquer(property.id);
            if (res.success && res.data) {
              notifyConfirm?.({ ...property, isUnlocked: true }, res.data);
            } else {
              notifyConfirm?.({ ...property, isUnlocked: true });
            }
          } catch {
            notifyConfirm?.({ ...property, isUnlocked: true });
          }
          onClose();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.four,
    gap: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ttlBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  ttlTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ttlFee: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  ttlNotice: {
    fontSize: 11,
  },
  infoBox: {
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  infoDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  contactLine: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
  },
  errorBox: {
    padding: 10,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 4,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
