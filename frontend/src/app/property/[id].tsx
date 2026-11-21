import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { KkiapayCheckoutModal } from '@/components/kkiapay-checkout-modal';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { getStorageBaseUrl, proprietesApi, visitesApi } from '@/services/api';
import type { BackendProperty } from '@/types/api';
import { formatFcfa, resolveStorageUrl } from '@/types/property';

function toLocalIsoFuture(daysAhead: number, hour: number): string {
  const d = new Date(Date.now() + daysAhead * 86400 * 1000);
  d.setHours(hour, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:00:00`;
}

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, openAuthModal } = useAuth();
  const storageBaseUrl = useMemo(() => getStorageBaseUrl(), []);

  const [property, setProperty] = useState<BackendProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [unlockCheckoutOpen, setUnlockCheckoutOpen] = useState(false);
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [visitDateInput, setVisitDateInput] = useState(() => toLocalIsoFuture(1, 10));
  const [visitCheckoutOpen, setVisitCheckoutOpen] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErrorMsg(null);
    const res = await proprietesApi.getById(id);
    if (res.success && res.data) {
      setProperty(res.data);
    } else {
      setErrorMsg(res.message || 'Impossible de charger les détails du bien.');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleOpenVisitFlow = () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    setVisitModalOpen(true);
  };

  const handleProceedVisitPayment = () => {
    const parsed = new Date(visitDateInput.replace(' ', 'T'));
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
      Alert.alert('Date invalide', 'Veuillez saisir une date future valide (ex: AAAA-MM-JJ HH:MM:SS).');
      return;
    }
    setVisitModalOpen(false);
    setVisitCheckoutOpen(true);
  };

  const images = useMemo(() => {
    if (!property?.media) return [];
    return property.media
      .filter((m) => m.media_type !== 'video')
      .map((m) => resolveStorageUrl(m.media_url, storageBaseUrl))
      .filter((u): u is string => Boolean(u));
  }, [property, storageBaseUrl]);

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title={property ? `${property.type.toUpperCase()} — ${property.commune}` : 'Détail du bien'}
        subtitle={property ? (property.transaction_type === 'location' ? 'À LOUER' : 'À VENDRE') : undefined}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : errorMsg || !property ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: theme.text }]}>{errorMsg || 'Bien introuvable.'}</Text>
          <Pressable onPress={loadDetail} style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
            <Text style={styles.primaryBtnText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 36 }]}>
          {/* Media gallery */}
          {images.length > 0 ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.gallery}>
              {images.map((uri, idx) => (
                <Image key={`${uri}-${idx}`} source={{ uri }} style={styles.heroImg} contentFit="cover" />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.noMediaBox, { backgroundColor: theme.backgroundElement }]}>
              <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Aucune photo disponible</Text>
            </View>
          )}

          {/* Main Info */}
          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.priceRow}>
              <Text style={[styles.priceText, { color: theme.primaryDark }]}>
                {formatFcfa(property.prix)}
                {property.transaction_type === 'location' ? '/mois' : ''}
              </Text>
              {property.is_negotiable && (
                <View style={[styles.pill, { backgroundColor: theme.badgeGoldBg }]}>
                  <Text style={{ color: theme.badgeGoldText, fontSize: 11, fontWeight: '800' }}>NÉGOCIABLE</Text>
                </View>
              )}
            </View>

            <Text style={[styles.locationTitle, { color: theme.text }]}>
              {[property.quartier, property.arrondissement, property.commune].filter(Boolean).join(', ')}
            </Text>

            <View style={styles.specsGrid}>
              <SpecBadge label="Surface" value={`${property.surface} m²`} theme={theme} />
              {property.nombres_chambres ? (
                <SpecBadge label="Chambres" value={`${property.nombres_chambres}`} theme={theme} />
              ) : null}
              {property.transaction_type === 'location' && property.avance_mois ? (
                <SpecBadge label="Avance" value={`${property.avance_mois} mois`} theme={theme} />
              ) : null}
              <SpecBadge label="Statut" value={property.status} theme={theme} />
            </View>

            {property.accessibilite && (
              <Text style={[styles.detailLine, { color: theme.textSecondary }]}>
                🛣️ Accessibilité : <Text style={{ color: theme.text, fontWeight: '600' }}>{property.accessibilite}</Text>
              </Text>
            )}
            {property.eau_courant && (
              <Text style={[styles.detailLine, { color: theme.textSecondary }]}>
                💧 Eau & Électricité : <Text style={{ color: theme.text, fontWeight: '600' }}>{property.eau_courant}</Text>
              </Text>
            )}
            {property.description && (
              <Text style={[styles.description, { color: theme.text }]}>{property.description}</Text>
            )}
          </View>

          {/* Coordinates & Documents Section (50 FCFA unlock gate) */}
          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {property.is_unlocked ? '🔓 Coordonnées & Documents Débloqués' : '🔒 Coordonnées & Documents Protégés'}
            </Text>
            <Text style={[styles.detailLine, { color: theme.textSecondary }]}>
              {property.location_details || 'Repères précis non renseignés.'}
            </Text>

            {property.user && (
              <View style={[styles.contactBox, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.contactName, { color: theme.text }]}>
                  {property.user.prenom ? `${property.user.prenom} ${property.user.name}` : property.user.name}
                </Text>
                {property.user.telephone ? (
                  <Text style={[styles.contactLine, { color: theme.primaryDark }]}>
                    📞 {property.user.telephone}
                  </Text>
                ) : null}
                {property.user.email ? (
                  <Text style={[styles.contactLine, { color: theme.textSecondary }]}>
                    ✉️ {property.user.email}
                  </Text>
                ) : null}
              </View>
            )}

            {property.is_unlocked && property.documents && property.documents.length > 0 && (
              <View style={{ gap: 8, marginTop: 6 }}>
                <Text style={[styles.docHeader, { color: theme.text }]}>Documents justificatifs :</Text>
                {property.documents.map((doc) => {
                  const docUrl = resolveStorageUrl(doc.document_url || doc.url_consultation, storageBaseUrl);
                  return (
                    <Pressable
                      key={doc.id}
                      onPress={() => docUrl && WebBrowser.openBrowserAsync(docUrl)}
                      style={[styles.docRow, { borderColor: theme.cardBorder }]}>
                      <Text style={{ color: theme.text, fontWeight: '700', flex: 1 }}>
                        📄 {(doc.document_type || doc.type || 'Document').toUpperCase()}
                      </Text>
                      <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 12 }}>Ouvrir</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {!property.is_unlocked && (
              <Pressable
                onPress={() => {
                  if (!isAuthenticated) openAuthModal('login');
                  else setUnlockCheckoutOpen(true);
                }}
                style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
                <Text style={styles.primaryBtnText}>
                  Débloquer coordonnées & documents ({property.unlock_fee ?? 50} F)
                </Text>
              </Pressable>
            )}
          </View>

          {/* Physical Visit CTA (500 FCFA) */}
          <View style={[styles.card, { backgroundColor: theme.navy }]}>
            <Text style={styles.visitCtaTitle}>Visiter ce bien physiquement</Text>
            <Text style={styles.visitCtaDesc}>
              Un conseiller terrain E-Mobilier organise et sécurise votre visite (Frais officiels : {property.visit_fee ?? 500} F CFA).
            </Text>
            <Pressable
              onPress={handleOpenVisitFlow}
              style={[styles.visitBtn, { backgroundColor: theme.gold }]}>
              <Text style={styles.visitBtnText}>Planifier une visite ({property.visit_fee ?? 500} F)</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {/* Unlock 50 FCFA Checkout */}
      {property && (
        <KkiapayCheckoutModal
          visible={unlockCheckoutOpen}
          operationType="deblocage_coordonnees"
          entityId={property.id}
          title={`Débloquer Bien #${property.id}`}
          description="Règlement de 50 F CFA pour révéler les coordonnées et documents du bien."
          onClose={() => setUnlockCheckoutOpen(false)}
          onSuccess={async ({ transactionId }) => {
            const res = await proprietesApi.unlockDetails(property.id, transactionId);
            if (!res.success || !res.data) {
              throw new Error(res.message || 'Échec du déblocage.');
            }
            setProperty(res.data);
            setUnlockCheckoutOpen(false);
            Alert.alert('Succès', 'Coordonnées et documents débloqués !');
          }}
        />
      )}

      {/* Visit Date Picker Modal */}
      <Modal visible={visitModalOpen} transparent animationType="fade" onRequestClose={() => setVisitModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Choisir la date de visite</Text>
            <View style={styles.presets}>
              <Pressable
                onPress={() => setVisitDateInput(toLocalIsoFuture(1, 10))}
                style={[styles.presetBtn, { backgroundColor: theme.backgroundElement }]}>
                <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>Demain 10h00</Text>
              </Pressable>
              <Pressable
                onPress={() => setVisitDateInput(toLocalIsoFuture(2, 15))}
                style={[styles.presetBtn, { backgroundColor: theme.backgroundElement }]}>
                <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>Dans 2 jours 15h00</Text>
              </Pressable>
              <Pressable
                onPress={() => setVisitDateInput(toLocalIsoFuture(3, 9))}
                style={[styles.presetBtn, { backgroundColor: theme.backgroundElement }]}>
                <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>Dans 3 jours 09h00</Text>
              </Pressable>
            </View>

            <TextInput
              style={[styles.dateInput, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
              value={visitDateInput}
              onChangeText={setVisitDateInput}
              placeholder="AAAA-MM-JJ HH:MM:SS"
              placeholderTextColor={theme.textSecondary}
            />

            <View style={styles.modalActions}>
              <Pressable onPress={handleProceedVisitPayment} style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
                <Text style={styles.primaryBtnText}>Continuer vers paiement (500 F)</Text>
              </Pressable>
              <Pressable onPress={() => setVisitModalOpen(false)} style={styles.cancelLink}>
                <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Annuler</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Visit 500 FCFA Checkout */}
      {property && (
        <KkiapayCheckoutModal
          visible={visitCheckoutOpen}
          operationType="visite"
          entityId={property.id}
          title="Frais de visite physique (500 F)"
          description={`Visite prévue le ${visitDateInput} pour le bien #${property.id}.`}
          onClose={() => setVisitCheckoutOpen(false)}
          onSuccess={async ({ transactionId }) => {
            const res = await visitesApi.requestVisit({
              property_id: property.id,
              scheduled_date: visitDateInput,
              kkiapay_transaction_id: transactionId,
            });
            if (!res.success) {
              throw new Error(res.message || "Impossible d'enregistrer la visite.");
            }
            setVisitCheckoutOpen(false);
            Alert.alert('Visite enregistrée !', res.message || 'Votre demande de visite est confirmée.', [
              { text: 'Voir mes visites', onPress: () => router.push('/visits' as any) },
              { text: 'OK' },
            ]);
          }}
        />
      )}
    </SafeAreaView>
  );
}

