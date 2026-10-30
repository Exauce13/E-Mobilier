import { SymbolView } from 'expo-symbols';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PropertyCard } from '@/components/property-card';
import { UnlockModal } from '@/components/unlock-modal';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  BENIN_COMMUNES,
  BENIN_QUARTIERS,
  FILTER_CATEGORIES,
  MOCK_PROPERTIES,
} from '@/data/mock-properties';
import { useTheme } from '@/hooks/use-theme';
import { PropertyItem, PropertyType, TransactionType } from '@/types/property';

export default function ExploreScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommune, setSelectedCommune] = useState<string>('Toutes les communes');
  const [selectedQuartier, setSelectedQuartier] = useState<string>('Tous les quartiers');
  const [selectedTransaction, setSelectedTransaction] = useState<'tous' | TransactionType>('tous');
  const [selectedType, setSelectedType] = useState<PropertyType>('tous');
  const [tfOnly, setTfOnly] = useState(false);

  // Modal & data state
  const [properties, setProperties] = useState<PropertyItem[]>(MOCK_PROPERTIES);
  const [selectedPropertyForUnlock, setSelectedPropertyForUnlock] = useState<PropertyItem | null>(null);

  // Available quartiers for currently selected commune
  const availableQuartiers = useMemo(() => {
    if (selectedCommune === 'Toutes les communes' || !BENIN_QUARTIERS[selectedCommune]) {
      return [];
    }
    return BENIN_QUARTIERS[selectedCommune];
  }, [selectedCommune]);

  // Handle commune change
  const handleSelectCommune = (commune: string) => {
    setSelectedCommune(commune);
    setSelectedQuartier('Tous les quartiers');
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCommune('Toutes les communes');
    setSelectedQuartier('Tous les quartiers');
    setSelectedTransaction('tous');
    setSelectedType('tous');
    setTfOnly(false);
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedCommune !== 'Toutes les communes' ||
    selectedQuartier !== 'Tous les quartiers' ||
    selectedTransaction !== 'tous' ||
    selectedType !== 'tous' ||
    tfOnly;

  // Filtered properties
  const filteredProperties = useMemo(() => {
    return properties.filter((prop) => {
      // Commune filter
      if (
        selectedCommune !== 'Toutes les communes' &&
        prop.location.commune.toLowerCase() !== selectedCommune.toLowerCase()
      ) {
        return false;
      }

      // Quartier filter
      if (
        selectedQuartier !== 'Tous les quartiers' &&
        prop.location.quartier.toLowerCase() !== selectedQuartier.toLowerCase()
      ) {
        return false;
      }

      // Transaction type filter
      if (selectedTransaction !== 'tous' && prop.transactionType !== selectedTransaction) {
        return false;
      }

      // Property type filter
      if (selectedType !== 'tous' && prop.type !== selectedType) {
        return false;
      }

      // Titre Foncier filter
      if (tfOnly && !prop.features.titreFoncier) {
        return false;
      }

      // Free text search query
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        const matchTitle = prop.title.toLowerCase().includes(query);
        const matchCommune = prop.location.commune.toLowerCase().includes(query);
        const matchQuartier = prop.location.quartier.toLowerCase().includes(query);
        const matchAddress = prop.location.fullAddress?.toLowerCase().includes(query) ?? false;
        const matchTags = prop.tags.some((t) => t.toLowerCase().includes(query));
        if (!matchTitle && !matchCommune && !matchQuartier && !matchAddress && !matchTags) {
          return false;
        }
      }

      return true;
    });
  }, [
    properties,
    searchQuery,
    selectedCommune,
    selectedQuartier,
    selectedTransaction,
    selectedType,
    tfOnly,
  ]);

  const handleToggleFavorite = (id: string) => {
    setProperties((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isFavorite: !p.isFavorite } : p))
    );
  };

  const handleConfirmUnlock = (propertyId: string) => {
    setProperties((prev) =>
      prev.map((p) => (p.id === propertyId ? { ...p, isUnlocked: true } : p))
    );
    setSelectedPropertyForUnlock(null);
  };

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER SECTION */}
      <View style={[styles.header, { borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerTitleRow}>
          <View>
            <View style={styles.titleBadgeRow}>
              <Text style={[styles.title, { color: theme.text }]}>Recherche Bénin</Text>
              <View style={styles.flagPill}>
                <Text style={styles.flagPillText}>🇧🇯 229</Text>
              </View>
            </View>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Trouvez votre bien par commune, quartier et garantie foncière
            </Text>
          </View>
          {hasActiveFilters && (
            <Pressable
              onPress={handleResetFilters}
              style={[styles.resetButton, { backgroundColor: theme.backgroundElement }]}
              hitSlop={8}>
              <Text style={[styles.resetButtonText, { color: theme.gold }]}>Réinitialiser</Text>
            </Pressable>
          )}
        </View>

        {/* SEARCH BAR */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.cardBorder,
            },
          ]}>
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={18}
            tintColor={theme.textSecondary}
          />
          <TextInput
            placeholder="Rechercher par quartier, mot-clé, rue..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: theme.text }]}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <SymbolView
                name={{ ios: 'xmark.circle.fill', android: 'close', web: 'close' }}
                size={18}
                tintColor={theme.textSecondary}
              />
            </Pressable>
          )}
        </View>
      </View>

      {/* FILTER BAR SCROLLABLE */}
      <View style={styles.filtersWrapper}>
        {/* 1. COMMUNES BÉNINOISES HORIZONTAL CHIPS */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.filterGroupTitle, { color: theme.text }]}>📍 Communes</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}>
          {BENIN_COMMUNES.map((commune) => {
            const isSelected = selectedCommune === commune;
            return (
              <Pressable
                key={commune}
                onPress={() => handleSelectCommune(commune)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected ? theme.primary : theme.cardBackground,
                    borderColor: isSelected ? theme.primary : theme.cardBorder,
                  },
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? '#FFFFFF' : theme.text,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}>
                  {commune}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* 2. QUARTIERS (si commune spécifique choisie) */}
        {availableQuartiers.length > 0 && (
          <View style={styles.quartiersBlock}>
            <Text style={[styles.quartierSubTitle, { color: theme.textSecondary }]}>
              Quartiers de {selectedCommune} :
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScroll}>
              {availableQuartiers.map((quartier) => {
                const isSelected = selectedQuartier === quartier;
                return (
                  <Pressable
                    key={quartier}
                    onPress={() => setSelectedQuartier(quartier)}
                    style={[
                      styles.quartierChip,
                      {
                        backgroundColor: isSelected ? theme.navyLight : theme.backgroundElement,
                        borderColor: isSelected ? theme.gold : 'transparent',
                      },
                    ]}>
                    <Text
                      style={[
                        styles.quartierChipText,
                        {
                          color: isSelected ? '#FFFFFF' : theme.textSecondary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}>
                      {quartier}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 3. TRANSACTION + TYPE + TF ROW */}
        <View style={styles.subFiltersRow}>
          {/* Vente / Location Tabs */}
          <View style={[styles.segmentedControl, { backgroundColor: theme.backgroundElement }]}>
            {(['tous', 'vente', 'location'] as const).map((trans) => {
              const isSelected = selectedTransaction === trans;
              const label =
                trans === 'tous' ? 'Tous' : trans === 'vente' ? 'Vente' : 'Location';
              return (
                <Pressable
                  key={trans}
                  onPress={() => setSelectedTransaction(trans)}
                  style={[
                    styles.segmentButton,
                    isSelected && [
                      styles.segmentButtonActive,
                      { backgroundColor: theme.cardBackground },
                    ],
                  ]}>
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: isSelected ? theme.text : theme.textSecondary,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Titre Foncier Toggle */}
          <Pressable
            onPress={() => setTfOnly(!tfOnly)}
            style={[
              styles.tfBadgeButton,
              {
                backgroundColor: tfOnly ? theme.badgeGoldBg : theme.backgroundElement,
                borderColor: tfOnly ? theme.gold : 'transparent',
              },
            ]}>
            <SymbolView
              name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }}
              size={14}
              tintColor={tfOnly ? theme.gold : theme.textSecondary}
            />
            <Text
              style={[
                styles.tfBadgeText,
                { color: tfOnly ? theme.badgeGoldText : theme.textSecondary },
              ]}>
              Titre Foncier (TF)
            </Text>
          </Pressable>
        </View>
      </View>

      {/* RESULTS COUNT */}
      <View style={styles.resultsBar}>
        <Text style={[styles.resultsCountText, { color: theme.textSecondary }]}>
          <Text style={{ fontWeight: '800', color: theme.text }}>
            {filteredProperties.length}
          </Text>{' '}
          {filteredProperties.length > 1 ? 'biens trouvés' : 'bien trouvé'}
          {selectedCommune !== 'Toutes les communes' && ` à ${selectedCommune}`}
          {selectedQuartier !== 'Tous les quartiers' && ` (${selectedQuartier})`}
        </Text>
      </View>

      {/* PROPERTY LIST */}
      <FlatList
        data={filteredProperties}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PropertyCard
            property={item}
            onPressDetails={(p) => setSelectedPropertyForUnlock(p)}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom: BottomTabInset + Spacing.five + insets.bottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconBox, { backgroundColor: theme.backgroundElement }]}>
              <SymbolView
                name={{ ios: 'mappin.slash', android: 'location_off', web: 'location_off' }}
                size={36}
                tintColor={theme.textSecondary}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              Aucun bien ne correspond à ces critères
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Essayez d'élargir votre sélection de commune ou de retirer le filtre Titre Foncier.
            </Text>
            {hasActiveFilters && (
              <Pressable
                onPress={handleResetFilters}
                style={[styles.emptyResetBtn, { backgroundColor: theme.primary }]}>
                <Text style={styles.emptyResetText}>Voir tous les biens au Bénin</Text>
              </Pressable>
            )}
          </View>
        }
      />

      {/* UNLOCK / VISIT MODAL */}
      <UnlockModal
        visible={!!selectedPropertyForUnlock}
        property={selectedPropertyForUnlock}
        onClose={() => setSelectedPropertyForUnlock(null)}
        onConfirmUnlock={handleConfirmUnlock}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  flagPill: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  flagPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  resetButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    gap: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },

  /* FILTERS */
  filtersWrapper: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  sectionHeaderRow: {
    paddingHorizontal: Spacing.four,
    marginBottom: 6,
  },
  filterGroupTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  chipsScroll: {
    paddingHorizontal: Spacing.four,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
  },

  /* QUARTIERS BLOCK */
  quartiersBlock: {
    marginTop: 10,
    paddingTop: 8,
  },
  quartierSubTitle: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: Spacing.four,
    marginBottom: 6,
  },
  quartierChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  quartierChipText: {
    fontSize: 12,
  },

  /* SUB FILTERS ROW */
  subFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    marginTop: 12,
    gap: 10,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    flex: 1,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
  },
  tfBadgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  tfBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* RESULTS BAR */
  resultsBar: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  resultsCountText: {
    fontSize: 13,
  },

  /* LIST CONTENT */
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.four,
  },

  /* EMPTY STATE */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: Spacing.five,
  },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.four,
  },
  emptyResetBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyResetText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
