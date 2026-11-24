import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PropertyCard } from '@/components/property-card';
import { PropertyActionModal, PropertyActionTab } from '@/components/property/property-action-modal';
import { BENIN_COMMUNES, FILTER_CATEGORIES } from '@/constants/locations';
import { BottomTabInset } from '@/constants/theme';
import { useThemeMode } from '@/context/theme-context';
import { MOCK_PROPERTIES } from '@/data/mock-properties';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { getStorageBaseUrl, proprietesApi } from '@/services/api';
import { favoritesStorage } from '@/services/local-store';
import type { BackendProperty } from '@/types/api';
import { mapBackendPropertyToItem, PropertyCategory, PropertyItem } from '@/types/property';

interface LandingShowcaseProps {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
}

export function LandingShowcase({ onOpenLogin, onOpenRegister }: LandingShowcaseProps) {
  const theme = useTheme();
  const { isDark, toggleTheme } = useThemeMode();
  const insets = useSafeAreaInsets();
  const { isMobile, isTablet, isDesktop, gridColumns, contentMaxWidth, horizontalPadding } =
    useResponsive();
  const storageBaseUrl = useMemo(() => getStorageBaseUrl(), []);

  const [quickQuery, setQuickQuery] = useState('');
  const [quickTransaction, setQuickTransaction] = useState<'tous' | 'location' | 'vente'>('tous');
  const [quickCommune, setQuickCommune] = useState('Toutes les communes');
  const [selectedCategory, setSelectedCategory] = useState<PropertyCategory>('tous');

  const [liveProperties, setLiveProperties] = useState<PropertyItem[]>([]);
  const [loadingProps, setLoadingProps] = useState(true);

  const [actionProperty, setActionProperty] = useState<PropertyItem | null>(null);
  const [actionTab, setActionTab] = useState<PropertyActionTab>('demande_visite');

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [favs, res] = await Promise.all([
        favoritesStorage.getAll(),
        proprietesApi.getFeed({ per_page: 9 }),
      ]);
      if (!active) return;
      if (res.success && res.data?.data && res.data.data.length > 0) {
        setLiveProperties(
          res.data.data.map((p: BackendProperty) =>
            mapBackendPropertyToItem(p, storageBaseUrl, favs)
          )
        );
      } else {
        setLiveProperties(
          MOCK_PROPERTIES.map((item) => ({ ...item, isFavorite: favs.has(item.id) }))
        );
      }
      setLoadingProps(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [storageBaseUrl]);

  const displayedProperties = useMemo(() => {
    return liveProperties.filter((p) => {
      if (selectedCategory !== 'tous' && p.type !== selectedCategory) return false;
      if (quickTransaction !== 'tous' && p.transactionType !== quickTransaction) return false;
      return true;
    });
  }, [liveProperties, selectedCategory, quickTransaction]);

  const handleToggleFavorite = async (id: string) => {
    const next = await favoritesStorage.toggle(id);
    setLiveProperties((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isFavorite: next.has(item.id) } : item))
    );
  };

  const handleHeroSearch = () => {
    const params = new URLSearchParams();
    if (quickQuery.trim()) params.set('q', quickQuery.trim());
    if (quickTransaction !== 'tous') params.set('tx', quickTransaction);
    if (quickCommune !== 'Toutes les communes') params.set('commune', quickCommune);
    if (selectedCategory !== 'tous') params.set('type', selectedCategory);
    const qs = params.toString();
    router.push((qs ? `/explore?${qs}` : '/explore') as any);
  };

  const handleOpenProperty = (property: PropertyItem) => {
    router.push(`/property/${property.id}` as any);
  };

  const cardWidthPercent =
    gridColumns === 3 ? '31.8%' : gridColumns === 2 ? '48.5%' : '100%';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Sticky Modern Top Header */}
      <View
        style={[
          styles.topHeader,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingHorizontal: horizontalPadding,
            backgroundColor: theme.navy,
            borderBottomColor: 'rgba(255, 255, 255, 0.08)',
          },
        ]}>
        <View style={[styles.headerInner, { maxWidth: contentMaxWidth }]}>
          <Pressable onPress={() => router.push('/' as any)} style={styles.brandRow}>
            <View style={styles.logoIcon}>
              <SymbolView
                name={{ ios: 'building.2.crop.circle.fill', android: 'apartment', web: 'apartment' }}
                size={22}
                tintColor="#F59E0B"
              />
            </View>
            <View style={styles.brandTextWrap}>
              <View style={styles.brandTitleRow}>
                <Text numberOfLines={1} style={styles.brandTitle}>
                  E-Mobilier
                </Text>
                <View style={styles.flagBadge}>
                  <Text style={styles.flagText}>🇧🇯 BÉNIN</Text>
                </View>
              </View>
              {!isMobile && (
                <Text numberOfLines={1} style={styles.brandSubtitle}>
                  Portail Immobilier Certifié
                </Text>
              )}
            </View>
          </Pressable>

          {/* Desktop Navigation Links */}
          {isDesktop && (
            <View style={styles.desktopNav}>
              <Pressable onPress={() => router.push('/explore' as any)} style={styles.navLinkBtn}>
                <Text style={styles.navLinkText}>Rechercher</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/client' as any)} style={styles.navLinkBtn}>
                <Text style={styles.navLinkText}>Espace Client</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/agent' as any)} style={styles.navLinkBtn}>
                <Text style={styles.navLinkText}>Espace Agent</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/client-form' as any)} style={styles.navLinkBtn}>
                <Text style={styles.navLinkText}>Formulaire Client</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/publish' as any)} style={styles.navLinkBtn}>
                <Text style={styles.navLinkText}>Publier</Text>
              </Pressable>
            </View>
          )}

          {/* Header Actions */}
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => {
                void toggleTheme();
              }}
              style={({ pressed }) => [styles.themeHeaderBtn, pressed && { opacity: 0.75 }]}
              hitSlop={6}>
              <Text style={styles.themeHeaderIcon}>{isDark ? '🌙' : '☀️'}</Text>
            </Pressable>

            <Pressable
              onPress={onOpenLogin}
              style={({ pressed }) => [styles.loginHeaderBtn, pressed && { opacity: 0.75 }]}
              hitSlop={6}>
              <Text numberOfLines={1} style={styles.loginHeaderText}>
                Connexion
              </Text>
            </Pressable>

            <Pressable
              onPress={onOpenRegister}
              style={({ pressed }) => [styles.registerHeaderBtn, pressed && { opacity: 0.85 }]}
              hitSlop={6}>
              <Text numberOfLines={1} style={styles.registerHeaderText}>
                S'inscrire
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: BottomTabInset + insets.bottom + 88 },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* HERO SECTION */}
        <View style={[styles.heroContainer, { minHeight: isDesktop ? 520 : isTablet ? 470 : 460 }]}>
          <Image
            source={require('@/assets/images/hero_luxury_villa.jpg')}
            style={styles.heroImage}
            contentFit="cover"
            priority="high"
          />
          <View style={[styles.heroOverlay, { paddingHorizontal: horizontalPadding }]}>
            <View style={[styles.heroInner, { maxWidth: contentMaxWidth }]}>
              <View style={styles.heroTag}>
                <Text style={styles.heroTagText}>
                  ✦ N°1 DE L'IMMOBILIER SÉCURISÉ AU BÉNIN
                </Text>
              </View>

              <Text
                style={[
                  styles.heroMainTitle,
                  {
                    fontSize: isDesktop ? 44 : isTablet ? 34 : 26,
                    lineHeight: isDesktop ? 52 : isTablet ? 42 : 33,
                  },
                ]}>
                Trouvez, louez ou publiez votre bien immobilier en toute sérénité
              </Text>

              <Text style={styles.heroDescription}>
                Maisons, villas contemporaines, chambres sanitaires et parcelles avec titres vérifiés à
                Cotonou, Abomey-Calavi, Porto-Novo et Ouidah.
              </Text>

              {/* Quick Search Box in Hero */}
              <View
                style={[
                  styles.heroSearchCard,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.cardBorder,
                  },
                ]}>
                <View style={styles.heroSearchTabs}>
                  {(['tous', 'location', 'vente'] as const).map((tx) => {
                    const active = quickTransaction === tx;
                    const label =
                      tx === 'tous' ? 'Tout voir' : tx === 'location' ? 'Louer' : 'Acheter';
                    return (
                      <Pressable
                        key={tx}
                        onPress={() => setQuickTransaction(tx)}
                        style={[
                          styles.heroSearchTab,
                          {
                            backgroundColor: active ? theme.primary : theme.backgroundElement,
                          },
                        ]}>
                        <Text
                          style={{
                            color: active ? '#FFFFFF' : theme.text,
                            fontSize: 12,
                            fontWeight: '800',
                          }}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={[styles.heroSearchRow, isMobile && styles.heroSearchRowMobile]}>
                  <View
                    style={[
                      styles.heroInputBox,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.cardBorder,
                      },
                    ]}>
                    <SymbolView
                      name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
                      size={18}
                      tintColor={theme.textSecondary}
                    />
                    <TextInput
                      style={[styles.heroInput, { color: theme.text }]}
                      placeholder="Quartier, commune, villa, parcelle..."
                      placeholderTextColor={theme.textSecondary}
                      value={quickQuery}
                      onChangeText={setQuickQuery}
                      onSubmitEditing={handleHeroSearch}
                      returnKeyType="search"
                    />
                  </View>

                  <Pressable
                    onPress={handleHeroSearch}
                    style={({ pressed }) => [
                      styles.heroSearchBtn,
                      { backgroundColor: theme.primary },
                      pressed && { opacity: 0.9 },
                    ]}>
                    <Text style={styles.heroSearchBtnText}>Rechercher</Text>
                    <SymbolView
                      name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
                      size={16}
                      tintColor="#FFFFFF"
                    />
                  </Pressable>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickCommunesRow}>
                  {BENIN_COMMUNES.slice(0, 7).map((c) => {
                    const active = quickCommune === c;
                    return (
                      <Pressable
                        key={c}
                        onPress={() => setQuickCommune(c)}
                        style={[
                          styles.communeChip,
                          {
                            backgroundColor: active ? theme.primaryLight : theme.backgroundElement,
                            borderColor: active ? theme.primary : 'transparent',
                          },
                        ]}>
                        <Text
                          style={{
                            color: active ? theme.primaryDark : theme.textSecondary,
                            fontSize: 12,
                            fontWeight: '700',
                          }}>
                          {c}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </View>
        </View>

        {/* TRUST KPI STRIP */}
        <View style={[styles.sectionWrap, { maxWidth: contentMaxWidth, paddingHorizontal: horizontalPadding }]}>
          <View
            style={[
              styles.trustGrid,
              { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
            ]}>
            {[
              { icon: '🛡️', value: '100%', label: 'Titres & pièces audités' },
              { icon: '🏠', value: '500+', label: 'Biens vérifiés au Bénin' },
              { icon: '🤝', value: '24h', label: 'Visite terrain planifiée' },
              { icon: '💳', value: '50 F', label: 'Déblocage Mobile Money' },
            ].map((stat) => (
              <View
                key={stat.label}
                style={[styles.trustCell, { width: isMobile ? '47%' : '23%' }]}>
                <Text style={styles.trustEmoji}>{stat.icon}</Text>
                <Text style={[styles.trustValue, { color: theme.primary }]}>{stat.value}</Text>
                <Text style={[styles.trustLabel, { color: theme.textSecondary }]}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* FEATURED PROPERTIES CATALOG */}
        <View style={[styles.sectionWrap, { maxWidth: contentMaxWidth, paddingHorizontal: horizontalPadding }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.sectionEyebrow, { color: theme.primary }]}>
                ✦ CATALOGUE CERTIFIÉ
              </Text>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Biens immobiliers en vedette
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Explorez les propriétés disponibles et réservez une visite en un clic.
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/explore' as any)}
              style={[styles.outlinePillBtn, { borderColor: theme.primary }]}>
              <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '800' }}>
                Tout explorer →
              </Text>
            </Pressable>
          </View>

          {/* Category Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryBar}>
            {FILTER_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setSelectedCategory(cat.id)}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: active ? theme.primary : theme.cardBackground,
                      borderColor: active ? theme.primary : theme.cardBorder,
                    },
                  ]}>
                  <Text
                    style={{
                      color: active ? '#FFFFFF' : theme.text,
                      fontSize: 13,
                      fontWeight: '700',
                    }}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {loadingProps ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 32 }} />
          ) : (
            <View style={styles.cardsGrid}>
              {displayedProperties.slice(0, 6).map((property) => (
                <View key={property.id} style={{ width: cardWidthPercent as any }}>
                  <PropertyCard
                    property={property}
                    onPressCard={handleOpenProperty}
                    onPressDetails={handleOpenProperty}
                    onToggleFavorite={handleToggleFavorite}
                    onPressQuickAction={(prop, action) => {
                      setActionProperty(prop);
                      setActionTab(action);
                    }}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* DEDICATED SPACES : CLIENT & AGENT IMMOBILIER */}
        <View style={[styles.sectionWrap, { maxWidth: contentMaxWidth, paddingHorizontal: horizontalPadding }]}>
          <Text style={[styles.sectionEyebrow, { color: theme.gold }]}>✦ ESPACES DÉDIÉS</Text>
          <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 14 }]}>
            Un parcours taillé pour chaque profil
          </Text>

          <View style={[styles.spacesGrid, !isMobile && styles.spacesGridRow]}>
            {/* Espace Client */}
            <View
              style={[
                styles.spaceCard,
                { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
              ]}>
              <View style={[styles.spaceBadge, { backgroundColor: theme.primaryLight }]}>
                <Text style={[styles.spaceBadgeText, { color: theme.primaryDark }]}>
                  CLIENT & PROPRIÉTAIRE
                </Text>
              </View>
              <Text style={[styles.spaceTitle, { color: theme.text }]}>
                Achetez, louez ou publiez votre bien
              </Text>
              <Text style={[styles.spaceDesc, { color: theme.textSecondary }]}>
                Accédez à votre espace client, déposez votre recherche sur mesure, suivez vos visites
                et publiez vos biens en toute sécurité.
              </Text>
              <View style={styles.spaceActions}>
                <Pressable
                  onPress={() => router.push('/client' as any)}
                  style={[styles.spacePrimaryBtn, { backgroundColor: theme.primary }]}>
                  <Text style={styles.spacePrimaryBtnText}>Ouvrir Espace Client</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/client-form' as any)}
                  style={[styles.spaceSecondaryBtn, { borderColor: theme.cardBorder }]}>
                  <Text style={[styles.spaceSecondaryBtnText, { color: theme.text }]}>
                    Formulaire Client
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/publish-client' as any)}
                  style={[styles.spaceSecondaryBtn, { borderColor: theme.primaryBorder }]}>
                  <Text style={[styles.spaceSecondaryBtnText, { color: theme.primaryDark }]}>
                    Publier (Client)
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Espace Agent Immobilier */}
            <View
              style={[
                styles.spaceCard,
                { backgroundColor: theme.navy, borderColor: 'rgba(245, 158, 11, 0.35)' },
              ]}>
              <View style={[styles.spaceBadge, { backgroundColor: 'rgba(245, 158, 11, 0.18)' }]}>
                <Text style={[styles.spaceBadgeText, { color: '#FDE68A' }]}>
                  AGENT IMMOBILIER AGRÉÉ
                </Text>
              </View>
              <Text style={[styles.spaceTitle, { color: '#FFFFFF' }]}>
                Pilotez votre portefeuille & vos clients
              </Text>
              <Text style={[styles.spaceDesc, { color: '#CBD5E1' }]}>
                Tableau de bord professionnel, gestion des annonces au tarif préférentiel de 100 F CFA,
                suivi des visites, demandes et prospects.
              </Text>
              <View style={styles.spaceActions}>
                <Pressable
                  onPress={() => router.push('/agent' as any)}
                  style={[styles.spacePrimaryBtn, { backgroundColor: '#F59E0B' }]}>
                  <Text style={[styles.spacePrimaryBtnText, { color: '#0F172A' }]}>
                    Tableau de bord Agent
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/publish-agent' as any)}
                  style={[styles.spaceSecondaryBtn, { borderColor: 'rgba(255,255,255,0.28)' }]}>
                  <Text style={[styles.spaceSecondaryBtnText, { color: '#FFFFFF' }]}>
                    Publier (Agent 100 F)
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* HOW IT WORKS */}
        <View style={[styles.sectionWrap, { maxWidth: contentMaxWidth, paddingHorizontal: horizontalPadding }]}>
          <View
            style={[
              styles.aboutSection,
              { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
            ]}>
            <Text style={[styles.sectionEyebrow, { color: theme.gold }]}>✦ COMMENT ÇA MARCHE</Text>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Votre projet immobilier en 3 étapes simples
            </Text>

            <View style={[styles.stepsGrid, !isMobile && styles.stepsGridRow]}>
              {[
                {
                  num: '01',
                  title: 'Recherchez & Filtrez',
                  desc: 'Affinez par commune, quartier, budget, surface, nombre de chambres et commodités.',
                },
                {
                  num: '02',
                  title: 'Contactez ou Planifiez',
                  desc: 'Demandez une visite, prenez rendez-vous ou contactez le propriétaire / agent directement.',
                },
                {
                  num: '03',
                  title: 'Visitez en Sécurité',
                  desc: 'Nos conseillers vérifient les titres fonciers et vous accompagnent jusqu’à la signature.',
                },
              ].map((step) => (
                <View
                  key={step.num}
                  style={[
                    styles.stepCard,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.cardBorder },
                  ]}>
                  <Text style={[styles.stepNum, { color: theme.primary }]}>{step.num}</Text>
                  <Text style={[styles.stepTitle, { color: theme.text }]}>{step.title}</Text>
                  <Text style={[styles.stepDesc, { color: theme.textSecondary }]}>{step.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* CONTACT & FINAL CTA */}
        <View style={[styles.sectionWrap, { maxWidth: contentMaxWidth, paddingHorizontal: horizontalPadding }]}>
          <View style={[styles.ctaBanner, { backgroundColor: theme.navy }]}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={styles.ctaEyebrow}>✦ ACCOMPAGNEMENT SUR MESURE</Text>
              <Text style={styles.ctaTitle}>
                Vous cherchez une maison ou souhaitez publier aujourd'hui ?
              </Text>
              <Text style={styles.ctaDesc}>
                Créez votre compte gratuit en moins d'une minute ou remplissez notre formulaire client
                pour être rappelé par un conseiller à Cotonou.
              </Text>
            </View>
            <View style={styles.ctaBtns}>
              <Pressable onPress={onOpenRegister} style={styles.ctaGoldBtn}>
                <Text style={styles.ctaGoldBtnText}>Créer un compte gratuit</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/client-form' as any)}
                style={styles.ctaOutlineBtn}>
                <Text style={styles.ctaOutlineBtnText}>Remplir le formulaire client</Text>
              </Pressable>
            </View>
          </View>

          {/* Compact Footer */}
          <View style={[styles.footer, { borderTopColor: theme.cardBorder }]}>
            <Text style={[styles.footerCopy, { color: theme.textSecondary }]}>
              © 2026 E-Mobilier Bénin — Cadjehoun, Cotonou • +229 01 97 00 11 22 • contact@e-mobilier.bj
            </Text>
            <View style={styles.footerLinks}>
              <Pressable onPress={() => router.push('/cgu' as any)}>
                <Text style={[styles.footerLink, { color: theme.primary }]}>CGU & Charte</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/explore' as any)}>
                <Text style={[styles.footerLink, { color: theme.primary }]}>Recherche</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/client-form' as any)}>
                <Text style={[styles.footerLink, { color: theme.primary }]}>Contact</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Quick Property Action Modal */}
      {actionProperty && (
        <PropertyActionModal
          visible={Boolean(actionProperty)}
          initialAction={actionTab}
          propertyId={actionProperty.backendId ?? null}
          propertyTitle={actionProperty.title}
          propertyLocation={actionProperty.location.fullAddress}
          onClose={() => setActionProperty(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topHeader: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    zIndex: 20,
    alignItems: 'center',
  },
  headerInner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brandTextWrap: { flexShrink: 1, minWidth: 0 },
  brandTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: -0.2 },
  flagBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  flagText: { color: '#FDE68A', fontSize: 9, fontWeight: '800' },
  brandSubtitle: { color: '#94A3B8', fontSize: 11, fontWeight: '500' },
  desktopNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navLinkBtn: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
  },
  navLinkText: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  themeHeaderBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeHeaderIcon: { fontSize: 15 },
  loginHeaderBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.25)',
  },
  loginHeaderText: { color: '#F8FAFC', fontSize: 12, fontWeight: '700' },
  registerHeaderBtn: {
    backgroundColor: '#F59E0B',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 9,
  },
  registerHeaderText: { color: '#0F172A', fontSize: 12, fontWeight: '800' },
  scrollContent: { flexGrow: 1, gap: 28 },

  /* HERO */
  heroContainer: {
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
  },
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 15, 25, 0.72)',
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInner: {
    width: '100%',
    gap: 14,
  },
  heroTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: 'rgba(245, 158, 11, 0.45)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  heroTagText: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  heroMainTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    maxWidth: 740,
  },
  heroDescription: {
    color: '#CBD5E1',
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 620,
  },
  heroSearchCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    marginTop: 6,
    maxWidth: 820,
    ...Platform.select({
      web: { boxShadow: '0 14px 36px rgba(0,0,0,0.22)' },
    }),
  },
  heroSearchTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  heroSearchTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  heroSearchRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  heroSearchRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  heroInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    gap: 8,
  },
  heroInput: {
    flex: 1,
    fontSize: 14,
    ...Platform.select({ web: { outlineStyle: 'none' } as any }),
  },
  heroSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
    height: 46,
    borderRadius: 12,
  },
  heroSearchBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  quickCommunesRow: {
    gap: 8,
  },
  communeChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },

  /* SECTIONS */
  sectionWrap: {
    width: '100%',
    alignSelf: 'center',
  },
  trustGrid: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  trustCell: {
    alignItems: 'center',
    paddingVertical: 6,
    gap: 2,
  },
  trustEmoji: { fontSize: 22, marginBottom: 2 },
  trustValue: { fontSize: 22, fontWeight: '900' },
  trustLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  sectionHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
    marginBottom: 14,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 23,
    fontWeight: '900',
  },
  sectionSubtitle: {
    fontSize: 14,
    marginTop: 3,
  },
  outlinePillBtn: {
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  categoryBar: {
    gap: 8,
    paddingBottom: 16,
  },
  catChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'flex-start',
  },

  /* SPACES */
  spacesGrid: {
    gap: 16,
  },
  spacesGridRow: {
    flexDirection: 'row',
  },
  spaceCard: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 22,
    gap: 10,
    justifyContent: 'space-between',
  },
  spaceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  spaceBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  spaceTitle: { fontSize: 20, fontWeight: '900' },
  spaceDesc: { fontSize: 14, lineHeight: 21 },
  spaceActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  spacePrimaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  spacePrimaryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  spaceSecondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  spaceSecondaryBtnText: { fontSize: 13, fontWeight: '700' },

  /* STEPS */
  aboutSection: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
    gap: 14,
  },
  stepsGrid: { gap: 12 },
  stepsGridRow: { flexDirection: 'row' },
  stepCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  stepNum: { fontSize: 24, fontWeight: '900' },
  stepTitle: { fontSize: 16, fontWeight: '800' },
  stepDesc: { fontSize: 13, lineHeight: 19 },

  /* CTA BANNER */
  ctaBanner: {
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
  },
  ctaEyebrow: { color: '#FDE68A', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  ctaTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  ctaDesc: { color: '#CBD5E1', fontSize: 14, lineHeight: 21, maxWidth: 580 },
  ctaBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ctaGoldBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 12,
  },
  ctaGoldBtnText: { color: '#0F172A', fontSize: 14, fontWeight: '900' },
  ctaOutlineBtn: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 12,
  },
  ctaOutlineBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  /* FOOTER */
  footer: {
    marginTop: 24,
    paddingTop: 18,
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  footerCopy: { fontSize: 12 },
  footerLinks: { flexDirection: 'row', gap: 16 },
  footerLink: { fontSize: 13, fontWeight: '700' },
});
