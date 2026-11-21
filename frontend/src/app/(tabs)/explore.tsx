import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PropertyCard } from '@/components/property-card';
import { UnlockModal } from '@/components/unlock-modal';
import {
  BENIN_COMMUNES,
  FILTER_CATEGORIES,
  QUARTIERS_BY_COMMUNE,
} from '@/constants/locations';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { getStorageBaseUrl, proprietesApi } from '@/services/api';
import type { BackendProperty } from '@/types/api';
import {
  mapBackendPropertyToItem,
  PropertyCategory,
  PropertyItem,
} from '@/types/property';

export default function ExploreScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, openAuthModal } = useAuth();
  const storageBaseUrl = useMemo(() => getStorageBaseUrl(), []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommune, setSelectedCommune] = useState('Toutes les communes');
  const [selectedQuartier, setSelectedQuartier] = useState('Tous');
  const [selectedTransaction, setSelectedTransaction] = useState<'tous' | 'vente' | 'location'>('tous');
  const [selectedCategory, setSelectedCategory] = useState<PropertyCategory>('tous');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRooms, setMinRooms] = useState('');

  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [unlockModalVisible, setUnlockModalVisible] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PropertyItem | null>(null);

  const availableQuartiers = useMemo(() => {
    if (selectedCommune === 'Toutes les communes') return [];
    return QUARTIERS_BY_COMMUNE[selectedCommune] || [];
  }, [selectedCommune]);

  const handleSelectCommune = (commune: string) => {
    setSelectedCommune(commune);
    setSelectedQuartier('Tous');
  };

  const loadSearchResults = useCallback(async () => {
    const parsedMax = Number(maxPrice.replace(/\s+/g, ''));
    const parsedRooms = Number(minRooms);

    const res = await proprietesApi.getFeed({
      type: selectedCategory === 'tous' ? undefined : selectedCategory,
      transaction_type: selectedTransaction === 'tous' ? undefined : selectedTransaction,
      commune: selectedCommune === 'Toutes les communes' ? undefined : selectedCommune,
      quartier: selectedQuartier === 'Tous' ? undefined : selectedQuartier,
      prix_max: parsedMax > 0 ? parsedMax : undefined,
      nombres_chambres: parsedRooms > 0 ? parsedRooms : undefined,
      search: searchQuery.trim() || undefined,
      per_page: 25,
    });

    if (res.success && res.data) {
      setProperties(
        (res.data.data || []).map((p: BackendProperty) =>
          mapBackendPropertyToItem(p, storageBaseUrl)
        )
      );
    }
  }, [
    selectedCategory,
    selectedTransaction,
    selectedCommune,
    selectedQuartier,
    maxPrice,
    minRooms,
    searchQuery,
    storageBaseUrl,
  ]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      await loadSearchResults();
      if (active) setLoading(false);
    }, 300);
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

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCommune('Toutes les communes');
    setSelectedQuartier('Tous');
    setSelectedTransaction('tous');
    setSelectedCategory('tous');
    setMaxPrice('');
    setMinRooms('');
  };

  const handleOpenProperty = (property: PropertyItem) => {
    router.push(`/property/${property.id}` as any);
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: BottomTabInset + Spacing.six + insets.bottom },
        ]}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.topRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pageTitle, { color: theme.text }]}>Recherche Avancée</Text>
                <Text style={[styles.pageSub, { color: theme.textSecondary }]}>
                  Filtres géographiques et budget en temps réel
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  if (!isAuthenticated) {
                    openAuthModal('login');
                  } else {
                    router.push('/search-requests' as any);
                  }
                }}
                style={[styles.requestShortcut, { backgroundColor: theme.navy }]}>
                <Text style={styles.requestShortcutText}>Mes Demandes</Text>
              </Pressable>
            </View>

            {/* Search Input */}
            <View
              style={[
                styles.searchBar,
                { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
              ]}>
              <SymbolView
                name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
                size={18}
                tintColor={theme.textSecondary}
              />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Mot-clé, quartier, repère..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <SymbolView
                    name={{ ios: 'xmark.circle.fill', android: 'close', web: 'close' }}
                    size={18}
                    tintColor={theme.textSecondary}
                  />
                </Pressable>
              )}
            </View>

            {/* Communes */}
            <Text style={[styles.filterTitle, { color: theme.text }]}>Communes du Bénin</Text>
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
                        backgroundColor: active ? theme.primary : theme.cardBackground,
                        borderColor: active ? theme.primary : theme.cardBorder,
                      },
                    ]}>
                    <Text style={{ color: active ? '#FFFFFF' : theme.text, fontWeight: active ? '700' : '500', fontSize: 13 }}>
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Quartiers */}
            {availableQuartiers.length > 0 && (
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
                          backgroundColor: active ? theme.navyLight : theme.backgroundElement,
                          borderColor: active ? theme.gold : 'transparent',
                        },
                      ]}>
                      <Text style={{ color: active ? '#FFFFFF' : theme.textSecondary, fontSize: 12, fontWeight: '600' }}>
                        {q}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {/* Category & Transaction */}
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
                        backgroundColor: active ? theme.navy : theme.cardBackground,
                        borderColor: active ? theme.navy : theme.cardBorder,
                      },
                    ]}>
                    <Text style={{ color: active ? '#FFFFFF' : theme.text, fontSize: 13, fontWeight: '600' }}>
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}>
              {(['tous', 'vente', 'location'] as const).map((tr) => {
                const active = selectedTransaction === tr;
                const label = tr === 'tous' ? 'Tous' : tr === 'vente' ? 'Vente' : 'Location';
                return (
                  <Pressable
                    key={tr}
                    onPress={() => setSelectedTransaction(tr)}
                    style={[styles.segBtn, active && { backgroundColor: theme.cardBackground }]}>
                    <Text style={{ color: active ? theme.primary : theme.textSecondary, fontWeight: '700', fontSize: 13 }}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Budget & Rooms */}
            <View style={styles.numericRow}>
              <TextInput
                style={[styles.numInput, { color: theme.text, backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
                placeholder="Budget max (FCFA)"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                value={maxPrice}
                onChangeText={setMaxPrice}
              />
              <TextInput
                style={[styles.numInput, { color: theme.text, backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
                placeholder="Min. chambres"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                value={minRooms}
                onChangeText={setMinRooms}
              />
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
                {properties.length} résultat{properties.length > 1 ? 's' : ''}
              </Text>
              <Pressable onPress={resetFilters}>
                <Text style={[styles.resetText, { color: theme.primary }]}>Réinitialiser</Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <PropertyCard
            property={item}
            onPressCard={handleOpenProperty}
            onPressDetails={(prop) => {
              if (prop.isUnlocked) handleOpenProperty(prop);
              else {
                setSelectedProperty(prop);
                setUnlockModalVisible(true);
              }
            }}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 32 }} />
          ) : (
            <View style={styles.emptyBox}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Aucun bien ne correspond</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                Déposez une demande de recherche personnalisée pour être notifié dès qu'un bien correspond.
              </Text>
              <Pressable
                onPress={() => {
                  if (!isAuthenticated) openAuthModal('login');
                  else router.push('/search-requests' as any);
                }}
                style={[styles.ctaBtn, { backgroundColor: theme.primary }]}>
                <Text style={styles.ctaBtnText}>Créer une demande de recherche</Text>
              </Pressable>
            </View>
          )
        }
      />

      <UnlockModal
        visible={unlockModalVisible}
        property={selectedProperty}
        onClose={() => setUnlockModalVisible(false)}
        onConfirmUnlock={(prop, updatedBackend) => {
          const refreshed = updatedBackend
            ? mapBackendPropertyToItem(updatedBackend, storageBaseUrl)
            : { ...prop, isUnlocked: true };
          setProperties((prev) => prev.map((p) => (p.id === refreshed.id ? refreshed : p)));
          setSelectedProperty(refreshed);
        }}
        onOpenFullDetails={handleOpenProperty}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  headerBlock: { gap: Spacing.two, marginBottom: Spacing.three },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pageTitle: { fontSize: 22, fontWeight: '900' },
  pageSub: { fontSize: 13 },
  requestShortcut: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  requestShortcutText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    height: 46,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
  filterTitle: { fontSize: 13, fontWeight: '800', marginTop: 4 },
  chipsScroll: { gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1 },
  quartierChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  numericRow: { flexDirection: 'row', gap: 10 },
  numInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 13,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  summaryText: { fontSize: 13, fontWeight: '700' },
  resetText: { fontSize: 13, fontWeight: '700' },
  emptyBox: { alignItems: 'center', paddingVertical: Spacing.five, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center', paddingHorizontal: Spacing.four },
  ctaBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, marginTop: 6 },
  ctaBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
