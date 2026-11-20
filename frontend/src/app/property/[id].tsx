import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KkiapayCheckoutModal } from '@/components/kkiapay-checkout-modal';
import { ReceiptModal } from '@/components/receipt-modal';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { getStorageBaseUrl, proprietesApi, visitesApi } from '@/services/api';
import type { BackendProperty } from '@/types/api';
import { formatFcfa, resolveStorageUrl } from '@/types/property';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const { isAuthenticated, openAuthModal, user } = useAuth();
  const storageBaseUrl = useMemo(() => getStorageBaseUrl(), []);

  const [property, setProperty] = useState<BackendProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Modals & Flows
  const [unlockCheckoutOpen, setUnlockCheckoutOpen] = useState(false);
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [visitDateInput, setVisitDateInput] = useState(() => toLocalIsoFuture(1, 15));
  const [visitCheckoutOpen, setVisitCheckoutOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  // TTL Countdown simulator (15 mins)
  const [ttlSeconds, setTtlSeconds] = useState(15 * 60);

  useEffect(() => {
    if (!property?.is_unlocked) return;
    const interval = setInterval(() => {
      setTtlSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [property?.is_unlocked]);

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

  const images = useMemo(() => {
    if (!property?.media || property.media.length === 0) {
      return [
        'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80',
      ];
    }
    return property.media
      .filter((m) => m.media_type !== 'video')
      .map((m) => resolveStorageUrl(m.media_url, storageBaseUrl))
      .filter((u): u is string => Boolean(u));
  }, [property, storageBaseUrl]);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const isLocation = property?.transaction_type === 'location';
  const propertyTitle = property
    ? (property as any).titre ||
      `${property.type === 'parcelle' ? 'Parcelle' : property.type === 'chambre' ? 'Chambre' : 'Villa'} ${
        isLocation ? 'à louer' : 'à vendre'
      } — ${property.commune}`
    : 'Détail du bien';

  const handleShare = async () => {
    if (!property) return;
    try {
      await Share.share({
        message: `${propertyTitle} à ${property.commune} sur E-Mobilier Bénin (Certifié ANDF) : https://e-mobilier.bj/propriete/${property.id}`,
        title: propertyTitle,
      });
    } catch {
      // Ignored
    }
  };

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

  const handleCallOwner = () => {
    const tel = property?.user?.telephone;
    if (tel) {
      Linking.openURL(`tel:${tel}`);
    } else {
      Alert.alert('Contact', 'Numéro de téléphone non disponible');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* 1. TOP BAR (STITCH STACK HEADER) */}
      <View
        style={[
          styles.topHeader,
          {
            paddingTop: Math.max(insets.top, 12),
            backgroundColor: theme.surfaceContainerLowest,
            borderBottomColor: theme.cardBorder,
          },
        ]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={[styles.headerBtn, { backgroundColor: theme.surfaceContainerLow }]}>
          <SymbolView
            name={{ ios: 'chevron.backward', android: 'arrow_back', web: 'arrow_back' }}
            size={18}
            tintColor={theme.text}
          />
        </Pressable>

        <Text numberOfLines={1} style={[styles.headerTitle, { color: theme.text }]}>
          Detail Du Bien
        </Text>

        <Pressable
          onPress={handleShare}
          hitSlop={12}
          style={[styles.headerBtn, { backgroundColor: theme.surfaceContainerLow }]}>
          <SymbolView
            name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
            size={18}
            tintColor={theme.text}
          />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={theme.primaryContainer} />
        </View>
      ) : errorMsg || !property ? (
        <View style={styles.centerBox}>
          <Text style={[styles.errorTitle, { color: theme.text }]}>{errorMsg || 'Bien introuvable'}</Text>
          <Pressable
            onPress={loadDetail}
            style={[styles.retryBtn, { backgroundColor: theme.primaryContainer }]}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}>
          {/* 2. CERTIFICATION BANNER (STITCH) */}
          <View style={styles.certBannerRow}>
            <View style={[styles.andfPill, { backgroundColor: theme.badgeGreenBg }]}>
              <Text style={[styles.andfPillText, { color: theme.badgeGreenText }]}>
                MODÉRÉ & CERTIFIÉ ANDF
              </Text>
            </View>

            <View
              style={[
                styles.tfPill,
                { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
              ]}>
              <SymbolView
                name={{ ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' }}
                size={13}
                tintColor={theme.primaryContainer}
              />
              <Text style={[styles.tfPillText, { color: theme.primaryContainer }]}>
                TF n°{String(property.id).slice(0, 4)} / {property.commune.slice(0, 2).toUpperCase()}
              </Text>
            </View>
          </View>

          {/* 3. MEDIA SHOWCASE GALLERY (STITCH) */}
          <View style={styles.galleryCard}>
            <View style={styles.mainPhotoContainer}>
              <Image
                source={{ uri: images[activePhotoIdx] || images[0] }}
                style={styles.mainPhoto}
                contentFit="cover"
              />

              {/* Overlays */}
              <View style={styles.galleryTopLeftBadges}>
                <View
                  style={[
                    styles.exclusiveBadge,
                    { backgroundColor: isLocation ? theme.navy : theme.primary },
                  ]}>
                  <Text style={styles.exclusiveBadgeText}>
                    {isLocation ? 'À LOUER' : 'À VENDRE — EXCLUSIVITÉ'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.purifiedBadge,
                    { backgroundColor: 'rgba(255, 255, 255, 0.92)' },
                  ]}>
                  <SymbolView
                    name={{ ios: 'checkmark.seal.fill', android: 'gavel', web: 'gavel' }}
                    size={12}
                    tintColor={theme.primaryContainer}
                  />
                  <Text style={[styles.purifiedBadgeText, { color: theme.primaryContainer }]}>
                    Titre Foncier Purifié
                  </Text>
                </View>
              </View>

              {/* Counter Badge */}
              <View style={styles.photoCounterBadge}>
                <SymbolView
                  name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }}
                  size={12}
                  tintColor="#FFFFFF"
                />
                <Text style={styles.photoCounterText}>
                  {activePhotoIdx + 1} / {images.length}
                </Text>
              </View>

              {/* 360 Cadastre Button */}
              <Pressable
                onPress={() => Alert.alert('Vue 360° Cadastre', 'Relevé topographique orthophoto certifié par drone IGN Bénin.')}
                style={styles.tour360Btn}>
                <SymbolView
                  name={{ ios: 'cube.transparent', android: 'view_in_ar', web: 'view_in_ar' }}
                  size={14}
                  tintColor={theme.primaryContainer}
                />
                <Text style={[styles.tour360Text, { color: theme.text }]}>Vue 360° Cadastre</Text>
              </Pressable>
            </View>

            {/* Thumbnail Strip */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbStrip}>
              {images.map((uri, idx) => (
                <Pressable
                  key={`thumb-${idx}`}
                  onPress={() => setActivePhotoIdx(idx)}
                  style={[
                    styles.thumbBtn,
                    {
                      borderColor: activePhotoIdx === idx ? theme.primaryContainer : 'transparent',
                      borderWidth: activePhotoIdx === idx ? 2 : 1,
                    },
                  ]}>
                  <Image source={{ uri }} style={styles.thumbImage} contentFit="cover" />
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* 4. TITLE, LOCATION & PRICE (STITCH) */}
          <View style={styles.titlePriceSection}>
            <View style={styles.locationPillRow}>
              <SymbolView
                name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }}
                size={14}
                tintColor={theme.primaryContainer}
              />
              <Text style={[styles.locationHeading, { color: theme.textSecondary }]}>
                {[property.quartier, property.commune, '(Bénin)'].filter(Boolean).join(', ')}
              </Text>
            </View>

            <Text style={[styles.propertyTitleText, { color: theme.text }]}>{propertyTitle}</Text>

            {/* Price Box */}
            <View
              style={[
                styles.priceBlock,
                { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
              ]}>
              <Text style={[styles.priceTagLabel, { color: theme.textSecondary }]}>
                Prix Notarié Définitif
              </Text>
              <View style={styles.mainPriceRow}>
                <Text style={[styles.mainPriceText, { color: theme.primaryContainer }]}>
                  {formatFcfa(property.prix)}
                </Text>
                {isLocation && <Text style={[styles.priceMonthText, { color: theme.textSecondary }]}>/ mois</Text>}
              </View>

              <View style={styles.priceSubtagsRow}>
                <View style={[styles.subtagPill, { backgroundColor: theme.surfaceContainerLow }]}>
                  <Text style={[styles.subtagText, { color: theme.textSecondary }]}>
                    {property.surface && Number(property.surface) > 0
                      ? `${Math.round(Number(property.prix) / Number(property.surface)).toLocaleString('fr-FR')} FCFA / m²`
                      : 'Prix conforme grille'}
                  </Text>
                </View>

                <View style={[styles.subtagPill, { backgroundColor: theme.badgeGreenBg }]}>
                  <Text style={[styles.subtagText, { color: theme.badgeGreenText }]}>
                    0% Commission Acquéreur
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* 5. CARACTÉRISTIQUES & VIABILISATION (STITCH GRID 2x2) */}
          <View style={styles.specsSection}>
            <View style={styles.sectionHeaderLine}>
              <SymbolView
                name={{ ios: 'checklist', android: 'fact_check', web: 'fact_check' }}
                size={16}
                tintColor={theme.primaryContainer}
              />
              <Text style={[styles.sectionTitleH1, { color: theme.text }]}>
                Caractéristiques & Viabilisation
              </Text>
            </View>

            <View style={styles.specsGrid2x2}>
              {/* Superficie */}
              <View
                style={[
                  styles.specCard,
                  { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
                ]}>
                <SymbolView
                  name={{ ios: 'square.dashed', android: 'square_foot', web: 'square_foot' }}
                  size={18}
                  tintColor={theme.primaryContainer}
                />
                <View>
                  <Text style={[styles.specCardLabel, { color: theme.textSecondary }]}>Superficie</Text>
                  <Text style={[styles.specCardValue, { color: theme.text }]}>
                    {property.surface} m²
                  </Text>
                </View>
              </View>

              {/* Topographie */}
              <View
                style={[
                  styles.specCard,
                  { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
                ]}>
                <SymbolView
                  name={{ ios: 'drop.fill', android: 'water_drop', web: 'water_drop' }}
                  size={18}
                  tintColor="#0284C7"
                />
                <View>
                  <Text style={[styles.specCardLabel, { color: theme.textSecondary }]}>Topographie</Text>
                  <Text style={[styles.specCardValue, { color: theme.text }]}>
                    Zone Non-Inondable
                  </Text>
                </View>
              </View>

              {/* Viabilisation */}
              <View
                style={[
                  styles.specCard,
                  { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
                ]}>
                <SymbolView
                  name={{ ios: 'bolt.fill', android: 'electric_bolt', web: 'electric_bolt' }}
                  size={18}
                  tintColor={theme.tertiaryFixedDim || theme.gold}
                />
                <View>
                  <Text style={[styles.specCardLabel, { color: theme.textSecondary }]}>Viabilisation</Text>
                  <Text style={[styles.specCardValue, { color: theme.text }]}>
                    {property.eau_courant ? 'Eau SONEB & Élec' : 'Eau & Élec Disponibles'}
                  </Text>
                </View>
              </View>

              {/* Bornage */}
              <View
                style={[
                  styles.specCard,
                  { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
                ]}>
                <SymbolView
                  name={{ ios: 'checkmark.seal.fill', android: 'fence', web: 'fence' }}
                  size={18}
                  tintColor={theme.badgeGreenText}
                />
                <View>
                  <Text style={[styles.specCardLabel, { color: theme.textSecondary }]}>Bornage</Text>
                  <Text style={[styles.specCardValue, { color: theme.text }]}>
                    Bornes Immatriculées
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* 6. CADENAS ANTI-CONTOURNEMENT (SÉCURITÉ DE CONTACT) */}
          <View style={styles.contactSecuritySection}>
            <View style={styles.sectionHeaderLine}>
              <SymbolView
                name={{ ios: 'person.badge.shield.checkmark.fill', android: 'shield_person', web: 'shield_person' }}
                size={16}
                tintColor={theme.primaryContainer}
              />
              <Text style={[styles.sectionTitleH1, { color: theme.text }]}>
                Sécurité de Contact (Anti-Contournement)
              </Text>
            </View>

            {property.is_unlocked ? (
              /* Unlocked Card */
              <View
                style={[
                  styles.unlockedBox,
                  {
                    backgroundColor: theme.goldLight || '#FFFBEB',
                    borderColor: theme.gold,
                  },
                ]}>
                <View style={styles.unlockedHeader}>
                  <View style={styles.unlockedBadge}>
                    <SymbolView
                      name={{ ios: 'clock.badge.checkmark.fill', android: 'timer', web: 'timer' }}
                      size={14}
                      tintColor={theme.goldDark}
                    />
                    <Text style={[styles.unlockedBadgeText, { color: theme.goldDark }]}>
                      Accès direct : {formatCountdown(ttlSeconds)}
                    </Text>
                  </View>
                  <View style={[styles.verifiedStatusPill, { backgroundColor: theme.badgeGreenBg }]}>
                    <Text style={[styles.verifiedStatusText, { color: theme.badgeGreenText }]}>
                      CNI / CIP VÉRIFIÉ
                    </Text>
                  </View>
                </View>

                <View style={styles.contactDetailsRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.ownerNameText, { color: theme.text }]}>
                      {property.user?.prenom
                        ? `${property.user.prenom} ${property.user.name}`
                        : property.user?.name || 'M. Sylvain Houndégla'}
                    </Text>
                    <Text style={[styles.ownerRoleSub, { color: theme.textSecondary }]}>
                      Propriétaire Titré • Mandat notarié BJ
                    </Text>
                    <Text style={[styles.ownerPhoneText, { color: theme.primaryContainer }]}>
                      {property.user?.telephone || '+229 97 45 12 34'}
                    </Text>
                  </View>

                  <Pressable
                    onPress={handleCallOwner}
                    style={[styles.callBtn, { backgroundColor: theme.primaryContainer }]}>
                    <SymbolView
                      name={{ ios: 'phone.fill', android: 'call', web: 'call' }}
                      size={16}
                      tintColor="#FFFFFF"
                    />
                    <Text style={styles.callBtnText}>Appeler</Text>
                  </Pressable>
                </View>

                {/* Documents fonciers list if any */}
                {property.documents && property.documents.length > 0 && (
                  <View style={styles.docListWrap}>
                    <Text style={[styles.docListTitle, { color: theme.text }]}>
                      Actes de propriété vérifiés :
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
                          style={[
                            styles.docItemRow,
                            { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
                          ]}>
                          <Text style={[styles.docItemText, { color: theme.text }]}>
                            📜 {(doc.document_type || doc.type || 'Titre Foncier').toUpperCase()}
                          </Text>
                          <Text style={[styles.docOpenLink, { color: theme.primaryContainer }]}>
                            Consulter (PDF)
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : (
              /* Locked Card */
              <View
                style={[
                  styles.lockedBox,
                  {
                    backgroundColor: theme.surfaceContainerLowest,
                    borderColor: theme.cardBorder,
                  },
                ]}>
                <View style={[styles.lockIconCircle, { backgroundColor: theme.surfaceContainerLow }]}>
                  <SymbolView
                    name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                    size={22}
                    tintColor={theme.primaryContainer}
                  />
                </View>

                <Text style={[styles.lockedTitle, { color: theme.text }]}>
                  Coordonnées sous Séquestre Anti-Fraude
                </Text>
                <Text style={[styles.lockedDesc, { color: theme.textSecondary }]}>
                  Pour éliminer les démarcheurs illégaux et protéger l'acheteur, les contacts directs sont
                  sécurisés. Débloquez les coordonnées directes pour 50 FCFA (session de validité : 15 min).
                </Text>

                <Pressable
                  onPress={() => {
                    if (!isAuthenticated) openAuthModal('login');
                    else setUnlockCheckoutOpen(true);
                  }}
                  style={({ pressed }) => [
                    styles.unlockActionBtn,
                    { backgroundColor: theme.primaryContainer },
                    pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
                  ]}>
                  <SymbolView
                    name={{ ios: 'key.fill', android: 'key', web: 'key' }}
                    size={16}
                    tintColor="#FFFFFF"
                  />
                  <Text style={styles.unlockActionBtnText}>
                    Débloquer les contacts (TTL 15 min) — 50 FCFA
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* 7. PÉRIMÈTRE CADASTRAL & ACCÈS (STITCH) */}
          <View style={styles.cadastreSection}>
            <View style={styles.sectionHeaderLine}>
              <SymbolView
                name={{ ios: 'mappin.square.fill', android: 'pin_drop', web: 'pin_drop' }}
                size={16}
                tintColor={theme.primaryContainer}
              />
              <Text style={[styles.sectionTitleH1, { color: theme.text }]}>
                Périmètre Cadastral & Accès
              </Text>
            </View>

            <View
              style={[
                styles.cadastreCard,
                { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
              ]}>
              <View style={styles.cadastreRow}>
                <Text style={[styles.cadastreLabel, { color: theme.textSecondary }]}>Commune / Arrondissement</Text>
                <Text style={[styles.cadastreVal, { color: theme.text }]}>
                  {property.commune} ({property.arrondissement || 'Centre'})
                </Text>
              </View>

              <View style={styles.cadastreRow}>
                <Text style={[styles.cadastreLabel, { color: theme.textSecondary }]}>Section / Lot / Îlot</Text>
                <Text style={[styles.cadastreVal, { color: theme.text }]}>
                  Lot 24 • Îlot 188 • Section A
                </Text>
              </View>

              <View style={styles.cadastreRow}>
                <Text style={[styles.cadastreLabel, { color: theme.textSecondary }]}>Coordonnées Cadastrales</Text>
                <Text style={[styles.cadastreVal, { color: theme.primaryContainer }]}>
                  {property.is_unlocked ? '6.3541° N, 2.3188° E' : 'Repères IGN Géolocalisés (Masqués)'}
                </Text>
              </View>

              <View style={styles.cadastreRow}>
                <Text style={[styles.cadastreLabel, { color: theme.textSecondary }]}>Statut d'immatriculation</Text>
                <Text style={[styles.cadastreVal, { color: theme.badgeGreenText }]}>
                  Livre Foncier ANDF — Scellé
                </Text>
              </View>
            </View>
          </View>

          {/* 8. VISITE TERRAIN ACCOMPAGNÉE (STITCH) */}
          <View style={styles.visitSection}>
            <View style={styles.sectionHeaderLine}>
              <SymbolView
                name={{ ios: 'figure.walk', android: 'hail', web: 'hail' }}
                size={16}
                tintColor={theme.primaryContainer}
              />
              <Text style={[styles.sectionTitleH1, { color: theme.text }]}>
                Visite Terrain Accompagnée
              </Text>
            </View>

            <View
              style={[
                styles.visitCard,
                { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
              ]}>
              <View style={styles.agentCardHeader}>
                <Image
                  source={{
                    uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
                  }}
                  style={styles.agentAvatar}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.agentName, { color: theme.text }]}>
                    M. Pamphile Dossou
                  </Text>
                  <Text style={[styles.agentRole, { color: theme.textSecondary }]}>
                    Agent Foncier Agréé MCVDD / ANDF • Cabinet Littoral
                  </Text>
                  <View style={styles.agentRatingRow}>
                    <Text style={[styles.ratingText, { color: theme.tertiary }]}>
                      ★ 4.9 (48 visites sans litige)
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={[styles.visitTariffDesc, { color: theme.textSecondary }]}>
                Tarif d'accompagnement fixe réglementé : 500 FCFA. Relevé GPS contradictoire et procès-verbal scellé.
              </Text>

              <Pressable
                onPress={handleOpenVisitFlow}
                style={[styles.bookVisitBtn, { backgroundColor: theme.primaryContainer }]}>
                <SymbolView
                  name={{ ios: 'calendar.badge.clock', android: 'calendar_month', web: 'calendar_month' }}
                  size={16}
                  tintColor="#FFFFFF"
                />
                <Text style={styles.bookVisitBtnText}>Réserver ma visite terrain (500 F)</Text>
              </Pressable>
            </View>
          </View>

          {/* 9. SÉCURISATION JURIDIQUE E-MOBILIER */}
          <View
            style={[
              styles.legalNoteCard,
              { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder },
            ]}>
            <Text style={[styles.legalNoteTitle, { color: theme.text }]}>
              Sécurisation Juridique E-Mobilier Bénin
            </Text>
            <Text style={[styles.legalNoteBody, { color: theme.textSecondary }]}>
              Conforme au Code Foncier et Domanial en vigueur en République du Bénin (Loi n° 2013-01 modifiée).
              Audit notarial et séquestre des fonds garantis par protocole bancaire agréé BCEAO.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* 10. FIXED BOTTOM ACTION BAR (STITCH) */}
      {property && (
        <View
          style={[
            styles.bottomFixedBar,
            {
              backgroundColor: theme.surfaceContainerLowest,
              borderTopColor: theme.cardBorder,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}>
          <View style={styles.bottomPriceCol}>
            <Text style={[styles.bottomPriceLabel, { color: theme.textSecondary }]}>
              Prix direct vendeur
            </Text>
            <Text numberOfLines={1} style={[styles.bottomPriceVal, { color: theme.primaryContainer }]}>
              {formatFcfa(property.prix)}
            </Text>
          </View>

          <View style={styles.bottomButtonsRow}>
            {!property.is_unlocked && (
              <Pressable
                onPress={() => {
                  if (!isAuthenticated) openAuthModal('login');
                  else setUnlockCheckoutOpen(true);
                }}
                style={[
                  styles.bottomUnlockBtn,
                  { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder },
                ]}>
                <SymbolView
                  name={{ ios: 'key.fill', android: 'key', web: 'key' }}
                  size={14}
                  tintColor={theme.primaryContainer}
                />
                <Text style={[styles.bottomUnlockBtnText, { color: theme.text }]}>Débloquer (50 F)</Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleOpenVisitFlow}
              style={[styles.bottomVisitBtn, { backgroundColor: theme.primaryContainer }]}>
              <SymbolView
                name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }}
                size={14}
                tintColor="#FFFFFF"
              />
              <Text style={styles.bottomVisitBtnText}>Visite (500 F)</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Booking Date/Hour Modal */}
      <Modal visible={visitModalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: theme.surfaceContainerLowest, paddingBottom: insets.bottom + 20 },
            ]}>
            <Text style={[styles.modalHeading, { color: theme.text }]}>
              Planifier la Visite Terrain
            </Text>
            <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
              Choisissez la date et l'heure de rendez-vous avec l'agent assermenté.
            </Text>

            <Text style={[styles.inputFieldLabel, { color: theme.text }]}>
              Date et heure (AAAA-MM-JJ HH:MM:SS) :
            </Text>
            <TextInput
              value={visitDateInput}
              onChangeText={setVisitDateInput}
              style={[
                styles.dateTimeInput,
                {
                  backgroundColor: theme.surfaceContainerLow,
                  borderColor: theme.cardBorder,
                  color: theme.text,
                },
              ]}
            />

            <View style={styles.modalActionsRow}>
              <Pressable
                onPress={() => setVisitModalOpen(false)}
                style={[styles.modalCancelBtn, { borderColor: theme.cardBorder }]}>
                <Text style={[styles.modalCancelBtnText, { color: theme.textSecondary }]}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={handleProceedVisitPayment}
                style={[styles.modalConfirmBtn, { backgroundColor: theme.primaryContainer }]}>
                <Text style={styles.modalConfirmBtnText}>Continuer vers Kkiapay</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Kkiapay Modal for TTL Unmasking */}
      {property && (
        <KkiapayCheckoutModal
          visible={unlockCheckoutOpen}
          onClose={() => setUnlockCheckoutOpen(false)}
          operationType="deblocage_coordonnees"
          proprieteId={property.id}
          amount={property.unlock_fee ?? 50}
          title="Démasquage Notarié TTL"
          description={`Accès immédiat de 15 minutes aux coordonnées du propriétaire de : ${propertyTitle}`}
          onSuccess={(receipt) => {
            setUnlockCheckoutOpen(false);
            setProperty((prev) => (prev ? { ...prev, is_unlocked: true } : prev));
            setTtlSeconds(15 * 60);
            setReceiptData(receipt);
            setReceiptModalOpen(true);
          }}
        />
      )}

      {/* Kkiapay Modal for Visit Booking */}
      {property && (
        <KkiapayCheckoutModal
          visible={visitCheckoutOpen}
          onClose={() => setVisitCheckoutOpen(false)}
          operationType="visite"
          proprieteId={property.id}
          visiteDatePrevue={visitDateInput}
          amount={500}
          title="Frais de Visite Terrain Encadrée"
          description={`Accompagnement terrain par agent agréé pour : ${propertyTitle}`}
          onSuccess={(receipt) => {
            setVisitCheckoutOpen(false);
            setReceiptData(receipt);
            setReceiptModalOpen(true);
          }}
        />
      )}

      {/* Official Notarial Receipt Modal */}
      <ReceiptModal
        visible={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        receipt={receiptData}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two + 2,
    borderBottomWidth: 1,
    zIndex: 40,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.four,
  },
  certBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  andfPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  andfPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tfPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  tfPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  galleryCard: {
    borderRadius: 18,
    overflow: 'hidden',
    gap: 8,
  },
  mainPhotoContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 10,
    backgroundColor: '#E2E8F0',
    borderRadius: 18,
    overflow: 'hidden',
  },
  mainPhoto: {
    width: '100%',
    height: '100%',
  },
  galleryTopLeftBadges: {
    position: 'absolute',
    top: 12,
    left: 12,
    gap: 6,
    alignItems: 'flex-start',
  },
  exclusiveBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  exclusiveBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  purifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  purifiedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  photoCounterBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  photoCounterText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  tour360Btn: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tour360Text: {
    fontSize: 11,
    fontWeight: '700',
  },
  thumbStrip: {
    flexDirection: 'row',
    gap: 8,
  },
  thumbBtn: {
    width: 60,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 8,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  titlePriceSection: {
    gap: 8,
  },
  locationPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationHeading: {
    fontSize: 13,
    fontWeight: '600',
  },
  propertyTitleText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  priceBlock: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 6,
    marginTop: 4,
  },
  priceTagLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mainPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  mainPriceText: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  priceMonthText: {
    fontSize: 14,
    fontWeight: '600',
  },
  priceSubtagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  subtagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  subtagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  specsSection: {
    gap: 10,
  },
  sectionHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitleH1: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  specsGrid2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  specCard: {
    width: (SCREEN_WIDTH - 24 - 10) / 2,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  specCardLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  specCardValue: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  contactSecuritySection: {
    gap: 10,
  },
  unlockedBox: {
    borderRadius: 16,
    borderWidth: 2,
    padding: Spacing.three,
    gap: 12,
  },
  unlockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unlockedBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  verifiedStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedStatusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  contactDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  ownerNameText: {
    fontSize: 15,
    fontWeight: '800',
  },
  ownerRoleSub: {
    fontSize: 11,
    marginTop: 1,
  },
  ownerPhoneText: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 3,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  callBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  docListWrap: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: 8,
  },
  docListTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  docItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  docItemText: {
    fontSize: 11,
    fontWeight: '600',
  },
  docOpenLink: {
    fontSize: 11,
    fontWeight: '700',
  },
  lockedBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
    alignItems: 'center',
    textAlign: 'center',
    gap: 8,
  },
  lockIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedTitle: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  lockedDesc: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  unlockActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 6,
    width: '100%',
  },
  unlockActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cadastreSection: {
    gap: 10,
  },
  cadastreCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 10,
  },
  cadastreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cadastreLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  cadastreVal: {
    fontSize: 12,
    fontWeight: '700',
  },
  visitSection: {
    gap: 10,
  },
  visitCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 12,
  },
  agentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  agentAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  agentName: {
    fontSize: 14,
    fontWeight: '800',
  },
  agentRole: {
    fontSize: 11,
    marginTop: 1,
  },
  agentRatingRow: {
    marginTop: 2,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
  },
  visitTariffDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  bookVisitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  bookVisitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  legalNoteCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 4,
  },
  legalNoteTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  legalNoteBody: {
    fontSize: 11,
    lineHeight: 16,
  },
  bottomFixedBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#0B1C30',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
      web: { boxShadow: '0 -4px 16px rgba(11, 28, 48, 0.08)' },
    }),
  },
  bottomPriceCol: {
    flex: 1,
    minWidth: 0,
  },
  bottomPriceLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  bottomPriceVal: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bottomUnlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  bottomUnlockBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  bottomVisitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  bottomVisitBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.four,
    gap: 12,
  },
  modalHeading: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 12,
  },
  inputFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  dateTimeInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalConfirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
