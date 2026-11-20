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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LandingShowcase } from '@/components/home/landing-showcase';
import { PropertyCard } from '@/components/property-card';
import { InstitutionHeader } from '@/components/ui/institution-header';
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
  const [totalCount, setTotalCount] = useState(148);
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
      try {
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
        if (res.data.total) setTotalCount(res.data.total);
        setProperties((prev) => (replace ? mapped : [...prev, ...mapped]));
      } catch (err: any) {
        setErrorMsg(err.message || 'Erreur réseau');
      }
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
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* Stitch Institution Header */}
      <InstitutionHeader />

      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primaryContainer} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: BottomTabInset + Spacing.six + insets.bottom },
        ]}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            {/* Cadastre Anti-Fraud Alert Banner (Stitch) */}
            <View
              style={[
                styles.antiFraudBanner,
                { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder },
              ]}>
              <View style={[styles.antiFraudIconBox, { backgroundColor: theme.primaryContainer }]}>
                <SymbolView
                  name={{ ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' }}
                  size={16}
                  tintColor="#FFFFFF"
                />
              </View>
              <View style={styles.antiFraudTextWrap}>
                <Text style={[styles.antiFraudTitle, { color: theme.text }]}>
                  Garantie Anti-Fraude Cadastre Bénin
                </Text>
                <Text style={[styles.antiFraudDesc, { color: theme.textSecondary }]}>
                  Coordonnées GPS et repères notariés protégés contre la spéculation illégale.
                </Text>
              </View>
            </View>

            {/* Search Input Bar with Filter Action */}
            <View
              style={[
                styles.searchBar,
                { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
              ]}>
              <SymbolView
                name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
                size={18}
                tintColor={theme.primaryContainer}
              />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Rechercher Cotonou, Calavi, TF, parcelle..."
                placeholderTextColor={theme.outline}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <SymbolView
                    name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                    size={16}
                    tintColor={theme.outline}
                  />
                </Pressable>
              )}
              <Pressable
                onPress={() => router.push('/explore' as any)}
                style={[styles.filterTuneBtn, { backgroundColor: theme.surfaceContainerLow }]}>
                <SymbolView
                  name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }}
                  size={16}
                  tintColor={theme.text}
                />
              </Pressable>
            </View>

            {/* Category Chips Scroll (Stitch design) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryChipsScroll}>
              {FILTER_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => setSelectedCategory(cat.id)}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: isSelected ? theme.primaryContainer : theme.surfaceContainerLowest,
                        borderColor: isSelected ? theme.primaryContainer : theme.cardBorder,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: isSelected ? '#FFFFFF' : theme.text },
                      ]}>
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Live Count & Certification Tag */}
            <View style={styles.resultsMetaRow}>
              <Text style={[styles.resultsCountText, { color: theme.textSecondary }]}>
                {properties.length} biens certifiés disponibles
              </Text>
              <View style={styles.andfVerifiedTag}>
                <SymbolView
                  name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }}
                  size={12}
                  tintColor={theme.tertiaryFixedDim || theme.gold}
                />
                <Text style={[styles.andfVerifiedText, { color: theme.tertiary }]}>
                  Certifié ANDF
                </Text>
              </View>
            </View>

            {errorMsg ? (
              <View style={[styles.errorBox, { backgroundColor: theme.errorContainer }]}>
                <Text style={[styles.errorText, { color: theme.error }]}>{errorMsg}</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <PropertyCard
            property={item}
            onPressDetails={handlePressDetails}
            onPressCard={handleOpenProperty}
            onToggleFavorite={handleToggleFavorite}
            onUnlockPress={handlePressDetails}
            onVisitPress={handleOpenProperty}
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <View
              style={[
                styles.emptyContainer,
                { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
              ]}>
              <SymbolView
                name={{ ios: 'doc.text.magnifyingglass', android: 'search_off', web: 'search_off' }}
                size={36}
                tintColor={theme.outline}
              />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Aucun bien trouvé</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Essayez d'ajuster vos critères ou filtres de recherche.
              </Text>
            </View>
          ) : undefined
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMoreWrap}>
              <ActivityIndicator size="small" color={theme.primaryContainer} />
            </View>
          ) : undefined
        }
      />

      {/* Unlock / Démasquage Modal */}
      <UnlockModal
        visible={unlockModalVisible}
        property={selectedProperty}
        onClose={() => setUnlockModalVisible(false)}
        onConfirm={handleConfirmUnlock}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  headerContainer: {
    gap: 12,
    marginBottom: Spacing.three,
  },
  antiFraudBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  antiFraudIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  antiFraudTextWrap: {
    flex: 1,
  },
  antiFraudTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  antiFraudDesc: {
    fontSize: 11,
    marginTop: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 2,
  },
  filterTuneBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipsScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resultsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  resultsCountText: {
    fontSize: 12,
    fontWeight: '500',
  },
  andfVerifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  andfVerifiedText: {
    fontSize: 11,
    fontWeight: '700',
  },
  errorBox: {
    padding: 10,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingMoreWrap: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
});