function SpecBadge({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={[styles.specItem, { backgroundColor: theme.backgroundElement }]}>
      <Text style={{ fontSize: 11, color: theme.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '800', color: theme.text }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.four, gap: 12 },
  errorText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  scroll: {
    gap: Spacing.three,
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center',
  },
  gallery: { height: 260 },
  heroImg: { width: 380, height: 260 },
  noMediaBox: { height: 180, alignItems: 'center', justifyContent: 'center' },
  card: {
    marginHorizontal: Spacing.three,
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 10,
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceText: { fontSize: 22, fontWeight: '900' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  locationTitle: { fontSize: 16, fontWeight: '800' },
  specsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  detailLine: { fontSize: 13, lineHeight: 19 },
  description: { fontSize: 14, lineHeight: 21, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  contactBox: { borderRadius: 12, padding: Spacing.three, gap: 4 },
  contactName: { fontSize: 15, fontWeight: '800' },
  contactLine: { fontSize: 13, fontWeight: '600' },
  docHeader: { fontSize: 13, fontWeight: '800' },
  docRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 10 },
  primaryBtn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  visitCtaTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  visitCtaDesc: { color: '#CBD5E1', fontSize: 13, lineHeight: 19 },
  visitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  visitBtnText: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.65)', justifyContent: 'center', padding: Spacing.four },
  modalCard: { borderRadius: 20, borderWidth: 1, padding: Spacing.four, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  dateInput: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14 },
  modalActions: { gap: 8, marginTop: 4 },
  cancelLink: { alignItems: 'center', paddingVertical: 8 },
});
