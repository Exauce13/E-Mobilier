import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  ArrowRight,
  Bell,
  Building2,
  Calendar,
  LogOut,
  Moon,
  PlusCircle,
  Search,
  Settings,
  Sparkles,
  Sun,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { LandingShowcase } from '@/components/home/landing-showcase';
import { PropertyCard } from '@/components/property-card';
import { SuperAdminPrincipalPortal } from '@/components/super-admin/super-admin-portal';
import { FILTER_CATEGORIES } from '@/constants/locations';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useThemeMode } from '@/context/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { getStorageBaseUrl, proprietesApi } from '@/services/api';
import { favoritesStorage } from '@/services/local-store';
import type { BackendProperty } from '@/types/api';
import {
  mapBackendPropertyToItem,
  PropertyCategory,
  PropertyItem,
} from '@/types/property';

export default function HomeScreen() {
  const { isAuthenticated, isSuperAdminPrincipal, openAuthModal } = useAuth();

  if (!isAuthenticated) {
    return (
      <LandingShowcase
        onOpenLogin={() => openAuthModal('login')}
        onOpenRegister={() => openAuthModal('register')}
      />
    );
  }

  if (isSuperAdminPrincipal) {
    return <SuperAdminPrincipalPortal initialPage="dashboard" />;
  }

  return <AuthenticatedCatalog />;
}

