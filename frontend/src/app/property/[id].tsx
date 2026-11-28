import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  Calendar,
  Droplets,
  FileText,
  Film,
  Heart,
  Lock,
  MapPin,
  Route,
  ShieldCheck,
  Sparkles,
  Unlock,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
import { usePlatformConfig } from '@/context/platform-config-context';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { getStorageBaseUrl, proprietesApi, visitesApi } from '@/services/api';
import { favoritesStorage } from '@/services/local-store';
import type { BackendProperty } from '@/types/api';
import { formatFcfa, resolveStorageUrl } from '@/types/property';
import { showMessage } from '@/utils/dialog';
import { formatLocalFutureDate, getStatusDisplay, isFutureDateString } from '@/utils/validation';

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isDesktop, contentMaxWidth, horizontalPadding } = useResponsive();
  const { user, isAuthenticated, isAgentMobilier, isAdminStaff, openAuthModal } = useAuth();
  const { tarifs } = usePlatformConfig();
  const storageBaseUrl = useMemo(() => getStorageBaseUrl(), []);

  const [property, setProperty] = useState<BackendProperty | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [unlockCheckoutOpen, setUnlockCheckoutOpen] = useState(false);
  const [visitCheckoutOpen, setVisitCheckoutOpen] = useState(false);
  const [pendingVisitDate, setPendingVisitDate] = useState(() => formatLocalFutureDate(1, 10));
  const [visitDateError, setVisitDateError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErrorMsg(null);
    setActivePhotoIndex(0);

    const favs = await favoritesStorage.getAll();
    setIsFavorite(favs.has(String(id)));

    const res = await proprietesApi.getById(id);
    if (res.success && res.data) {
      setProperty(res.data);
    } else {
      setProperty(null);
      setErrorMsg(res.message || 'Impossible de charger les détails de cette propriété.');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleToggleFavorite = async () => {
    if (!id) return;
    const next = await favoritesStorage.toggle(String(id));
    setIsFavorite(next.has(String(id)));
  };

  const images = useMemo(() => {
    if (!property?.media) return [];
    const list = property.media
      .filter((m) => m.media_type !== 'video')
      .map((m) => resolveStorageUrl(m.media_url, storageBaseUrl))
      .filter((u): u is string => Boolean(u));
    return property.is_unlocked ? list : list.slice(0, 1);
  }, [property, storageBaseUrl]);

  const videos = useMemo(() => {
    if (!property?.media || !property.is_unlocked) return [];
    return property.media
      .filter((m) => m.media_type === 'video')
      .map((m) => ({
        id: m.id,
        url: resolveStorageUrl(m.media_url, storageBaseUrl),
      }))
      .filter((v): v is { id: number; url: string } => Boolean(v.url));
  }, [property, storageBaseUrl]);

  const propertyTitle = property
    ? `${property.type === 'parcelle' ? 'Parcelle' : property.type === 'chambre' ? 'Chambre' : 'Maison'} ${
        property.transaction_type === 'location' ? 'à louer' : 'à vendre'
      } — ${property.commune}`
    : 'Détail du bien';

  const publicLocation = property
    ? [property.quartier, property.arrondissement, property.commune].filter(Boolean).join(', ')
    : '';

  const isOwnProperty = Boolean(property && user && String(property.user_id) === String(user.id));
  const statusDisplay = property ? getStatusDisplay(property.status) : null;
  const unlockFee = property?.unlock_fee ?? tarifs?.deblocage_coordonnees;
  const visitFee = property?.visit_fee ?? tarifs?.visite;

  const handleStartVisitCheckout = () => {
    setVisitDateError(null);
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    if (isOwnProperty) {
      showMessage('Action impossible', 'Vous ne pouvez pas demander une visite sur votre propre annonce.');
      return;
    }
    const trimmed = pendingVisitDate.trim();
    if (!trimmed || !isFutureDateString(trimmed)) {
      setVisitDateError('Veuillez saisir une date et heure future valide (ex: 2026-12-01 10:00).');
      return;
    }
    setVisitCheckoutOpen(true);
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title={propertyTitle}
        subtitle={property ? (property.transaction_type === 'location' ? 'À LOUER' : 'À VENDRE') : undefined}
        rightAction={
          <Pressable onPress={handleToggleFavorite} style={styles.favHeaderBtn} hitSlop={8}>
            <Heart
              size={20}
              color={isFavorite ? '#EF4444' : '#FFFFFF'}
              fill={isFavorite ? '#EF4444' : 'transparent'}
              strokeWidth={2.2}
            />
          </Pressable>
        }
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Chargement du bien...</Text>
        </View>
      ) : errorMsg || !property ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: theme.text }]}>
            {errorMsg || 'Propriété introuvable.'}
          </Text>
          <Pressable onPress={loadDetail} style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
            <Text style={styles.primaryBtnText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            {
              paddingHorizontal: horizontalPadding,
              paddingBottom: insets.bottom + 40,
            },
          ]}>
          <View style={[styles.innerWrap, { maxWidth: contentMaxWidth }]}>
            <View style={[styles.layoutGrid, isDesktop && styles.layoutGridDesktop]}>
              {/* LEFT / MAIN COLUMN */}
              <View style={[styles.mainCol, isDesktop && { flex: 1.55 }]}>
                {/* Photo Gallery (1re photo seulement avant déblocage 50 F) */}
                <View
                  style={[
                    styles.galleryCard,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}>
                  {images.length > 0 ? (
                    <>
                      <Image
                        source={{ uri: images[activePhotoIndex] || images[0] }}
                        style={[styles.heroImg, isDesktop && styles.heroImgDesktop]}
                        contentFit="cover"
                        transition={220}
                      />
                      {property.is_unlocked && images.length > 1 && (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.thumbRow}>
                          {images.map((uri, idx) => (
                            <Pressable
                              key={`${uri}-${idx}`}
                              onPress={() => setActivePhotoIndex(idx)}
                              style={[
                                styles.thumbWrap,
                                {
                                  borderColor: idx === activePhotoIndex ? theme.primary : 'transparent',
                                },
                              ]}>
                              <Image source={{ uri }} style={styles.thumbImg} contentFit="cover" />
                            </Pressable>
                          ))}
                        </ScrollView>
                      )}
                    </>
                  ) : (
                    <View style={[styles.noMediaBox, { backgroundColor: theme.backgroundElement }]}>
                      <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>
                        Aucune photo disponible
                      </Text>
                    </View>
                  )}
                </View>

                {/* Aperçu public minimal (toujours visible) */}
                <View
                  style={[
                    styles.card,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}>
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceText, { color: theme.primary }]}>
                      {formatFcfa(property.prix)}
                      {property.transaction_type === 'location' ? '/mois' : ''}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      {property.is_negotiable && (
                        <View style={[styles.pill, { backgroundColor: theme.badgeGoldBg }]}>
                          <Text style={{ color: theme.badgeGoldText, fontSize: 11, fontWeight: '800' }}>
                            NÉGOCIABLE
                          </Text>
                        </View>
                      )}
                      {statusDisplay && (
                        <View style={[styles.pill, { backgroundColor: statusDisplay.bg }]}>
                          <Text style={{ color: statusDisplay.text, fontSize: 11, fontWeight: '800' }}>
                            {statusDisplay.label}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.inlineIconRow}>
                    <MapPin size={16} color={theme.primary} strokeWidth={2.2} />
                    <Text style={[styles.locationTitle, { color: theme.text, flex: 1 }]}>
                      {publicLocation}
                    </Text>
                  </View>

                  <View style={styles.specsGrid}>
                    <SpecBadge label="Type" value={property.type.toUpperCase()} theme={theme} />
                    {property.surface && Number(property.surface) > 0 ? (
                      <SpecBadge label="Surface" value={`${property.surface} m²`} theme={theme} />
                    ) : null}
                    {property.nombres_chambres ? (
                      <SpecBadge label="Chambres" value={`${property.nombres_chambres}`} theme={theme} />
                    ) : null}
                    {property.transaction_type === 'location' && property.avance_mois ? (
                      <SpecBadge label="Avance" value={`${property.avance_mois} mois`} theme={theme} />
                    ) : null}
                  </View>
                </View>

                {/* BLOC VERROUILLÉ (50 F) OU DÉTAILS COMPLETS DÉBLOQUÉS */}
                {!property.is_unlocked ? (
                  <View
                    style={[
                      styles.lockedCard,
                      { backgroundColor: theme.cardBackground, borderColor: theme.primary },
                    ]}>
                    <View style={[styles.lockCircle, { backgroundColor: theme.primaryLight }]}>
                      <Lock size={26} color={theme.primary} strokeWidth={2.2} />
                    </View>
                    <Text style={[styles.lockedTitle, { color: theme.text }]}>
                      Informations détaillées verrouillées
                    </Text>
                    <Text style={[styles.lockedDesc, { color: theme.textSecondary }]}>
                      Pour consulter la description complète, l'accessibilité, les équipements
                      (eau/électricité), toutes les photos & vidéos, les repères exacts et les
                      documents justificatifs, réglez les frais uniques de déblocage.
                    </Text>
                    <Pressable
                      onPress={() => {
                        if (!isAuthenticated) openAuthModal('login');
                        else setUnlockCheckoutOpen(true);
                      }}
                      style={[styles.primaryBtn, { backgroundColor: theme.primary, width: '100%' }]}>
                      <Text style={styles.primaryBtnText}>
                        {unlockFee !== undefined
                          ? `Débloquer les informations du bien (${unlockFee} F CFA)`
                          : 'Débloquer les informations du bien'}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.card,
                      { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                    ]}>
                    <View style={styles.inlineIconRow}>
                      <Unlock size={17} color={theme.primary} strokeWidth={2.2} />
                      <Text style={[styles.sectionTitle, { color: theme.text, flex: 1 }]}>
                        Détails complets & Documents débloqués
                      </Text>
                    </View>

                    {property.accessibilite ? (
                      <View style={styles.inlineIconRow}>
                        <Route size={15} color={theme.primary} strokeWidth={2} />
                        <Text style={[styles.detailLine, { color: theme.textSecondary, flex: 1 }]}>
                          Accessibilité :{' '}
                          <Text style={{ color: theme.text, fontWeight: '700' }}>
                            {property.accessibilite}
                          </Text>
                        </Text>
                      </View>
                    ) : null}

                    {property.eau_courant ? (
                      <View style={styles.inlineIconRow}>
                        <Droplets size={15} color={theme.primary} strokeWidth={2} />
                        <Text style={[styles.detailLine, { color: theme.textSecondary, flex: 1 }]}>
                          Eau & Électricité :{' '}
                          <Text style={{ color: theme.text, fontWeight: '700' }}>
                            {property.eau_courant}
                          </Text>
                        </Text>
                      </View>
                    ) : null}

                    {property.location_details ? (
                      <View style={[styles.infoHighlight, { backgroundColor: theme.backgroundElement }]}>
                        <Text style={[styles.docHeader, { color: theme.text }]}>
                          Repères & Localisation précise
                        </Text>
                        <Text style={[styles.detailLine, { color: theme.text }]}>
                          {property.location_details}
                        </Text>
                      </View>
                    ) : null}

                    {property.description ? (
                      <View style={{ gap: 4, marginTop: 4 }}>
                        <Text style={[styles.docHeader, { color: theme.text }]}>Description</Text>
                        <Text style={[styles.description, { color: theme.text }]}>
                          {property.description}
                        </Text>
                      </View>
                    ) : null}

                    {/* Vidéos du bien (affichées uniquement après déblocage 50 F) */}
                    {videos.length > 0 && (
                      <View style={{ gap: 8, marginTop: 6 }}>
                        <View style={styles.inlineIconRow}>
                          <Film size={16} color={theme.primary} strokeWidth={2.2} />
                          <Text style={[styles.docHeader, { color: theme.text }]}>
                            Vidéos du bien ({videos.length})
                          </Text>
                        </View>
                        {videos.map((vid, idx) =>
                          Platform.OS === 'web' ? (
                            <View key={vid.id} style={styles.videoWrap}>
                              {React.createElement('video', {
                                src: vid.url,
                                controls: true,
                                style: {
                                  width: '100%',
                                  maxHeight: 280,
                                  borderRadius: 12,
                                  backgroundColor: '#0F172A',
                                },
                              })}
                            </View>
                          ) : (
                            <Pressable
                              key={vid.id}
                              onPress={() => void WebBrowser.openBrowserAsync(vid.url)}
                              style={[styles.docRow, { borderColor: theme.cardBorder }]}>
                              <Film size={16} color={theme.primary} strokeWidth={2} />
                              <Text style={{ color: theme.text, fontWeight: '700', flex: 1 }}>
                                Vidéo #{idx + 1}
                              </Text>
                              <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 12 }}>
                                Lire
                              </Text>
                            </Pressable>
                          )
                        )}
                      </View>
                    )}

                    {/* Documents légaux */}
                    {property.documents && property.documents.length > 0 ? (
                      <View style={{ gap: 8, marginTop: 6 }}>
                        <Text style={[styles.docHeader, { color: theme.text }]}>
                          Documents justificatifs ({property.documents.length}) :
                        </Text>
                        {property.documents.map((doc) => {
                          const docUrl = resolveStorageUrl(
                            doc.document_url || doc.url_consultation,
                            storageBaseUrl
                          );
                          return (
                            <Pressable
                              key={doc.id}
                              onPress={() => docUrl && void WebBrowser.openBrowserAsync(docUrl)}
                              style={[styles.docRow, { borderColor: theme.cardBorder }]}>
                              <FileText size={16} color={theme.primary} strokeWidth={2} />
                              <Text style={{ color: theme.text, fontWeight: '700', flex: 1 }}>
                                {(doc.document_type || doc.type || 'Document').replace(/_/g, ' ').toUpperCase()}
                              </Text>
                              <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 12 }}>
                                Ouvrir
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                )}
              </View>

              {/* RIGHT / ACTION SIDEBAR (MONOPOLE E-MOBILIER : VISITE PHYSIQUE PAYANTE 500 F UNIQUEMENT) */}
              <View style={[styles.sideCol, isDesktop && { flex: 1 }]}>
                <View style={[styles.actionsPanel, { backgroundColor: theme.navy }]}>
                  <View style={styles.inlineIconRow}>
                    <Sparkles size={13} color="#FDE68A" strokeWidth={2.2} />
                    <Text style={styles.panelEyebrow}>VISITE ENCADRÉE E-MOBILIER</Text>
                  </View>
                  <Text style={styles.panelTitle}>Demander une visite physique</Text>
                  <Text style={styles.panelDesc}>
                    Choisissez la date et l'heure souhaitées. Un conseiller terrain E-Mobilier
                    organise et encadre votre visite sur place.
                  </Text>

                  {/* Quick Date Presets */}
                  <View style={styles.presetRow}>
                    {[
                      { label: 'Demain 10h', val: formatLocalFutureDate(1, 10) },
                      { label: 'Demain 15h', val: formatLocalFutureDate(1, 15) },
                      { label: 'J+2 10h', val: formatLocalFutureDate(2, 10) },
                    ].map((preset) => {
                      const active = pendingVisitDate === preset.val;
                      return (
                        <Pressable
                          key={preset.label}
                          onPress={() => {
                            setPendingVisitDate(preset.val);
                            setVisitDateError(null);
                          }}
                          style={[
                            styles.presetPill,
                            active && { backgroundColor: theme.primary, borderColor: theme.primary },
                          ]}>
                          <Text style={styles.presetPillText}>{preset.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={styles.dateFieldLabel}>Date et heure souhaitées (AAAA-MM-JJ HH:mm)</Text>
                    <View style={styles.dateInputRow}>
                      <Calendar size={15} color="#CBD5E1" strokeWidth={2} />
                      <TextInput
                        style={styles.dateInput}
                        value={pendingVisitDate}
                        onChangeText={(txt) => {
                          setPendingVisitDate(txt);
                          setVisitDateError(null);
                        }}
                        placeholder="2026-12-01 10:00"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                    {visitDateError ? <Text style={styles.dateError}>{visitDateError}</Text> : null}
                  </View>

                  <Pressable
                    onPress={handleStartVisitCheckout}
                    disabled={isOwnProperty}
                    style={[
                      styles.goldActionBtn,
                      { backgroundColor: '#F59E0B', opacity: isOwnProperty ? 0.5 : 1 },
                    ]}>
                    <Calendar size={16} color="#0F172A" strokeWidth={2.2} />
                    <Text style={styles.goldActionText}>
                      {isOwnProperty
                        ? 'Votre propre annonce'
                        : visitFee !== undefined
                        ? `Demander une visite (${visitFee} F CFA)`
                        : 'Demander une visite physique'}
                    </Text>
                  </Pressable>
                </View>

                {/* Guarantees Card (Anti-contournement) */}
                <View
                  style={[
                    styles.card,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}>
                  <View style={styles.inlineIconRow}>
                    <ShieldCheck size={17} color={theme.primary} strokeWidth={2.2} />
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                      Garanties & Monopole E-Mobilier
                    </Text>
                  </View>
                  <Text style={[styles.detailLine, { color: theme.textSecondary }]}>
                    • Aucun contact direct non vérifié : toute visite est encadrée exclusivement par E-Mobilier.
                  </Text>
                  <Text style={[styles.detailLine, { color: theme.textSecondary }]}>
                    • Vérification des pièces et titres fonciers avant publication.
                  </Text>
                  <Text style={[styles.detailLine, { color: theme.textSecondary }]}>
                    • Quittance officielle Kkiapay et suivi dans votre onglet Visites.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Unlock Checkout (50 FCFA / dynamique) */}
      {property && (
        <KkiapayCheckoutModal
          visible={unlockCheckoutOpen}
          operationType="deblocage_coordonnees"
          entityId={property.id}
          title={`Débloquer Bien #${property.id}`}
          description={
            unlockFee !== undefined
              ? `Règlement unique de ${unlockFee} F CFA pour accéder aux détails complets, médias et documents du bien.`
              : 'Règlement officiel pour accéder aux détails complets du bien.'
          }
          onClose={() => setUnlockCheckoutOpen(false)}
          onSuccess={async ({ transactionId, internalReference }) => {
            const res = await proprietesApi.unlockDetails(property.id, transactionId, internalReference);
            if (!res.success || !res.data) {
              throw new Error(res.message || 'Échec du déblocage.');
            }
            setProperty(res.data);
            setUnlockCheckoutOpen(false);
            showMessage('Fiche débloquée', 'Les informations détaillées et documents du bien sont désormais accessibles.');
          }}
        />
      )}

      {/* Visit Checkout (500 FCFA / dynamique) */}
      {property && (
        <KkiapayCheckoutModal
          visible={visitCheckoutOpen}
          operationType="visite"
          entityId={property.id}
          title={
            visitFee !== undefined
              ? `Frais de visite physique (${visitFee} F CFA)`
              : 'Frais de visite physique'
          }
          description={`Visite physique encadrée prévue le ${pendingVisitDate} pour le bien #${property.id}.`}
          onClose={() => setVisitCheckoutOpen(false)}
          onSuccess={async ({ transactionId, internalReference }) => {
            const res = await visitesApi.requestVisit({
              property_id: property.id,
              scheduled_date: pendingVisitDate.trim(),
              kkiapay_transaction_id: transactionId,
              payment_reference: internalReference,
            });
            if (!res.success) {
              throw new Error(res.message || "Impossible d'enregistrer la visite.");
            }
            setVisitCheckoutOpen(false);
            showMessage(
              'Visite enregistrée',
              res.message || 'Votre demande de visite physique encadrée est confirmée.'
            );
            router.push((isAgentMobilier && !isAdminStaff ? '/agent-space' : '/client?tab=visites') as any);
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
  favHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.four, gap: 12 },
  errorText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  scroll: { paddingTop: Spacing.three },
  innerWrap: { width: '100%', alignSelf: 'center' },
  layoutGrid: { gap: 16 },
  layoutGridDesktop: { flexDirection: 'row', alignItems: 'flex-start', gap: 22 },
  mainCol: { gap: 14 },
  sideCol: { gap: 14 },
  galleryCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  heroImg: { width: '100%', aspectRatio: 16 / 10, minHeight: 195, maxHeight: 340, backgroundColor: '#E2E8F0' },
  heroImgDesktop: { aspectRatio: 16 / 10, maxHeight: 440 },
  noMediaBox: { height: 220, alignItems: 'center', justifyContent: 'center' },
  thumbRow: { padding: 10, gap: 8 },
  thumbWrap: { borderRadius: 10, borderWidth: 2, overflow: 'hidden' },
  thumbImg: { width: 68, height: 50 },
  card: { borderRadius: 18, borderWidth: 1, padding: Spacing.four, gap: 10 },
  lockedCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: Spacing.four,
    alignItems: 'center',
    gap: 12,
  },
  lockCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedTitle: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
  lockedDesc: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  priceText: { fontSize: 22, fontWeight: '900' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  locationTitle: { fontSize: 15, fontWeight: '700' },
  specsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  specItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, minWidth: 85, flexGrow: 1, gap: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  detailLine: { fontSize: 13, lineHeight: 20 },
  description: { fontSize: 14, lineHeight: 21 },
  infoHighlight: { borderRadius: 12, padding: 12, gap: 4 },
  docHeader: { fontSize: 13, fontWeight: '800' },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  videoWrap: { width: '100%', overflow: 'hidden', borderRadius: 12 },
  inlineIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionsPanel: { borderRadius: 20, padding: Spacing.four, gap: 12 },
  panelEyebrow: { color: '#FDE68A', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  panelTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  panelDesc: { color: '#CBD5E1', fontSize: 13, lineHeight: 19 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  presetPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  presetPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  dateFieldLabel: { color: '#E2E8F0', fontSize: 11, fontWeight: '700' },
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(15,23,42,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateInput: { flex: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  dateError: { color: '#FCA5A5', fontSize: 12, fontWeight: '700' },
  goldActionBtn: {
    borderRadius: 14,
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  goldActionText: { color: '#0F172A', fontSize: 14, fontWeight: '900', textAlign: 'center', flexShrink: 1 },
  primaryBtn: { borderRadius: 14, minHeight: 48, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', textAlign: 'center' },
});
