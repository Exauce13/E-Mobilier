import { router, useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronUp, Search, XCircle } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PropertyCard } from '@/components/property-card';
import {
  BENIN_COMMUNES,
  FILTER_CATEGORIES,
  QUARTIERS_BY_COMMUNE,
} from '@/constants/locations';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
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

type SortOption = 'recent' | 'prix_asc' | 'prix_desc' | 'surface_desc';

const SORT_OPTIONS: Array<{ key: SortOption; label: string }> = [
  { key: 'recent', label: 'Plus récents' },
  { key: 'prix_asc', label: 'Prix croissant' },
  { key: 'prix_desc', label: 'Prix décroissant' },
  { key: 'surface_desc', label: 'Surface max' },
];

export default function ExploreScreen() {
  const params = useLocalSearchParams<{
    q?: string;
    tx?: string;
    commune?: string;
    type?: string;
  }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isMobile, twoColLayout, gridColumns, contentMaxWidth, horizontalPadding } = useResponsive();
  const { isAuthenticated, isAgentMobilier, openAuthModal } = useAuth();
  const storageBaseUrl = useMemo(() => getStorageBaseUrl(), []);

  const [searchQuery, setSearchQuery] = useState(params.q || '');
  const [selectedCommune, setSelectedCommune] = useState(params.commune || 'Toutes les communes');
  const [selectedQuartier, setSelectedQuartier] = useState('Tous');
  const [arrondissement, setArrondissement] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<'tous' | 'vente' | 'location'>(
    params.tx === 'vente' || params.tx === 'location' ? params.tx : 'tous'
  );
  const [selectedCategory, setSelectedCategory] = useState<PropertyCategory>(
    params.type === 'maison' || params.type === 'parcelle' || params.type === 'chambre'
      ? params.type
      : 'tous'
  );
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minSurface, setMinSurface] = useState('');
  const [minRooms, setMinRooms] = useState('');
  const [accessFilter, setAccessFilter] = useState('');
  const [utilitiesFilter, setUtilitiesFilter] = useState('');
  const [negotiableOnly, setNegotiableOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [showMoreFilters, setShowMoreFilters] = useState(!isMobile);

  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const availableQuartiers = useMemo(() => {
    if (selectedCommune === 'Toutes les communes') return [];
    return QUARTIERS_BY_COMMUNE[selectedCommune] || [];
  }, [selectedCommune]);

  const handleSelectCommune = (commune: string) => {
    setSelectedCommune(commune);
    setSelectedQuartier('Tous');
  };

  const loadSearchResults = useCallback(
    async (targetPage = 1, replace = true) => {
      setErrorMsg(null);
      const favs = await favoritesStorage.getAll();
      setFavoriteIds(favs);

      const parsedMin = Number(minPrice.replace(/\s+/g, ''));
      const parsedMax = Number(maxPrice.replace(/\s+/g, ''));
      const parsedSurf = Number(minSurface.replace(/\s+/g, ''));
      const parsedRooms = Number(minRooms);

      const res = await proprietesApi.getFeed({
        type: selectedCategory === 'tous' ? undefined : selectedCategory,
        transaction_type: selectedTransaction === 'tous' ? undefined : selectedTransaction,
        commune: selectedCommune === 'Toutes les communes' ? undefined : selectedCommune,
        arrondissement: arrondissement.trim() || undefined,
        quartier: selectedQuartier === 'Tous' ? undefined : selectedQuartier,
        prix_min: parsedMin > 0 ? parsedMin : undefined,
        prix_max: parsedMax > 0 ? parsedMax : undefined,
        surface_min: parsedSurf > 0 ? parsedSurf : undefined,
        nombres_chambres: parsedRooms > 0 ? parsedRooms : undefined,
        is_negotiable: negotiableOnly ? true : undefined,
        accessibilite: accessFilter.trim() || undefined,
        eau_courant: utilitiesFilter.trim() || undefined,
        sort: sortBy,
        search: searchQuery.trim() || undefined,
        page: targetPage,
        per_page: 24,
      });

      if (res.success && res.data) {
        const mapped = (res.data.data || []).map((p: BackendProperty) =>
          mapBackendPropertyToItem(p, storageBaseUrl, favs)
        );
        setPage(res.data.current_page || targetPage);
        setLastPage(res.data.last_page || 1);
        setProperties((prev) => (replace ? mapped : [...prev, ...mapped]));
      } else {
        if (replace) setProperties([]);
        setErrorMsg(res.message || 'Impossible de contacter le serveur pour la recherche.');
      }
    },
    [
      selectedCategory,
      selectedTransaction,
      selectedCommune,
      arrondissement,
      selectedQuartier,
      minPrice,
      maxPrice,
      minSurface,
      minRooms,
      negotiableOnly,
      accessFilter,
      utilitiesFilter,
      sortBy,
      searchQuery,
      storageBaseUrl,
    ]
  );

  const handleLoadMore = async () => {
    if (loadingMore || page >= lastPage) return;
    setLoadingMore(true);
    await loadSearchResults(page + 1, false);
    setLoadingMore(false);
  };

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      await loadSearchResults();
      if (active) setLoading(false);
    }, 280);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loadSearchResults]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSearchResults();
    setRefreshing(false);
  };

  const handleToggleFavorite = async (id: string) => {
    const next = await favoritesStorage.toggle(id);
    setFavoriteIds(next);
    setProperties((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isFavorite: next.has(id) } : item))
    );
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCommune('Toutes les communes');
    setSelectedQuartier('Tous');
    setArrondissement('');
    setSelectedTransaction('tous');
    setSelectedCategory('tous');
    setMinPrice('');
    setMaxPrice('');
    setMinSurface('');
    setMinRooms('');
    setAccessFilter('');
    setUtilitiesFilter('');
    setNegotiableOnly(false);
    setSortBy('recent');
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (selectedCommune !== 'Toutes les communes') count++;
    if (selectedQuartier !== 'Tous') count++;
    if (arrondissement.trim()) count++;
    if (selectedTransaction !== 'tous') count++;
    if (selectedCategory !== 'tous') count++;
    if (minPrice.trim()) count++;
    if (maxPrice.trim()) count++;
    if (minSurface.trim()) count++;
    if (minRooms.trim()) count++;
    if (accessFilter.trim()) count++;
    if (utilitiesFilter.trim()) count++;
    if (negotiableOnly) count++;
    return count;
  }, [
    searchQuery,
    selectedCommune,
    selectedQuartier,
    arrondissement,
    selectedTransaction,
    selectedCategory,
    minPrice,
    maxPrice,
    minSurface,
    minRooms,
    accessFilter,
    utilitiesFilter,
    negotiableOnly,
  ]);

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
          {/* Header */}
          <View style={styles.topRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.pageTitle, { color: theme.text }]}>Recherche de Maison & Biens</Text>
              <Text style={[styles.pageSub, { color: theme.textSecondary }]}>
                Filtres complets par localisation, budget, surface, chambres et commodités
              </Text>
            </View>
            <Pressable
              onPress={() => {
                if (!isAuthenticated) openAuthModal('login');
                else router.push('/search-requests' as any);
              }}
              style={[styles.requestShortcut, { backgroundColor: theme.navy }]}>
              <Text style={styles.requestShortcutText}>Mes Demandes</Text>
            </Pressable>
          </View>

          {/* Complete Search Form Card */}
          <View
            style={[
              styles.searchCard,
              { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
            ]}>
            {/* Keyword search */}
            <View
              style={[
                styles.searchBar,
                { backgroundColor: theme.backgroundElement, borderColor: theme.cardBorder },
              ]}>
              <Search size={18} color={theme.textSecondary} strokeWidth={2} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Mot-clé, quartier, villa, piscine, titre foncier..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <XCircle size={18} color={theme.textSecondary} strokeWidth={2} />
                </Pressable>
              )}
            </View>

            {/* Type & Transaction row */}
            <View style={[styles.filtersPair, !twoColLayout && { flexDirection: 'column' }]}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[styles.filterLabel, { color: theme.text }]}>Type de bien</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                  {FILTER_CATEGORIES.map((cat) => {
                    const active = selectedCategory === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => setSelectedCategory(cat.id)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: active ? theme.primary : theme.backgroundElement,
                            borderColor: active ? theme.primary : theme.cardBorder,
                          },
                        ]}>
                        <Text
                          style={{
                            color: active ? '#FFFFFF' : theme.text,
                            fontSize: 12,
                            fontWeight: '700',
                          }}>
                          {cat.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[styles.filterLabel, { color: theme.text }]}>Opération</Text>
                <View style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}>
                  {(['tous', 'location', 'vente'] as const).map((tr) => {
                    const active = selectedTransaction === tr;
                    const label = tr === 'tous' ? 'Tous' : tr === 'location' ? 'Location' : 'Vente';
                    return (
                      <Pressable
                        key={tr}
                        onPress={() => setSelectedTransaction(tr)}
                        style={[styles.segBtn, active && { backgroundColor: theme.cardBackground }]}>
                        <Text
                          style={{
                            color: active ? theme.primary : theme.textSecondary,
                            fontWeight: '800',
                            fontSize: 12,
                          }}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Communes & Quartiers */}
            <View style={{ gap: 6 }}>
              <Text style={[styles.filterLabel, { color: theme.text }]}>Commune du Bénin</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                {BENIN_COMMUNES.map((c) => {
                  const active = selectedCommune === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => handleSelectCommune(c)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? theme.navy : theme.backgroundElement,
                          borderColor: active ? theme.navy : theme.cardBorder,
                        },
                      ]}>
                      <Text
                        style={{
                          color: active ? '#FFFFFF' : theme.text,
                          fontWeight: active ? '800' : '600',
                          fontSize: 12,
                        }}>
                        {c}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {availableQuartiers.length > 0 && (
              <View style={{ gap: 6 }}>
                <Text style={[styles.filterLabel, { color: theme.text }]}>
                  Quartiers de {selectedCommune}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                  {availableQuartiers.map((q) => {
                    const active = selectedQuartier === q;
                    return (
                      <Pressable
                        key={q}
                        onPress={() => setSelectedQuartier(q)}
                        style={[
                          styles.quartierChip,
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
                          {q}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Toggle Advanced Criteria */}
            <Pressable
              onPress={() => setShowMoreFilters((v) => !v)}
              style={[styles.advancedToggle, { borderColor: theme.cardBorder }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                {showMoreFilters ? (
                  <ChevronUp size={16} color={theme.primary} strokeWidth={2.4} />
                ) : (
                  <ChevronDown size={16} color={theme.primary} strokeWidth={2.4} />
                )}
                <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '800', flex: 1 }}>
                  {showMoreFilters
                    ? 'Masquer les critères avancés'
                    : 'Critères avancés (Budget, Surface, Chambres, Commodités)'}
                </Text>
              </View>
              {activeFiltersCount > 0 && (
                <View style={[styles.countPill, { backgroundColor: theme.primary }]}>
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>
                    {activeFiltersCount} actif{activeFiltersCount > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </Pressable>

            {showMoreFilters && (
              <View style={{ gap: 12 }}>
                {/* Budget Min / Max & Surface & Chambres */}
                <View style={[styles.numericGrid, !twoColLayout && { flexDirection: 'column' }]}>
                  <View style={styles.numericRow}>
                    <TextInput
                      style={[
                        styles.numInput,
                        { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.cardBorder },
                      ]}
                      placeholder="Budget min (FCFA)"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                      value={minPrice}
                      onChangeText={setMinPrice}
                    />
                    <TextInput
                      style={[
                        styles.numInput,
                        { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.cardBorder },
                      ]}
                      placeholder="Budget max (FCFA)"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                      value={maxPrice}
                      onChangeText={setMaxPrice}
                    />
                  </View>

                  <View style={styles.numericRow}>
                    <TextInput
                      style={[
                        styles.numInput,
                        { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.cardBorder },
                      ]}
                      placeholder="Surface min (m²)"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                      value={minSurface}
                      onChangeText={setMinSurface}
                    />
                    <TextInput
                      style={[
                        styles.numInput,
                        { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.cardBorder },
                      ]}
                      placeholder="Min. chambres"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                      value={minRooms}
                      onChangeText={setMinRooms}
                    />
                  </View>
                </View>

                {/* Quick Rooms Pills */}
                <View style={styles.quickRoomsRow}>
                  <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>
                    Chambres :
                  </Text>
                  {['', '1', '2', '3', '4', '5'].map((n) => {
                    const active = minRooms === n;
                    return (
                      <Pressable
                        key={n || 'all'}
                        onPress={() => setMinRooms(n)}
                        style={[
                          styles.roomPill,
                          {
                            backgroundColor: active ? theme.primary : theme.backgroundElement,
                          },
                        ]}>
                        <Text
                          style={{
                            color: active ? '#FFFFFF' : theme.text,
                            fontSize: 12,
                            fontWeight: '700',
                          }}>
                          {n ? `${n}+` : 'Toutes'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Arrondissement, Accessibilité, Eau/Électricité */}
                <View style={[styles.numericGrid, !twoColLayout && { flexDirection: 'column' }]}>
                  <TextInput
                    style={[
                      styles.numInput,
                      { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.cardBorder },
                    ]}
                    placeholder="Arrondissement (ex: 12ème)"
                    placeholderTextColor={theme.textSecondary}
                    value={arrondissement}
                    onChangeText={setArrondissement}
                  />
                  <TextInput
                    style={[
                      styles.numInput,
                      { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.cardBorder },
                    ]}
                    placeholder="Accessibilité (ex: Pavé, Goudron)"
                    placeholderTextColor={theme.textSecondary}
                    value={accessFilter}
                    onChangeText={setAccessFilter}
                  />
                  <TextInput
                    style={[
                      styles.numInput,
                      { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.cardBorder },
                    ]}
                    placeholder="Eau / Élec (ex: SONEB, SBEE)"
                    placeholderTextColor={theme.textSecondary}
                    value={utilitiesFilter}
                    onChangeText={setUtilitiesFilter}
                  />
                </View>

                {/* Negotiable Switch & Sort */}
                <View style={styles.bottomFilterRow}>
                  <View style={styles.switchWrap}>
                    <Switch
                      value={negotiableOnly}
                      onValueChange={setNegotiableOnly}
                      trackColor={{ false: '#CBD5E1', true: theme.primary }}
                      thumbColor="#FFFFFF"
                    />
                    <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>
                      Négociable uniquement
                    </Text>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {SORT_OPTIONS.map((opt) => {
                      const active = sortBy === opt.key;
                      return (
                        <Pressable
                          key={opt.key}
                          onPress={() => setSortBy(opt.key)}
                          style={[
                            styles.sortChip,
                            {
                              backgroundColor: active ? theme.navy : theme.backgroundElement,
                            },
                          ]}>
                          <Text
                            style={{
                              color: active ? '#FFFFFF' : theme.text,
                              fontSize: 11,
                              fontWeight: '700',
                            }}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            )}

            {/* Footer actions of Search Form */}
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryText, { color: theme.text }]}>
                {properties.length} bien{properties.length > 1 ? 's' : ''} trouvé{properties.length > 1 ? 's' : ''}
              </Text>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                {activeFiltersCount > 0 && (
                  <Pressable onPress={resetFilters}>
                    <Text style={[styles.resetText, { color: '#DC2626' }]}>Réinitialiser</Text>
                  </Pressable>
                )}
                {!isAgentMobilier && (
                  <Pressable
                    onPress={() => {
                      if (!isAuthenticated) openAuthModal('login');
                      else router.push('/search-requests' as any);
                    }}
                    style={[styles.saveSearchBtn, { backgroundColor: theme.primaryLight }]}>
                    <Text style={{ color: theme.primaryDark, fontSize: 12, fontWeight: '800' }}>
                      + Enregistrer mon alerte
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>

          {/* Results Grid */}
          {loading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 32 }} />
          ) : errorMsg ? (
            <View
              style={[
                styles.emptyBox,
                { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
              ]}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                Erreur lors de la recherche
              </Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>{errorMsg}</Text>
              <Pressable
                onPress={() => void loadSearchResults(1, true)}
                style={[styles.ctaBtn, { backgroundColor: theme.primary }]}>
                <Text style={styles.ctaBtnText}>Réessayer</Text>
              </Pressable>
            </View>
          ) : properties.length === 0 ? (
            <View
              style={[
                styles.emptyBox,
                { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
              ]}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                Aucun bien ne correspond exactement à ces filtres
              </Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                Élargissez vos critères ou publiez une demande de recherche personnalisée pour que nos
                équipes trouvent votre maison idéale.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                <Pressable
                  onPress={resetFilters}
                  style={[styles.ctaBtn, { backgroundColor: theme.navy }]}>
                  <Text style={styles.ctaBtnText}>Réinitialiser les filtres</Text>
                </Pressable>
                {!isAgentMobilier && (
                  <Pressable
                    onPress={() => {
                      if (!isAuthenticated) openAuthModal('login');
                      else router.push('/search-requests' as any);
                    }}
                    style={[styles.ctaBtn, { backgroundColor: theme.primary }]}>
                    <Text style={styles.ctaBtnText}>Créer une demande de recherche</Text>
                  </Pressable>
                )}
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
                  style={[styles.ctaBtn, { backgroundColor: theme.primary, alignSelf: 'center', marginTop: 8 }]}>
                  <Text style={styles.ctaBtnText}>
                    {loadingMore ? 'Chargement...' : "Charger plus d'annonces"}
                  </Text>
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
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pageTitle: { fontSize: 22, fontWeight: '900' },
  pageSub: { fontSize: 13, marginTop: 2 },
  requestShortcut: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12 },
  requestShortcutText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  searchCard: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 46,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    ...Platform.select({ web: { outlineStyle: 'none' } as any }),
  },
  filtersPair: { flexDirection: 'row', gap: 12 },
  filterLabel: { fontSize: 12, fontWeight: '800' },
  chipsScroll: { gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  quartierChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  advancedToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  countPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  numericGrid: { flexDirection: 'row', gap: 10 },
  numericRow: { flex: 1, flexDirection: 'row', gap: 10 },
  numInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  quickRoomsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  roomPill: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 10 },
  bottomFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  switchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sortChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10 },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  summaryText: { fontSize: 14, fontWeight: '800' },
  resetText: { fontSize: 13, fontWeight: '700' },
  saveSearchBtn: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10 },
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  emptyBox: {
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center', maxWidth: 460 },
  ctaBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  ctaBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
});