function AuthenticatedCatalog() {
  const theme = useTheme();
  const { isDark, toggleTheme } = useThemeMode();
  const insets = useSafeAreaInsets();
  const { isMobile, gridColumns, contentMaxWidth, horizontalPadding } = useResponsive();
  const {
    user,
    logout,
    unreadNotificationsCount,
    refreshUnreadCount,
    isAdminStaff,
    isAgentMobilier,
    isClient,
  } = useAuth();
  const storageBaseUrl = useMemo(() => getStorageBaseUrl(), []);

  const [selectedCategory, setSelectedCategory] = useState<PropertyCategory>('tous');
  const [selectedTransaction, setSelectedTransaction] = useState<'tous' | 'location' | 'vente'>('tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 320);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    void favoritesStorage.getAll().then(setFavoriteIds);
  }, []);

  const fetchFeed = useCallback(
    async (targetPage: number, replace: boolean) => {
      setErrorMsg(null);
      const favs = await favoritesStorage.getAll();
      setFavoriteIds(favs);

      const res = await proprietesApi.getFeed({
        type: selectedCategory === 'tous' ? undefined : selectedCategory,
        transaction_type: selectedTransaction === 'tous' ? undefined : selectedTransaction,
        search: debouncedSearch || undefined,
        page: targetPage,
        per_page: 18,
      });

      if (!res.success || !res.data) {
        if (replace) {
          setProperties([]);
        }
        setErrorMsg(res.message || 'Impossible de charger les annonces.');
        return;
      }

      const mapped = (res.data.data || []).map((p: BackendProperty) =>
        mapBackendPropertyToItem(p, storageBaseUrl, favs)
      );

      setPage(res.data.current_page || targetPage);
      setLastPage(res.data.last_page || 1);
      setProperties((prev) => (replace ? mapped : [...prev, ...mapped]));
    },
    [selectedCategory, selectedTransaction, debouncedSearch, storageBaseUrl]
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      await fetchFeed(1, true);
      if (active) setLoading(false);
    };
    void load();
    void refreshUnreadCount();
    return () => {
      active = false;
    };
  }, [fetchFeed, refreshUnreadCount]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchFeed(1, true), refreshUnreadCount()]);
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (loadingMore || loading || page >= lastPage) return;
    setLoadingMore(true);
    await fetchFeed(page + 1, false);
    setLoadingMore(false);
  };

  const handleToggleFavorite = async (id: string) => {
    const next = await favoritesStorage.toggle(id);
    setFavoriteIds(next);
    setProperties((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isFavorite: next.has(id) } : item))
    );
  };

  const handleOpenProperty = (property: PropertyItem) => {
    router.push(`/property/${property.id}` as any);
  };

  const cardWidthPercent =
    gridColumns === 3 ? '31.8%' : gridColumns === 2 ? '48.5%' : '100%';

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: BottomTabInset + insets.bottom + 84,
          },
        ]}>
        <View style={[styles.innerWrap, { maxWidth: contentMaxWidth }]}>
          {/* Top Navigation Bar */}
          <View style={styles.brandRow}>
            <View style={styles.brandTitleGroup}>
              <View style={styles.titleWithFlag}>
                <Building2 size={20} color={theme.primary} strokeWidth={2.2} />
                <Text numberOfLines={1} style={[styles.brandName, { color: theme.primary }]}>
                  E-Mobilier
                </Text>
                <View style={[styles.flagChip, { backgroundColor: theme.backgroundElement }]}>
                  <Text style={[styles.flagText, { color: theme.text }]}>BÉNIN</Text>
                </View>
              </View>
              <Text numberOfLines={1} style={[styles.brandSubtitle, { color: theme.textSecondary }]}>
                Bonjour {user?.prenom || user?.name?.split(' ')[0] || 'Bienvenue'} • Catalogue certifié
              </Text>
            </View>

            <View style={styles.headerActions}>
              <Pressable
                onPress={() => {
                  void toggleTheme();
                }}
                style={[
                  styles.iconCircleBtn,
                  { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                ]}
                hitSlop={6}>
                {isDark ? (
                  <Moon size={17} color={theme.text} strokeWidth={2} />
                ) : (
                  <Sun size={17} color={theme.text} strokeWidth={2} />
                )}
              </Pressable>

              <Pressable
                onPress={() => router.push('/notifications' as any)}
                style={[
                  styles.iconCircleBtn,
                  { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                ]}
                hitSlop={8}>
                <Bell size={17} color={theme.text} strokeWidth={2} />
                {unreadNotificationsCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                    </Text>
                  </View>
                )}
              </Pressable>

              <Pressable
                onPress={() => {
                  void logout();
                }}
                style={[
                  styles.logoutPill,
                  { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                ]}
                hitSlop={6}>
                <LogOut size={15} color="#DC2626" strokeWidth={2} />
                {!isMobile && (
                  <Text style={styles.logoutPillText}>Déconnexion</Text>
                )}
              </Pressable>
            </View>
          </View>

          {/* Compact Modern Hero */}
          <View style={[styles.heroBanner, { backgroundColor: theme.navy }]}>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.heroBadgeRow}>
                <Sparkles size={13} color="#FDE68A" strokeWidth={2.2} />
                <Text style={styles.heroBadge}>CATALOGUE IMMOBILIER EN TEMPS RÉEL</Text>
              </View>
              <Text style={[styles.heroTitle, !isMobile && { fontSize: 24 }]}>
                Trouvez le bien idéal ou publiez votre annonce
              </Text>
              <Text style={styles.heroSub}>
                Explorez nos biens vérifiés à louer ou à vendre, suivez vos annonces et planifiez vos visites.
              </Text>
            </View>

            <View style={styles.quickNavGrid}>
              <Pressable
                onPress={() => router.push('/publish' as any)}
                style={[styles.quickActionBtn, { backgroundColor: theme.primary }]}>
                <PlusCircle size={15} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.quickActionText}>Publier une annonce</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/explore' as any)}
                style={[styles.quickActionBtn, styles.quickActionOutline]}>
                <Search size={15} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.quickActionText}>Recherche avancée</Text>
              </Pressable>
              {isAgentMobilier ? (
                <Pressable
                  onPress={() => router.push('/agent' as any)}
                  style={[styles.quickActionBtn, styles.quickActionOutline]}>
                  <Building2 size={15} color="#FDE68A" strokeWidth={2} />
                  <Text style={[styles.quickActionText, { color: '#FDE68A' }]}>Espace Agent</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => router.push('/my-properties' as any)}
                  style={[styles.quickActionBtn, styles.quickActionOutline]}>
                  <Building2 size={15} color="#FFFFFF" strokeWidth={2} />
                  <Text style={styles.quickActionText}>Mes annonces</Text>
                </Pressable>
              )}
              {isClient && (
                <Pressable
                  onPress={() => router.push('/search-requests' as any)}
                  style={[styles.quickActionBtn, styles.quickActionOutline]}>
                  <ArrowRight size={15} color="#FFFFFF" strokeWidth={2} />
                  <Text style={styles.quickActionText}>Mes recherches</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => router.push('/visits' as any)}
                style={[styles.quickActionBtn, styles.quickActionOutline]}>
                <Calendar size={15} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.quickActionText}>Mes visites</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/transactions' as any)}
                style={[styles.quickActionBtn, styles.quickActionOutline]}>
                <Sparkles size={15} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.quickActionText}>Paiements &amp; Reçus</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/profile' as any)}
                style={[styles.quickActionBtn, styles.quickActionOutline]}>
                <Settings size={15} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.quickActionText}>Mon Profil</Text>
              </Pressable>
              {isAdminStaff && (
                <Pressable
                  onPress={() => router.push('/admin' as any)}
                  style={[styles.quickActionBtn, styles.quickActionOutline]}>
                  <Settings size={15} color="#FDE68A" strokeWidth={2} />
                  <Text style={[styles.quickActionText, { color: '#FDE68A' }]}>Admin</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Search & Filters Bar */}
          <View
            style={[
              styles.filterCard,
              { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
            ]}>
            <View
              style={[
                styles.searchContainer,
                { backgroundColor: theme.backgroundElement, borderColor: theme.cardBorder },
              ]}>
              <Search size={18} color={theme.textSecondary} strokeWidth={2} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Rechercher commune, quartier, villa, parcelle..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <X size={18} color={theme.textSecondary} strokeWidth={2} />
                </Pressable>
              )}
            </View>

            <View style={styles.filtersLine}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScroll}>
                {FILTER_CATEGORIES.map((category) => {
                  const isActive = selectedCategory === category.id;
                  return (
                    <Pressable
                      key={category.id}
                      onPress={() => setSelectedCategory(category.id)}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: isActive ? theme.primary : theme.backgroundElement,
                          borderColor: isActive ? theme.primary : 'transparent',
                        },
                      ]}>
                      <Text
                        style={{
                          fontSize: 13,
                          color: isActive ? '#FFFFFF' : theme.tagText,
                          fontWeight: isActive ? '700' : '600',
                        }}>
                        {category.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={[styles.txSegmented, { backgroundColor: theme.backgroundElement }]}>
                {(['tous', 'location', 'vente'] as const).map((tr) => {
                  const active = selectedTransaction === tr;
                  const label = tr === 'tous' ? 'Tous' : tr === 'location' ? 'Louer' : 'Vendre';
                  return (
                    <Pressable
                      key={tr}
                      onPress={() => setSelectedTransaction(tr)}
                      style={[
                        styles.txBtn,
                        active && { backgroundColor: theme.cardBackground },
                      ]}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: active ? theme.primary : theme.textSecondary,
                        }}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Featured Horizontal Carousel */}
          {properties.length > 1 && (
            <View style={styles.featuredBlock}>
              <View style={styles.resultsRow}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Propriétés en vedette
                </Text>
                <Pressable
                  onPress={() => router.push('/explore' as any)}
                  style={styles.inlineLinkRow}>
                  <Text style={[styles.resultsLink, { color: theme.primary }]}>
                    Filtres avancés
                  </Text>
                  <ArrowRight size={14} color={theme.primary} strokeWidth={2.2} />
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.featuredContent}>
                {properties.slice(0, 6).map((item) => (
                  <Pressable
                    key={`featured-${item.id}`}
                    onPress={() => handleOpenProperty(item)}
                    style={[
                      styles.featuredCard,
                      { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                    ]}>
                    <Image source={item.image} style={styles.featuredImage} contentFit="cover" />
                    <View style={styles.featuredCardBody}>
                      <Text numberOfLines={1} style={[styles.featuredTitle, { color: theme.text }]}>
                        {item.title}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[styles.featuredLocation, { color: theme.textSecondary }]}>
                        {item.location.commune}
                        {item.location.quartier ? ` • ${item.location.quartier}` : ''}
                      </Text>
                      <Text numberOfLines={1} style={[styles.featuredPrice, { color: theme.primary }]}>
                        {item.priceFormatted}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Main Responsive Grid */}
          <View style={styles.resultsRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {selectedCategory === 'tous' ? 'Tous les biens disponibles' : `Catégorie : ${selectedCategory}`}
            </Text>
            <Text style={[styles.resultsCount, { color: theme.textSecondary }]}>
              {properties.length} bien{properties.length > 1 ? 's' : ''}
            </Text>
          </View>

          {loading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Chargement du catalogue E-Mobilier...
              </Text>
            </View>
          ) : properties.length === 0 ? (
            <View
              style={[
                styles.emptyContainer,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                  borderWidth: 1,
                  borderRadius: 20,
                },
              ]}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {errorMsg ? 'Erreur de chargement' : 'Aucun bien ne correspond'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                {errorMsg || 'Essayez d’autres filtres ou déposez une demande de recherche personnalisée.'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                <Pressable
                  onPress={handleRefresh}
                  style={[styles.retryBtn, { backgroundColor: theme.primary }]}>
                  <Text style={styles.retryText}>Actualiser</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/search-requests' as any)}
                  style={[styles.retryBtn, { backgroundColor: theme.navy }]}>
                  <Text style={styles.retryText}>Déposer une demande</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.cardsGrid}>
                {properties.map((item) => (
                  <View key={item.id} style={{ width: cardWidthPercent as any }}>
                    <PropertyCard
                      property={item}
                      onPressCard={handleOpenProperty}
                      onPressDetails={handleOpenProperty}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  </View>
                ))}
              </View>

              {page < lastPage && (
                <Pressable
                  onPress={handleLoadMore}
                  disabled={loadingMore}
                  style={[styles.loadMoreBtn, { borderColor: theme.primary }]}>
                  {loadingMore ? (
                    <ActivityIndicator color={theme.primary} />
                  ) : (
                    <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 14 }}>
                      Charger plus d'annonces
                    </Text>
                  )}
                </Pressable>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingTop: Spacing.two },
  innerWrap: { width: '100%', alignSelf: 'center', gap: 16 },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  brandTitleGroup: { flex: 1, minWidth: 0 },
  titleWithFlag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandName: { fontSize: 21, fontWeight: '900', letterSpacing: -0.5 },
  flagChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  flagText: { fontSize: 10, fontWeight: '800' },
  brandSubtitle: { fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  iconCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  logoutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
  },
  logoutPillText: { color: '#DC2626', fontSize: 12, fontWeight: '800' },

  heroBanner: {
    borderRadius: 22,
    padding: 20,
    gap: 14,
  },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroBadge: { color: '#FDE68A', fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  heroSub: { color: '#CBD5E1', fontSize: 13, lineHeight: 19 },
  quickNavGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  quickActionOutline: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  quickActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },

  filterCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 46,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    ...Platform.select({ web: { outlineStyle: 'none' } as any }),
  },
  filtersLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  filterScroll: { gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  txSegmented: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 12,
    gap: 3,
  },
  txBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
  },

  featuredBlock: { gap: 10 },
  featuredContent: { gap: 12, paddingBottom: 4 },
  featuredCard: {
    width: 248,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  featuredImage: { width: '100%', height: 132 },
  featuredCardBody: { padding: 12, gap: 3 },
  featuredTitle: { fontSize: 14, fontWeight: '800' },
  featuredLocation: { fontSize: 12 },
  featuredPrice: { fontSize: 14, fontWeight: '900', marginTop: 2 },

  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inlineLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  resultsCount: { fontSize: 13, fontWeight: '600' },
  resultsLink: { fontSize: 13, fontWeight: '800' },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  loadMoreBtn: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  emptyContainer: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
