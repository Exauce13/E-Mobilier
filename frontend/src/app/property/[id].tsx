import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  Calendar,
  Droplets,
  FileText,
  Heart,
  Home,
  Lock,
  Mail,
  MapPin,
  Phone,
  Route,
  Sparkles,
  Unlock,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { KkiapayCheckoutModal } from '@/components/kkiapay-checkout-modal';
import { PropertyActionModal, PropertyActionTab } from '@/components/property/property-action-modal';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { MOCK_PROPERTIES } from '@/data/mock-properties';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { getStorageBaseUrl, proprietesApi, visitesApi } from '@/services/api';
import { favoritesStorage } from '@/services/local-store';
import type { BackendProperty } from '@/types/api';
import { formatFcfa, resolveStorageUrl } from '@/types/property';
import { formatLocalFutureDate, getStatusDisplay } from '@/utils/validation';

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isDesktop, contentMaxWidth, horizontalPadding } = useResponsive();
  const { isAuthenticated, openAuthModal } = useAuth();
  const storageBaseUrl = useMemo(() => getStorageBaseUrl(), []);

  const [property, setProperty] = useState<BackendProperty | null>(null);
  const [fallbackImage, setFallbackImage] = useState<any>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [unlockCheckoutOpen, setUnlockCheckoutOpen] = useState(false);
  const [visitCheckoutOpen, setVisitCheckoutOpen] = useState(false);
  const [pendingVisitDate, setPendingVisitDate] = useState(() => formatLocalFutureDate(1, 10));

  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionModalTab, setActionModalTab] = useState<PropertyActionTab>('demande_visite');

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErrorMsg(null);
    setFallbackImage(null);

    const favs = await favoritesStorage.getAll();
    setIsFavorite(favs.has(String(id)));

    // Check if demo mock ID
    const mockMatch = MOCK_PROPERTIES.find((m) => m.id === String(id));
    if (mockMatch && Number.isNaN(Number(id))) {
      setFallbackImage(mockMatch.image);
      setProperty({
        id: 0,
        user_id: 0,
        type: mockMatch.type,
        transaction_type: mockMatch.transactionType,
        commune: mockMatch.location.commune,
        quartier: mockMatch.location.quartier,
        location_details: mockMatch.location.fullAddress,
        accessibilite: 'Voie pavée / Goudron proche',
        eau_courant: mockMatch.features.eauElectricite || 'SONEB + SBEE',
        surface: mockMatch.features.surface || 250,
        nombres_chambres: mockMatch.features.chambres || 0,
        prix: mockMatch.price,
        is_negotiable: true,
        description: `${mockMatch.title}. Bien sélectionné sur le catalogue E-Mobilier Bénin (${mockMatch.tags.join(', ')}).`,
        status: 'published',
        is_unlocked: false,
        unlock_fee: mockMatch.unlockFee,
        visit_fee: 500,
        user: {
          id: 0,
          name: 'Conseiller E-Mobilier Bénin',
          telephone: '+229 01 97 00 11 22',
          email: 'contact@e-mobilier.bj',
        },
      });
      setLoading(false);
      return;
    }

    const res = await proprietesApi.getById(id);
    if (res.success && res.data) {
      setProperty(res.data);
    } else if (mockMatch) {
      setFallbackImage(mockMatch.image);
      setProperty({
        id: 0,
        user_id: 0,
        type: mockMatch.type,
        transaction_type: mockMatch.transactionType,
        commune: mockMatch.location.commune,
        quartier: mockMatch.location.quartier,
        location_details: mockMatch.location.fullAddress,
        surface: mockMatch.features.surface || 250,
        nombres_chambres: mockMatch.features.chambres || 0,
        prix: mockMatch.price,
        status: 'published',
        is_unlocked: false,
        unlock_fee: mockMatch.unlockFee,
        visit_fee: 500,
      });
    } else {
      setErrorMsg(res.message || 'Impossible de charger les détails du bien.');
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

  const openActionModal = (tab: PropertyActionTab) => {
    setActionModalTab(tab);
    setActionModalOpen(true);
  };

  const images = useMemo(() => {
    if (!property?.media) return [];
    return property.media
      .filter((m) => m.media_type !== 'video')
      .map((m) => resolveStorageUrl(m.media_url, storageBaseUrl))
      .filter((u): u is string => Boolean(u));
  }, [property, storageBaseUrl]);

  const propertyTitle = property
    ? `${property.type === 'parcelle' ? 'Parcelle' : property.type === 'chambre' ? 'Chambre' : 'Maison'} ${property.transaction_type === 'location' ? 'à louer' : 'à vendre'
    } — ${property.commune}`
    : 'Détail du bien';

  const fullAddress = property
    ? [property.quartier, property.arrondissement, property.commune].filter(Boolean).join(', ')
    : '';

  const isRealBackendProperty = Boolean(property && property.id > 0);
  const statusDisplay = property ? getStatusDisplay(property.status) : null;

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title={propertyTitle}
        subtitle={property ? (property.transaction_type === 'location' ? 'À LOUER' : 'À VENDRE') : undefined}
        rightAction={
          <Pressable
            onPress={handleToggleFavorite}
            style={styles.favHeaderBtn}
            hitSlop={8}>
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
        </View>
      ) : errorMsg || !property ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: theme.text }]}>{errorMsg || 'Bien introuvable.'}</Text>
          <Pressable onPress={loadDetail} style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
            <Text style={styles.primaryBtnText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
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
                {/* Responsive Photo Gallery */}
                <View
                  style={[
                    styles.galleryCard,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}>
                  {images.length > 0 ? (
                    <>
                      <Image
                        source={{ uri: images[activePhotoIndex] || images[0] }}
                        style={[styles.heroImg, isDesktop && { height: 390 }]}
                        contentFit="cover"
                      />
                      {images.length > 1 && (
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
                                  borderColor:
                                    idx === activePhotoIndex ? theme.primary : 'transparent',
                                },
                              ]}>
                              <Image source={{ uri }} style={styles.thumbImg} contentFit="cover" />
                            </Pressable>
                          ))}
                        </ScrollView>
                      )}
                    </>
                  ) : fallbackImage ? (
                    <Image
                      source={fallbackImage}
                      style={[styles.heroImg, isDesktop && { height: 390 }]}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.noMediaBox, { backgroundColor: theme.backgroundElement }]}>
                      <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>
                        Aucune photo disponible
                      </Text>
                    </View>
                  )}
                </View>

                {/* Main Info Card */}
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
                    <View style={{ flexDirection: 'row', gap: 6 }}>
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
                      {fullAddress}
                    </Text>
                  </View>

                  <View style={styles.specsGrid}>
                    <SpecBadge label="Type" value={property.type.toUpperCase()} theme={theme} />
                    <SpecBadge label="Surface" value={`${property.surface} m²`} theme={theme} />
                    {property.nombres_chambres ? (
                      <SpecBadge label="Chambres" value={`${property.nombres_chambres}`} theme={theme} />
                    ) : null}
                    {property.transaction_type === 'location' && property.avance_mois ? (
                      <SpecBadge label="Avance" value={`${property.avance_mois} mois`} theme={theme} />
                    ) : null}
                  </View>

                  {property.accessibilite && (
                    <View style={styles.inlineIconRow}>
                      <Route size={15} color={theme.primary} strokeWidth={2} />
                      <Text style={[styles.detailLine, { color: theme.textSecondary, flex: 1 }]}>
                        Accessibilité :{' '}
                        <Text style={{ color: theme.text, fontWeight: '700' }}>
                          {property.accessibilite}
                        </Text>
                      </Text>
                    </View>
                  )}
                  {property.eau_courant && (
                    <View style={styles.inlineIconRow}>
                      <Droplets size={15} color={theme.primary} strokeWidth={2} />
                      <Text style={[styles.detailLine, { color: theme.textSecondary, flex: 1 }]}>
                        Eau & Électricité :{' '}
                        <Text style={{ color: theme.text, fontWeight: '700' }}>
                          {property.eau_courant}
                        </Text>
                      </Text>
                    </View>
                  )}
                  {property.description && (
                    <View style={{ gap: 4, marginTop: 4 }}>
                      <Text style={[styles.sectionTitle, { color: theme.text }]}>Description</Text>
                      <Text style={[styles.description, { color: theme.text }]}>
                        {property.description}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Protected Coordinates & Documents */}
                <View
                  style={[
                    styles.card,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}>
                  <View style={styles.inlineIconRow}>
                    {property.is_unlocked ? (
                      <Unlock size={17} color={theme.primary} strokeWidth={2.2} />
                    ) : (
                      <Lock size={17} color={theme.gold} strokeWidth={2.2} />
                    )}
                    <Text style={[styles.sectionTitle, { color: theme.text, flex: 1 }]}>
                      {property.is_unlocked
                        ? 'Coordonnées & Documents Débloqués'
                        : 'Coordonnées & Documents Justificatifs'}
                    </Text>
                  </View>
                  <Text style={[styles.detailLine, { color: theme.textSecondary }]}>
                    {property.location_details ||
                      'Repères exacts et documents légaux disponibles après déblocage.'}
                  </Text>

                  {property.user && (
                    <View style={[styles.contactBox, { backgroundColor: theme.backgroundElement }]}>
                      <Text style={[styles.contactName, { color: theme.text }]}>
                        {property.user.prenom
                          ? `${property.user.prenom} ${property.user.name}`
                          : property.user.name}
                      </Text>
                      {property.user.telephone ? (
                        <Pressable
                          onPress={() => Linking.openURL(`tel:${property.user!.telephone}`)}
                          style={styles.inlineIconRow}>
                          <Phone size={14} color={theme.primary} strokeWidth={2.2} />
                          <Text style={[styles.contactLine, { color: theme.primary }]}>
                            {property.user.telephone}
                          </Text>
                        </Pressable>
                      ) : null}
                      {property.user.email ? (
                        <Pressable
                          onPress={() => Linking.openURL(`mailto:${property.user!.email}`)}
                          style={styles.inlineIconRow}>
                          <Mail size={14} color={theme.textSecondary} strokeWidth={2} />
                          <Text style={[styles.contactLine, { color: theme.textSecondary }]}>
                            {property.user.email}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  )}

                  {property.is_unlocked && property.documents && property.documents.length > 0 && (
                    <View style={{ gap: 8, marginTop: 4 }}>
                      <Text style={[styles.docHeader, { color: theme.text }]}>
                        Documents justificatifs :
                      </Text>
                      {property.documents.map((doc) => {
                        const docUrl = resolveStorageUrl(
                          doc.document_url || doc.url_consultation,
                          storageBaseUrl
                        );
                        return (
                          <Pressable
                            key={doc.id}
                            onPress={() => docUrl && WebBrowser.openBrowserAsync(docUrl)}
                            style={[styles.docRow, { borderColor: theme.cardBorder }]}>
                            <FileText size={16} color={theme.primary} strokeWidth={2} />
                            <Text style={{ color: theme.text, fontWeight: '700', flex: 1 }}>
                              {(doc.document_type || doc.type || 'Document').toUpperCase()}
                            </Text>
                            <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 12 }}>
                              Ouvrir
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}

                  {!property.is_unlocked && isRealBackendProperty && (
                    <Pressable
                      onPress={() => {
                        if (!isAuthenticated) openAuthModal('login');
                        else setUnlockCheckoutOpen(true);
                      }}
                      style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
                      <Text style={styles.primaryBtnText}>
                        Débloquer coordonnées & documents ({property.unlock_fee ?? 50} F CFA)
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>

              {/* RIGHT / ACTIONS SIDEBAR COLUMN */}
              <View style={[styles.sideCol, isDesktop && { flex: 1 }]}>
                {/* 3 Core Property Actions Card */}
                <View style={[styles.actionsPanel, { backgroundColor: theme.navy }]}>
                  <View style={styles.inlineIconRow}>
                    <Sparkles size={13} color="#FDE68A" strokeWidth={2.2} />
                    <Text style={styles.panelEyebrow}>ACTIONS SUR CE BIEN</Text>
                  </View>
                  <Text style={styles.panelTitle}>Intéressé par cette propriété ?</Text>
                  <Text style={styles.panelDesc}>
                    Enregistrez vos coordonnées (Nom, Prénom, Téléphone, E-mail) pour demander une
                    visite, prendre rendez-vous ou contacter le propriétaire / l'agent.
                  </Text>

                  <View style={styles.actionStack}>
                    <Pressable
                      onPress={() => openActionModal('demande_visite')}
                      style={[styles.goldActionBtn, { backgroundColor: '#F59E0B' }]}>
                      <Home size={16} color="#0F172A" strokeWidth={2.2} />
                      <Text style={styles.goldActionText}>Demander une visite</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => openActionModal('rendez_vous')}
                      style={[styles.primaryActionBtn, { backgroundColor: theme.primary }]}>
                      <Calendar size={16} color="#FFFFFF" strokeWidth={2.2} />
                      <Text style={styles.primaryBtnText}>Prendre un rendez-vous</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => openActionModal('contact')}
                      style={styles.outlineActionBtn}>
                      <Mail size={16} color="#FFFFFF" strokeWidth={2.2} />
                      <Text style={styles.outlineActionText}>
                        Contacter le propriétaire / l'agent
                      </Text>
                    </Pressable>
                  </View>

                  {isRealBackendProperty && (
                    <View style={styles.paidVisitBox}>
                      <Text style={styles.paidVisitTitle}>
                        Visite physique encadrée E-Mobilier ({property.visit_fee ?? 500} F CFA)
                      </Text>
                      <Text style={styles.paidVisitSub}>
                        Réservez un créneau officiel accompagné par un conseiller terrain agréé.
                      </Text>
                      <Pressable
                        onPress={() => {
                          if (!isAuthenticated) {
                            openAuthModal('login');
                          } else {
                            setPendingVisitDate(formatLocalFutureDate(1, 10));
                            setVisitCheckoutOpen(true);
                          }
                        }}
                        style={styles.paidVisitBtn}>
                        <Text style={styles.paidVisitBtnText}>
                          Réserver visite encadrée ({property.visit_fee ?? 500} F)
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>

                {/* Guarantees Card */}
                <View
                  style={[
                    styles.card,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Garanties E-Mobilier
                  </Text>
                  <Text style={[styles.detailLine, { color: theme.textSecondary }]}>
                    • Vérification des pièces et titres fonciers avant publication.
                  </Text>
                  <Text style={[styles.detailLine, { color: theme.textSecondary }]}>
                    • Protection anti-contournement et quittance officielle Kkiapay.
                  </Text>
                  <Text style={[styles.detailLine, { color: theme.textSecondary }]}>
                    • Suivi complet dans votre Espace Client & Notifications.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Property Actions Modal (Demande de visite, Prise de RDV, Contact avec Nom/Prénom/Tél/Email) */}
      {property && (
        <PropertyActionModal
          visible={actionModalOpen}
          initialAction={actionModalTab}
          propertyId={isRealBackendProperty ? property.id : null}
          propertyTitle={propertyTitle}
          propertyLocation={fullAddress}
          recipientLabel={property.user?.name || "le propriétaire / l'agent"}
          onClose={() => setActionModalOpen(false)}
          onRequestPaidVisit={(dateStr) => {
            setPendingVisitDate(dateStr);
            setVisitCheckoutOpen(true);
          }}
        />
      )}

      {/* Unlock 50 FCFA Checkout */}
      {property && isRealBackendProperty && (
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

      {/* Visit 500 FCFA Checkout */}
      {property && isRealBackendProperty && (
        <KkiapayCheckoutModal
          visible={visitCheckoutOpen}
          operationType="visite"
          entityId={property.id}
          title="Frais de visite physique (500 F)"
          description={`Visite prévue le ${pendingVisitDate} pour le bien #${property.id}.`}
          onClose={() => setVisitCheckoutOpen(false)}
          onSuccess={async ({ transactionId }) => {
            const res = await visitesApi.requestVisit({
              property_id: property.id,
              scheduled_date: pendingVisitDate,
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
  layoutGrid: { gap: 18 },
  layoutGridDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  mainCol: { gap: 16 },
  sideCol: { gap: 16 },
  galleryCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  heroImg: { width: '100%', height: 270 },
  thumbRow: { padding: 10, gap: 8 },
  thumbWrap: { borderRadius: 10, borderWidth: 2, overflow: 'hidden' },
  thumbImg: { width: 72, height: 52 },
  noMediaBox: { height: 220, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 20, borderWidth: 1, padding: 18, gap: 10 },
  priceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  priceText: { fontSize: 24, fontWeight: '900' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  locationTitle: { fontSize: 16, fontWeight: '800' },
  specsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  detailLine: { fontSize: 13, lineHeight: 20 },
  description: { fontSize: 14, lineHeight: 22 },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  contactBox: { borderRadius: 14, padding: 14, gap: 5 },
  contactName: { fontSize: 15, fontWeight: '800' },
  contactLine: { fontSize: 13, fontWeight: '700' },
  docHeader: { fontSize: 13, fontWeight: '800' },
  docRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  inlineIconRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  actionsPanel: { borderRadius: 22, padding: 20, gap: 12 },
  panelEyebrow: { color: '#FDE68A', fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  panelTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  panelDesc: { color: '#CBD5E1', fontSize: 13, lineHeight: 19 },
  actionStack: { gap: 10, marginTop: 4 },
  goldActionBtn: { borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  goldActionText: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  primaryActionBtn: { borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  outlineActionBtn: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  outlineActionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  paidVisitBox: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    gap: 6,
  },
  paidVisitTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  paidVisitSub: { color: '#94A3B8', fontSize: 12, lineHeight: 17 },
  paidVisitBtn: {
    marginTop: 4,
    backgroundColor: 'rgba(20, 184, 166, 0.2)',
    borderColor: 'rgba(20, 184, 166, 0.5)',
    borderWidth: 1,
    borderRadius: 11,
    paddingVertical: 11,
    alignItems: 'center',
  },
  paidVisitBtnText: { color: '#99F6E4', fontSize: 13, fontWeight: '800' },
  primaryBtn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
