import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useThemeMode } from '@/context/theme-context';
import { useTheme } from '@/hooks/use-theme';
import { getStorageBaseUrl, proprietesApi } from '@/services/api';
import { mapBackendPropertyToItem, PropertyItem } from '@/types/property';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LandingShowcaseProps {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
}

export function LandingShowcase({ onOpenLogin, onOpenRegister }: LandingShowcaseProps) {
  const theme = useTheme();
  const { isDark, toggleTheme } = useThemeMode();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<any>(null);

  const [operationTab, setOperationTab] = useState<'vente' | 'location'>('vente');
  const [selectedPropertyType, setSelectedPropertyType] = useState('Parcelle / Terrain');
  const [selectedZone, setSelectedZone] = useState('Toutes les zones');
  const [budgetMax, setBudgetMax] = useState('');
  const [filterTfOnly, setFilterTfOnly] = useState(true);
  const [filterNoLitige, setFilterNoLitige] = useState(true);
  const [filterPavedAccess, setFilterPavedAccess] = useState(false);

  const [featuredProperties, setFeaturedProperties] = useState<PropertyItem[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);

  useEffect(() => {
    let active = true;
    const loadFeatured = async () => {
      try {
        const res = await proprietesApi.getFeed({ per_page: 6 });
        if (!active) return;
        const rows = res.data?.data ?? [];
        const storageBaseUrl = getStorageBaseUrl();
        setFeaturedProperties(rows.map((p) => mapBackendPropertyToItem(p, storageBaseUrl)));
      } catch {
        // Fallback local mock if backend offline
        if (active) {
          setFeaturedProperties([]);
        }
      } finally {
        if (active) setLoadingFeatured(false);
      }
    };
    void loadFeatured();
    return () => {
      active = false;
    };
  }, []);

  const handleSearchClick = () => {
    // If not authenticated, prompt login or directly navigate to explore
    router.push({
      pathname: '/explore' as any,
      params: {
        operation: operationTab,
        category: selectedPropertyType,
        city: selectedZone !== 'Toutes les zones' ? selectedZone : '',
      },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* 1. STITCH INSTITUTION HEADER */}
      <View
        style={[
          styles.headerContainer,
          {
            paddingTop: Math.max(insets.top, 12),
            backgroundColor: theme.surfaceContainerLowest,
            borderBottomColor: theme.cardBorder,
          },
        ]}>
        <View style={styles.headerContent}>
          {/* Brand */}
          <View style={styles.brandRow}>
            <View style={[styles.brandLogoBox, { backgroundColor: theme.primaryContainer }]}>
              <SymbolView
                name={{ ios: 'building.2.fill', android: 'apartment', web: 'apartment' }}
                size={18}
                tintColor="#FFFFFF"
              />
            </View>
            <View>
              <View style={styles.brandTitleRow}>
                <Text style={[styles.brandTitleText, { color: theme.text }]}>E-Mobilier</Text>
                <View style={[styles.bjPill, { backgroundColor: theme.tertiaryFixed }]}>
                  <Text style={styles.bjPillText}>BJ</Text>
                </View>
              </View>
              <Text style={[styles.arcepTag, { color: theme.primaryContainer }]}>
                SÉCURISÉ ARCEP
              </Text>
            </View>
          </View>

          {/* Right actions */}
          <View style={styles.headerRightRow}>
            <Pressable
              onPress={() => {
                void toggleTheme();
              }}
              style={[styles.headerIconBtn, { backgroundColor: theme.surfaceContainerLow }]}>
              <SymbolView
                name={{ ios: 'circle.lefthalf.filled', android: 'routine', web: 'routine' }}
                size={16}
                tintColor={theme.text}
              />
            </Pressable>

            <Pressable
              onPress={onOpenLogin}
              style={[
                styles.headerAuthBtn,
                { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder },
              ]}>
              <Text style={[styles.headerAuthBtnText, { color: theme.text }]}>Connexion</Text>
            </Pressable>

            <Pressable
              onPress={onOpenRegister}
              style={[styles.headerRegisterBtn, { backgroundColor: theme.primaryContainer }]}>
              <Text style={styles.headerRegisterBtnText}>S'inscrire</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}>
        {/* 2. HERO BANNER & VALUE PROPOSITION (STITCH) */}
        <View
          style={[
            styles.heroBanner,
            {
              backgroundColor: theme.primary,
              borderColor: theme.primaryBorder,
            },
          ]}>
          {/* Cadastral seal tag */}
          <View style={styles.heroTopTagRow}>
            <View style={styles.heroSovereigntyTag}>
              <View style={[styles.pulsingDot, { backgroundColor: theme.tertiaryFixed }]} />
              <Text style={[styles.sovereigntyText, { color: theme.tertiaryFixed }]}>
                PLATEFORME NOTARIALE & FONCIER BJ
              </Text>
            </View>
          </View>

          {/* Main Headline */}
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroHeadline}>L'Immobilier Sécurisé au Bénin</Text>
            <Text style={[styles.heroSubtitle, { color: theme.primaryLight }]}>
              Cotonou • Abomey-Calavi • Ouidah • Porto-Novo
            </Text>
          </View>

          {/* 3 Trust Badges */}
          <View style={styles.trustBadgesGrid}>
            <View style={styles.trustBadgeCard}>
              <SymbolView
                name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }}
                size={20}
                tintColor={theme.tertiaryFixed}
              />
              <Text style={styles.trustBadgeText}>100% Titres Vérifiés</Text>
            </View>

            <View style={styles.trustBadgeCard}>
              <SymbolView
                name={{ ios: 'lock.shield.fill', android: 'security', web: 'security' }}
                size={20}
                tintColor={theme.primaryLight}
              />
              <Text style={styles.trustBadgeText}>Anti-Contournement</Text>
            </View>

            <View style={styles.trustBadgeCard}>
              <SymbolView
                name={{ ios: 'coloncurrencysign.circle.fill', android: 'price_check', web: 'price_check' }}
                size={20}
                tintColor={theme.tertiaryFixed}
              />
              <Text style={styles.trustBadgeText}>0 Commission Cachée</Text>
            </View>
          </View>
        </View>

        {/* 3. INTERACTIVE RAPID SEARCH BOX (STITCH) */}
        <View
          style={[
            styles.searchBoxCard,
            {
              backgroundColor: theme.surfaceContainerLowest,
              borderColor: theme.cardBorder,
            },
          ]}>
          {/* Operation Tabs: À Vendre / À Louer */}
          <View style={[styles.operationTabsBar, { backgroundColor: theme.surfaceContainerLow }]}>
            <Pressable
              onPress={() => setOperationTab('vente')}
              style={[
                styles.operationTabBtn,
                operationTab === 'vente' && {
                  backgroundColor: theme.primaryContainer,
                  shadowColor: '#000',
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 2,
                },
              ]}>
              <Text
                style={[
                  styles.operationTabText,
                  { color: operationTab === 'vente' ? '#FFFFFF' : theme.textSecondary },
                ]}>
                À Vendre
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setOperationTab('location')}
              style={[
                styles.operationTabBtn,
                operationTab === 'location' && {
                  backgroundColor: theme.navy,
                  shadowColor: '#000',
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 2,
                },
              ]}>
              <Text
                style={[
                  styles.operationTabText,
                  { color: operationTab === 'location' ? '#FFFFFF' : theme.textSecondary },
                ]}>
                À Louer
              </Text>
            </Pressable>
          </View>

          {/* Quick Selectors */}
          <View style={styles.searchFieldsCol}>
            {/* Type de bien */}
            <View style={styles.fieldItem}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Type de bien foncier</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalPills}>
                {['Parcelle / Terrain', 'Villa Familiale', 'Appartement', 'Immeuble'].map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setSelectedPropertyType(t)}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor:
                          selectedPropertyType === t ? theme.primaryContainer : theme.surfaceContainerLow,
                        borderColor:
                          selectedPropertyType === t ? theme.primaryContainer : theme.cardBorder,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.filterPillText,
                        { color: selectedPropertyType === t ? '#FFFFFF' : theme.text },
                      ]}>
                      {t}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Zone / Commune */}
            <View style={styles.fieldItem}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Commune / Zone</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalPills}>
                {['Toutes les zones', 'Cotonou', 'Abomey-Calavi', 'Ouidah', 'Porto-Novo', 'Sèmè-Podji'].map(
                  (z) => (
                    <Pressable
                      key={z}
                      onPress={() => setSelectedZone(z)}
                      style={[
                        styles.filterPill,
                        {
                          backgroundColor:
                            selectedZone === z ? theme.secondary : theme.surfaceContainerLow,
                          borderColor: selectedZone === z ? theme.secondary : theme.cardBorder,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.filterPillText,
                          { color: selectedZone === z ? '#FFFFFF' : theme.text },
                        ]}>
                        {z}
                      </Text>
                    </Pressable>
                  )
                )}
              </ScrollView>
            </View>

            {/* Budget Max */}
            <View style={styles.fieldItem}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Budget maximum (FCFA)</Text>
              <TextInput
                value={budgetMax}
                onChangeText={setBudgetMax}
                placeholder="Ex: 25 000 000 FCFA"
                placeholderTextColor={theme.outline}
                keyboardType="numeric"
                style={[
                  styles.inputBox,
                  {
                    backgroundColor: theme.surfaceContainerLow,
                    borderColor: theme.cardBorder,
                    color: theme.text,
                  },
                ]}
              />
            </View>

            {/* Quick Guarantees Chips */}
            <View style={styles.guaranteesRow}>
              <Pressable
                onPress={() => setFilterTfOnly(!filterTfOnly)}
                style={[
                  styles.guaranteeChip,
                  {
                    backgroundColor: filterTfOnly ? theme.badgeGreenBg : theme.surfaceContainerLow,
                    borderColor: filterTfOnly ? theme.primaryContainer : theme.cardBorder,
                  },
                ]}>
                <SymbolView
                  name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }}
                  size={12}
                  tintColor={filterTfOnly ? theme.badgeGreenText : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.guaranteeChipText,
                    { color: filterTfOnly ? theme.badgeGreenText : theme.textSecondary },
                  ]}>
                  TF ANDF Vérifié
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setFilterNoLitige(!filterNoLitige)}
                style={[
                  styles.guaranteeChip,
                  {
                    backgroundColor: filterNoLitige ? theme.badgeGoldBg : theme.surfaceContainerLow,
                    borderColor: filterNoLitige ? theme.tertiaryFixedDim : theme.cardBorder,
                  },
                ]}>
                <SymbolView
                  name={{ ios: 'shield.fill', android: 'security', web: 'security' }}
                  size={12}
                  tintColor={filterNoLitige ? theme.badgeGoldText : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.guaranteeChipText,
                    { color: filterNoLitige ? theme.badgeGoldText : theme.textSecondary },
                  ]}>
                  Sans Litige
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setFilterPavedAccess(!filterPavedAccess)}
                style={[
                  styles.guaranteeChip,
                  {
                    backgroundColor: filterPavedAccess ? theme.badgeBlueBg : theme.surfaceContainerLow,
                    borderColor: filterPavedAccess ? theme.secondary : theme.cardBorder,
                  },
                ]}>
                <SymbolView
                  name={{ ios: 'road.lanes', android: 'navigation', web: 'navigation' }}
                  size={12}
                  tintColor={filterPavedAccess ? theme.badgeBlueText : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.guaranteeChipText,
                    { color: filterPavedAccess ? theme.badgeBlueText : theme.textSecondary },
                  ]}>
                  Accès Goudron
                </Text>
              </Pressable>
            </View>

            {/* Search CTA */}
            <Pressable
              onPress={handleSearchClick}
              style={({ pressed }) => [
                styles.searchCtaBtn,
                { backgroundColor: theme.primaryContainer },
                pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
              ]}>
              <SymbolView
                name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
                size={18}
                tintColor="#FFFFFF"
              />
              <Text style={styles.searchCtaBtnText}>Rechercher les Biens Sécurisés</Text>
            </Pressable>
          </View>
        </View>

        {/* 4. TARIFS RÉGLEMENTÉS & TRANSPARENTS (STITCH) */}
        <View style={styles.tariffsSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleCol}>
              <View style={styles.iconHeadingRow}>
                <SymbolView
                  name={{ ios: 'scalemass.fill', android: 'balance', web: 'balance' }}
                  size={18}
                  tintColor={theme.primaryContainer}
                />
                <Text style={[styles.sectionHeading, { color: theme.text }]}>
                  Tarifs Réglementés & Transparents
                </Text>
              </View>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Zéro frais occulte • Conforme Décret Notarial Bénin
              </Text>
            </View>
            <View style={[styles.pillTag, { backgroundColor: theme.badgeGreenBg }]}>
              <Text style={[styles.pillTagText, { color: theme.badgeGreenText }]}>SANS DÉMARCHEUR</Text>
            </View>
          </View>

          <View style={styles.tariffsGrid}>
            {/* Card 1: 500 FCFA Visite Terrain */}
            <View
              style={[
                styles.tariffCard,
                { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
              ]}>
              <View style={styles.tariffCardTop}>
                <View style={[styles.tariffBadge, { backgroundColor: theme.badgeGoldBg }]}>
                  <Text style={[styles.tariffBadgeText, { color: theme.badgeGoldText }]}>FIXE</Text>
                </View>
                <Text style={[styles.tariffPrice, { color: theme.primaryContainer }]}>500 FCFA</Text>
              </View>
              <Text style={[styles.tariffTitle, { color: theme.text }]}>
                Visite Terrain Accompagnée
              </Text>
              <Text style={[styles.tariffDesc, { color: theme.textSecondary }]}>
                Agent foncier assermenté avec repérage GPS RTK et procès-verbal contradictoire scellé.
              </Text>
              <View style={styles.tariffFooter}>
                <SymbolView
                  name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                  size={12}
                  tintColor={theme.primaryContainer}
                />
                <Text style={[styles.tariffSubtext, { color: theme.primaryContainer }]}>
                  Paiement Kkiapay Mobile Money
                </Text>
              </View>
            </View>

            {/* Card 2: 2 000 FCFA Démasquage Notarié TTL */}
            <View
              style={[
                styles.tariffCard,
                { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
              ]}>
              <View style={styles.tariffCardTop}>
                <View style={[styles.tariffBadge, { backgroundColor: theme.badgeBlueBg }]}>
                  <Text style={[styles.tariffBadgeText, { color: theme.badgeBlueText }]}>SÉCURISÉ</Text>
                </View>
                <Text style={[styles.tariffPrice, { color: theme.primaryContainer }]}>2 000 FCFA</Text>
              </View>
              <Text style={[styles.tariffTitle, { color: theme.text }]}>
                Démasquage Notarié TTL
              </Text>
              <Text style={[styles.tariffDesc, { color: theme.textSecondary }]}>
                Accès direct 15 min aux coordonnées du propriétaire vérifié sans démarchage pirate.
              </Text>
              <View style={styles.tariffFooter}>
                <SymbolView
                  name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                  size={12}
                  tintColor={theme.secondary}
                />
                <Text style={[styles.tariffSubtext, { color: theme.secondary }]}>
                  Session cryptée anti-spéculation
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 5. BIENS CERTIFIÉS EN VEDETTE (STITCH) */}
        <View style={styles.featuredSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleCol}>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>
                Biens Certifiés en Vedette
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Titres fonciers vérifiés à l'ANDF / Notariat
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/explore' as any)}
              style={styles.seeAllBtn}>
              <Text style={[styles.seeAllBtnText, { color: theme.primaryContainer }]}>Tout voir</Text>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={14}
                tintColor={theme.primaryContainer}
              />
            </Pressable>
          </View>

          {loadingFeatured ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="small" color={theme.primaryContainer} />
            </View>
          ) : featuredProperties.length > 0 ? (
            featuredProperties.map((prop) => (
              <View
                key={prop.id}
                style={[
                  styles.previewCard,
                  {
                    backgroundColor: theme.surfaceContainerLowest,
                    borderColor: theme.cardBorder,
                  },
                ]}>
                <Pressable
                  onPress={() => router.push(`/property/${prop.id}` as any)}
                  style={styles.previewImageWrap}>
                  <Image source={prop.image} style={styles.previewImage} contentFit="cover" />
                  <View style={styles.previewOverlayBadge}>
                    <Text style={styles.previewBadgeText}>
                      {prop.transactionType === 'location' ? 'À LOUER' : 'À VENDRE'}
                    </Text>
                  </View>
                  <View style={styles.previewPricePill}>
                    <Text style={styles.previewPriceText}>{prop.priceFormatted}</Text>
                  </View>
                </Pressable>

                <View style={styles.previewContent}>
                  <Text numberOfLines={1} style={[styles.previewTitle, { color: theme.text }]}>
                    {prop.title}
                  </Text>
                  <View style={styles.previewLocationRow}>
                    <SymbolView
                      name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }}
                      size={13}
                      tintColor={theme.primaryContainer}
                    />
                    <Text style={[styles.previewLocationText, { color: theme.textSecondary }]}>
                      {prop.city || 'Abomey-Calavi, Bénin'}
                    </Text>
                  </View>

                  <View style={styles.previewActions}>
                    <Pressable
                      onPress={() => router.push(`/property/${prop.id}` as any)}
                      style={[
                        styles.previewCta,
                        { backgroundColor: theme.primaryContainer },
                      ]}>
                      <Text style={styles.previewCtaText}>Inspecter le Bien</Text>
                      <SymbolView
                        name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
                        size={12}
                        tintColor="#FFFFFF"
                      />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
              ]}>
              <SymbolView
                name={{ ios: 'building.2', android: 'apartment', web: 'apartment' }}
                size={32}
                tintColor={theme.outline}
              />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Catalogue Foncier Bénin</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Connectez-vous pour accéder à plus de 140 parcelles et résidences titrées.
              </Text>
              <Pressable
                onPress={onOpenLogin}
                style={[styles.emptyBtn, { backgroundColor: theme.primaryContainer }]}>
                <Text style={styles.emptyBtnText}>Découvrir les Biens</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* 6. EDUCATIONAL ANTI-CONTOURNEMENT CARD (STITCH) */}
        <View
          style={[
            styles.educationalCard,
            {
              backgroundColor: theme.surfaceContainer,
              borderColor: theme.cardBorder,
            },
          ]}>
          <View style={styles.educationalHeader}>
            <View style={[styles.eduIconBox, { backgroundColor: theme.primaryContainer }]}>
              <SymbolView
                name={{ ios: 'shield.lefthalf.filled', android: 'policy', web: 'policy' }}
                size={18}
                tintColor="#FFFFFF"
              />
            </View>
            <Text style={[styles.eduTitle, { color: theme.text }]}>
              Pourquoi l'Anti-Contournement ?
            </Text>
          </View>
          <Text style={[styles.eduDesc, { color: theme.textSecondary }]}>
            Pour éliminer les litiges de double-vente et les démarcheurs clandestins à Cotonou et Calavi,
            E-Mobilier crypte les repères parcellaires. Démasquez uniquement lorsque votre intérêt est certain.
          </Text>
        </View>

        {/* 7. OFFICIAL INSTITUTIONAL FOOTER (STITCH) */}
        <View style={styles.footerSection}>
          <View style={styles.footerRow}>
            <SymbolView
              name={{ ios: 'checkmark.shield', android: 'verified_user', web: 'verified_user' }}
              size={14}
              tintColor={theme.primaryContainer}
            />
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              Conforme Cadastre National & Réglementation ARCEP Bénin
            </Text>
          </View>
          <Text style={[styles.footerLegal, { color: theme.outline }]}>
            E-Mobilier Bénin S.A.S • Immatriculation RCCM RB/COT/23-B • Conditions Notariales
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    width: '100%',
    borderBottomWidth: 1,
    zIndex: 40,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two + 2,
    minHeight: 52,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogoBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  brandTitleText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  bjPill: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  bjPillText: {
    color: '#241A00',
    fontSize: 9,
    fontWeight: '800',
  },
  arcepTag: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAuthBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  headerAuthBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  headerRegisterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerRegisterBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.four,
  },
  heroBanner: {
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#005C55',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
      web: { boxShadow: '0 8px 24px rgba(0, 92, 85, 0.18)' },
    }),
  },
  heroTopTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroSovereigntyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sovereigntyText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroTextWrap: {
    gap: 4,
  },
  heroHeadline: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  heroSubtitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  trustBadgesGrid: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
  },
  trustBadgeCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  trustBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  searchBoxCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.three,
    ...Platform.select({
      ios: {
        shadowColor: '#0B1C30',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
      web: { boxShadow: '0 4px 16px rgba(11, 28, 48, 0.06)' },
    }),
  },
  operationTabsBar: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
  },
  operationTabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  operationTabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  searchFieldsCol: {
    gap: 12,
  },
  fieldItem: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  horizontalPills: {
    flexDirection: 'row',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 6,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
  },
  guaranteesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  guaranteeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  guaranteeChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  searchCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  searchCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  tariffsSection: {
    gap: Spacing.three,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleCol: {
    gap: 2,
    flex: 1,
  },
  iconHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  pillTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillTagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  tariffsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  tariffCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 6,
  },
  tariffCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tariffBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tariffBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  tariffPrice: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  tariffTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  tariffDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  tariffFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  tariffSubtext: {
    fontSize: 10,
    fontWeight: '600',
  },
  featuredSection: {
    gap: Spacing.three,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  loaderWrap: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  previewCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
  },
  previewImageWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#E2E8F0',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewOverlayBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  previewBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  previewPricePill: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0, 92, 85, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  previewPriceText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  previewContent: {
    padding: 12,
    gap: 6,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  previewLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewLocationText: {
    fontSize: 12,
    fontWeight: '500',
  },
  previewActions: {
    marginTop: 6,
  },
  previewCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  previewCtaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  emptyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  educationalCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 8,
  },
  educationalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eduIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eduTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  eduDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  footerSection: {
    alignItems: 'center',
    gap: 4,
    paddingTop: Spacing.two,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
  },
  footerLegal: {
    fontSize: 10,
    textAlign: 'center',
  },
});
