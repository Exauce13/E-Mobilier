import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { UnlockModal } from '@/components/unlock-modal';
import { FILTER_CATEGORIES } from '@/constants/locations';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useThemeMode } from '@/context/theme-context';
import { useTheme } from '@/hooks/use-theme';
import { getStorageBaseUrl, proprietesApi } from '@/services/api';
import type { BackendProperty } from '@/types/api';
import {
  mapBackendPropertyToItem,
  PropertyCategory,
  PropertyItem,
} from '@/types/property';

export default function HomeScreen() {
  const { isAuthenticated, openAuthModal } = useAuth();

  if (!isAuthenticated) {
    return (
      <LandingShowcase
        onOpenLogin={() => openAuthModal('login')}
        onOpenRegister={() => openAuthModal('register')}
      />
    );
  }

  return <AuthenticatedCatalog />;
}

function AuthenticatedCatalog() {
  const theme = useTheme();
  const { isDark, toggleTheme } = useThemeMode();
  const insets = useSafeAreaInsets();
  const { user, unreadNotificationsCount, refreshUnreadCount } = useAuth();
  const storageBaseUrl = useMemo(() => getStorageBaseUrl(), []);

  const [selectedCategory, setSelectedCategory] = useState<PropertyCategory>('tous');
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

  const [unlockModalVisible, setUnlockModalVisible] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PropertyItem | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchFeed = useCallback(
    async (targetPage: number, replace: boolean) => {
      setErrorMsg(null);
      const res = await proprietesApi.getFeed({
        type: selectedCategory === 'tous' ? undefined : selectedCategory,
        search: debouncedSearch || undefined,
        page: targetPage,
        per_page: 15,
      });

      if (!res.success || !res.data) {
        setErrorMsg(res.message || 'Impossible de charger les annonces.');
        return;
      }

      const mapped = (res.data.data || []).map((p: BackendProperty) =>
        mapBackendPropertyToItem(p, storageBaseUrl, favoriteIds)
      );

      setPage(res.data.current_page || targetPage);
      setLastPage(res.data.last_page || 1);
      setProperties((prev) => (replace ? mapped : [...prev, ...mapped]));
    },
    [selectedCategory, debouncedSearch, storageBaseUrl, favoriteIds]
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

  const handleToggleFavorite = (id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setProperties((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isFavorite: !item.isFavorite } : item))
    );
  };

  const handleOpenProperty = (property: PropertyItem) => {
    router.push(`/property/${property.id}` as any);
  };

  const handlePressDetails = (property: PropertyItem) => {
    if (property.isUnlocked) {
      handleOpenProperty(property);
      return;
    }
    setSelectedProperty(property);
    setUnlockModalVisible(true);
  };

  const handleConfirmUnlock = (unlockedProp: PropertyItem, updatedBackend?: BackendProperty) => {
    const refreshedItem = updatedBackend
      ? mapBackendPropertyToItem(updatedBackend, storageBaseUrl, favoriteIds)
      : { ...unlockedProp, isUnlocked: true };

    setProperties((prev) => prev.map((p) => (p.id === refreshedItem.id ? refreshedItem : p)));
    setSelectedProperty(refreshedItem);
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: BottomTabInset + Spacing.six + insets.bottom },
        ]}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            {/* Top Bar */}
            <View style={styles.brandRow}>
              <View style={styles.brandTitleGroup}>
                <View style={styles.titleWithFlag}>
                  <Text numberOfLines={1} style={[styles.brandName, { color: theme.primary }]}>
                    E-Mobilier
                  </Text>
                  <View style={[styles.flagChip, { backgroundColor: theme.backgroundElement }]}>
                    <Text style={[styles.flagText, { color: theme.text }]}>🇧🇯 BÉNIN</Text>
                  </View>
                </View>
                <Text numberOfLines={1} style={[styles.brandSubtitle, { color: theme.textSecondary }]}>
                  Catalogue certifié en temps réel
                </Text>
              </View>

              <View style={styles.headerActions}>
                <Pressable
                  onPress={() => {
                    void toggleTheme();
                  }}
                  style={[
                    styles.themeButton,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}
                  hitSlop={6}>
                  <Text style={styles.themeButtonText}>{isDark ? '🌙' : '☀️'}</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push('/notifications' as any)}
                  style={[
                    styles.notificationButton,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}
                  hitSlop={8}>
                  <SymbolView
                    name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
                    size={18}
                    tintColor={theme.text}
                  />
                  {unreadNotificationsCount > 0 && (
                    <View style={styles.notificationBadge}>
                      <Text style={styles.notificationBadgeText}>
                        {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                      </Text>
                    </View>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => router.push('/profile' as any)}
                  style={[
                    styles.topAuthButton,
                    { backgroundColor: theme.primaryLight, borderColor: theme.primary },
                  ]}>
                  <SymbolView
                    name={{ ios: 'person.crop.circle.fill', android: 'person', web: 'person' }}
                    size={14}
                    tintColor={theme.primary}
                  />
                  <Text numberOfLines={1} style={[styles.topAuthButtonText, { color: theme.primaryDark }]}>
                    {user?.name ? user.name.split(' ')[0] : 'Profil'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Search Input */}
            <View
              style={[
                styles.searchContainer,
                { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
              ]}>
              <SymbolView
                name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
                size={19}
                tintColor={theme.textSecondary}
              />
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
                  <SymbolView
                    name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                    size={18}
                    tintColor={theme.textSecondary}
                  />
                </Pressable>
              )}
            </View>

            {/* Category Chips */}
            <ScrollView
              horizontal
              nestedScrollEnabled={true}
              directionalLockEnabled={true}
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0 }}
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
                        backgroundColor: isActive ? theme.primary : theme.cardBackground,
                        borderColor: isActive ? theme.primary : theme.cardBorder,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: isActive ? '#FFFFFF' : theme.tagText, fontWeight: isActive ? '700' : '500' },
                      ]}>
                      {category.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Quick Action Banner */}
            <Pressable
              onPress={() => router.push('/search-requests' as any)}
              style={[styles.promoBanner, { backgroundColor: theme.navyLight }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.promoTitle}>Vous cherchez un bien précis ?</Text>
                <Text style={styles.promoSub}>
                  Publiez une demande de recherche et laissez nos agents trouver pour vous.
                </Text>
              </View>
              <View style={[styles.promoBtn, { backgroundColor: theme.gold }]}>
                <Text style={styles.promoBtnText}>Demander</Text>
              </View>
            </Pressable>

            {/* Featured Properties Horizontal Carousel */}
            {properties.length > 0 && (
              <View style={styles.featuredBlock}>
                <View style={styles.resultsRow}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Propriétés en vedette
                  </Text>
                  <Text style={[styles.resultsCount, { color: theme.primary }]}>
                    Faire défiler →
                  </Text>
                </View>
                <FlatList
                  data={properties.slice(0, 6)}
                  horizontal
                  nestedScrollEnabled={true}
                  directionalLockEnabled={true}
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item) => `featured-${item.id}`}
                  style={styles.featuredList}
                  contentContainerStyle={styles.featuredContent}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => handleOpenProperty(item)}
                      style={[
                        styles.featuredCard,
                        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                      ]}>
                      <Image
                        source={typeof item.image === 'string' ? { uri: item.image } : item.image}
                        style={styles.featuredImage}
                        contentFit="cover"
                      />
                      <View style={styles.featuredCardBody}>
                        <Text numberOfLines={1} style={[styles.featuredTitle, { color: theme.text }]}>
                          {item.title}
                        </Text>
                        <Text numberOfLines={1} style={[styles.featuredLocation, { color: theme.textSecondary }]}>
                          {item.location.commune} • {item.location.quartier}
                        </Text>
                        <Text numberOfLines={1} style={[styles.featuredPrice, { color: theme.primary }]}>
                          {item.priceFormatted}
                        </Text>
                      </View>
                    </Pressable>
                  )}
                />
              </View>
            )}

            <View style={styles.resultsRow}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {selectedCategory === 'tous' ? 'Biens disponibles' : `Catégorie : ${selectedCategory}`}
              </Text>
              <Text style={[styles.resultsCount, { color: theme.textSecondary }]}>
                {properties.length} affiché{properties.length > 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <PropertyCard
            property={item}
            onPressCard={handleOpenProperty}
            onPressDetails={handlePressDetails}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Chargement du catalogue E-Mobilier...
              </Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {errorMsg ? 'Erreur de chargement' : 'Aucun bien disponible'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                {errorMsg || 'Essayez une autre catégorie ou publiez votre demande de recherche.'}
              </Text>
              <Pressable
                onPress={handleRefresh}
                style={[styles.retryBtn, { backgroundColor: theme.primary }]}>
                <Text style={styles.retryText}>Actualiser</Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: Spacing.three }} />
          ) : undefined
        }
      />

      <UnlockModal
        visible={unlockModalVisible}
        property={selectedProperty}
        onClose={() => setUnlockModalVisible(false)}
        onConfirmUnlock={handleConfirmUnlock}
        onOpenFullDetails={handleOpenProperty}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  headerContainer: { marginBottom: Spacing.two },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.three,
  },
  brandTitleGroup: { flex: 1, minWidth: 0, flexShrink: 1 },
  titleWithFlag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandName: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5, flexShrink: 1 },
  flagChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexShrink: 0 },
  flagText: { fontSize: 10, fontWeight: '800' },
  brandSubtitle: { fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  themeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeButtonText: { fontSize: 15 },
  notificationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  topAuthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: 98,
  },
  topAuthButtonText: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  featuredBlock: { marginBottom: Spacing.two },
  featuredList: { flexGrow: 0 },
  featuredContent: { gap: 12, paddingRight: 4, paddingBottom: Spacing.two },
  featuredCard: {
    width: 244,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  featuredImage: { width: '100%', height: 128 },
  featuredCardBody: { padding: 10, gap: 3 },
  featuredTitle: { fontSize: 14, fontWeight: '800' },
  featuredLocation: { fontSize: 11 },
  featuredPrice: { fontSize: 13, fontWeight: '900', marginTop: 2 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    height: 48,
    gap: 10,
    marginBottom: Spacing.three,
  },
  searchInput: { flex: 1, fontSize: 15, ...Platform.select({ web: { outlineStyle: 'none' } as any }) },
  filterScroll: { gap: 8, paddingBottom: Spacing.three },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 13 },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 16,
    gap: 12,
    marginBottom: Spacing.three,
  },
  promoTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  promoSub: { color: '#CBD5E1', fontSize: 12, marginTop: 2, lineHeight: 16 },
  promoBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  promoBtnText: { color: '#0F172A', fontSize: 12, fontWeight: '800' },
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  resultsCount: { fontSize: 13, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', paddingVertical: Spacing.six, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: Spacing.four },
  retryBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, marginTop: 6 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
