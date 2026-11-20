import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
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

import { PropertyCard } from '@/components/property-card';
import { InstitutionHeader } from '@/components/ui/institution-header';
import { UnlockModal } from '@/components/unlock-modal';
import {
  BENIN_COMMUNES,
  FILTER_CATEGORIES,
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
  const params = useLocalSearchParams<{ operation?: string; category?: string; city?: string }>();
  const { isAuthenticated, openAuthModal } = useAuth();
  const storageBaseUrl = useMemo(() => getStorageBaseUrl(), []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOperation, setSelectedOperation] = useState<'tous' | 'vente' | 'location'>(
    (params.operation as any) || 'tous'
  );
  const [selectedCategory, setSelectedCategory] = useState<PropertyCategory>('tous');
  const [selectedCity, setSelectedCity] = useState<string>(params.city || 'Toutes');

  // Advanced inspection criteria modal
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterTf, setFilterTf] = useState(true);
  const [filterConvention, setFilterConvention] = useState(false);
  const [filterSoneb, setFilterSoneb] = useState(true);
  const [filterSbee, setFilterSbee] = useState(true);
  const [filterBitume, setFilterBitume] = useState(false);
  const [filterNonInondable, setFilterNonInondable] = useState(true);
  const [maxPrice, setMaxPrice] = useState('');

  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // Unlock Modal
  const [unlockModalVisible, setUnlockModalVisible] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PropertyItem | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const loadSearchResults = useCallback(async () => {
    setLoading(true);
    try {
      const parsedMax = Number(maxPrice.replace(/\s+/g, ''));
      const res = await proprietesApi.getFeed({
        type: selectedCategory === 'tous' ? undefined : selectedCategory,
        transaction_type: selectedOperation === 'tous' ? undefined : selectedOperation,
        commune: selectedCity === 'Toutes' ? undefined : selectedCity,
        prix_max: parsedMax > 0 ? parsedMax : undefined,
        search: searchQuery.trim() || undefined,
        per_page: 30,
      });

      if (res.success && res.data) {
        const rows = res.data.data || [];
        setProperties(rows.map((p) => mapBackendPropertyToItem(p, storageBaseUrl, favoriteIds)));
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [
    selectedCategory,
    selectedOperation,
    selectedCity,
    maxPrice,
    searchQuery,
    storageBaseUrl,
    favoriteIds,
  ]);

  useEffect(() => {
    void loadSearchResults();
  }, [loadSearchResults]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSearchResults();
    setRefreshing(false);
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
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 4000);
  };

  const chipsList = [
    { id: 'all', label: 'Toutes (148)', active: selectedOperation === 'tous' && selectedCategory === 'tous' },
    { id: 'vente', label: 'Vente', active: selectedOperation === 'vente' },
    { id: 'location', label: 'Location', active: selectedOperation === 'location' },
    { id: 'parcelle', label: 'Parcelles', active: selectedCategory === 'parcelle' },
    { id: 'villa', label: 'Maisons / Villas', active: selectedCategory === 'maison' },
    { id: 'appartement', label: 'Appartements', active: false },
  ];

  const citiesList = ['Toutes', 'Cotonou', 'Calavi', 'Porto-Novo', 'Ouidah'];

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <InstitutionHeader />

      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primaryContainer} />
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: BottomTabInset + Spacing.six + insets.bottom },
        ]}
        ListHeaderComponent={
          <View style={styles.headerStack}>
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
                placeholder="Rechercher par référence, quartier, ville..."
                placeholderTextColor={theme.outline}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={() => void loadSearchResults()}
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
                onPress={() => setShowFilterModal(true)}
                style={[
                  styles.filterTuneBtn,
                  { backgroundColor: theme.primaryContainer },
                ]}>
                <SymbolView
                  name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }}
                  size={16}
                  tintColor="#FFFFFF"
                />
              </Pressable>
            </View>

            {/* Anti-Fraud Cadastre Bénin Alert Notice (Stitch exact) */}
            <View
              style={[
                styles.antiFraudNotice,
                { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder },
              ]}>
              <SymbolView
                name={{ ios: 'shield.lefthalf.filled', android: 'verified', web: 'verified' }}
                size={18}
                tintColor={theme.primaryContainer}
              />
              <View style={styles.antiFraudTextCol}>
                <Text style={[styles.antiFraudTitle, { color: theme.text }]}>
                  Garantie Anti-Fraude Cadastre Bénin
                </Text>
                <Text style={[styles.antiFraudDesc, { color: theme.textSecondary }]}>
                  Les coordonnées notariées et repères GPS certifiés sont masqués pour prévenir la spéculation illégale et les doubles ventes.
                </Text>
              </View>
            </View>

            {/* Horizontal Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalChipsRow}>
              {chipsList.map((chip) => (
                <Pressable
                  key={chip.id}
                  onPress={() => {
                    if (chip.id === 'all') {
                      setSelectedOperation('tous');
                      setSelectedCategory('tous');
                    } else if (chip.id === 'vente' || chip.id === 'location') {
                      setSelectedOperation(chip.id);
                    } else {
                      setSelectedCategory(chip.id as any);
                    }
                  }}
                  style={[
                    styles.chipBtn,
                    {
                      backgroundColor: chip.active ? theme.primaryContainer : theme.surfaceContainerLowest,
                      borderColor: chip.active ? theme.primaryContainer : theme.cardBorder,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.chipBtnText,
                      { color: chip.active ? '#FFFFFF' : theme.text },
                    ]}>
                    {chip.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* City Filter Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalChipsRow}>
              {citiesList.map((city) => {
                const isActive = selectedCity === city;
                return (
                  <Pressable
                    key={city}
                    onPress={() => setSelectedCity(city)}
                    style={[
                      styles.cityChipBtn,
                      {
                        backgroundColor: isActive ? theme.secondary : theme.surfaceContainerLowest,
                        borderColor: isActive ? theme.secondary : theme.cardBorder,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.cityChipText,
                        { color: isActive ? '#FFFFFF' : theme.textSecondary },
                      ]}>
                      {city}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Result Counter & ANDF Seal */}
            <View style={styles.counterRow}>
              <Text style={[styles.counterText, { color: theme.textSecondary }]}>
                {properties.length} biens certifiés disponibles
              </Text>
              <View style={styles.certSealRow}>
                <SymbolView
                  name={{ ios: 'seal.fill', android: 'workspace_premium', web: 'workspace_premium' }}
                  size={14}
                  tintColor={theme.tertiaryFixedDim || theme.gold}
                />
                <Text style={[styles.certSealText, { color: theme.tertiary }]}>
                  Certifié ANDF
                </Text>
              </View>
            </View>
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
                styles.emptyBox,
                { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
              ]}>
              <SymbolView
                name={{ ios: 'magnifyingglass', android: 'search_off', web: 'search_off' }}
                size={34}
                tintColor={theme.outline}
              />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Aucun bien correspondant</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Modifiez vos filtres ou réinitialisez la sélection pour afficher d'autres annonces.
              </Text>
            </View>
          ) : undefined
        }
      />

      {/* Critères d'inspection Filter Sheet (Stitch) */}
      <Modal visible={showFilterModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.filterSheet,
              { backgroundColor: theme.surfaceContainerLowest, paddingBottom: insets.bottom + 20 },
            ]}>
            <View style={styles.filterSheetHeader}>
              <View style={styles.filterSheetTitleRow}>
                <SymbolView
                  name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }}
                  size={18}
                  tintColor={theme.primaryContainer}
                />
                <Text style={[styles.filterSheetTitle, { color: theme.text }]}>
                  Critères d'inspection
                </Text>
              </View>
              <Pressable
                onPress={() => setShowFilterModal(false)}
                style={[styles.closeModalBtn, { backgroundColor: theme.surfaceContainerLow }]}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={14}
                  tintColor={theme.text}
                />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.filterModalScroll}>
              {/* Sécurité Juridique */}
              <View style={styles.filterSection}>
                <Text style={[styles.filterGroupTitle, { color: theme.text }]}>
                  Sécurité Juridique (ANDF / Notariat)
                </Text>
                <View style={styles.criteriaRow}>
                  <Pressable
                    onPress={() => setFilterTf(!filterTf)}
                    style={[
                      styles.criteriaChip,
                      {
                        backgroundColor: filterTf ? theme.badgeGreenBg : theme.surfaceContainerLow,
                        borderColor: filterTf ? theme.primaryContainer : theme.cardBorder,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.criteriaChipText,
                        { color: filterTf ? theme.badgeGreenText : theme.text },
                      ]}>
                      Titre Foncier (TF)
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setFilterConvention(!filterConvention)}
                    style={[
                      styles.criteriaChip,
                      {
                        backgroundColor: filterConvention ? theme.badgeGoldBg : theme.surfaceContainerLow,
                        borderColor: filterConvention ? theme.tertiaryFixedDim : theme.cardBorder,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.criteriaChipText,
                        { color: filterConvention ? theme.badgeGoldText : theme.text },
                      ]}>
                      Convention Notariée
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Réseaux & Viabilisation */}
              <View style={styles.filterSection}>
                <Text style={[styles.filterGroupTitle, { color: theme.text }]}>
                  Réseaux & Viabilisation
                </Text>
                <View style={styles.criteriaRow}>
                  <Pressable
                    onPress={() => setFilterSoneb(!filterSoneb)}
                    style={[
                      styles.criteriaChip,
                      {
                        backgroundColor: filterSoneb ? theme.badgeBlueBg : theme.surfaceContainerLow,
                        borderColor: filterSoneb ? theme.secondary : theme.cardBorder,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.criteriaChipText,
                        { color: filterSoneb ? theme.badgeBlueText : theme.text },
                      ]}>
                      Eau SONEB
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setFilterSbee(!filterSbee)}
                    style={[
                      styles.criteriaChip,
                      {
                        backgroundColor: filterSbee ? theme.badgeGoldBg : theme.surfaceContainerLow,
                        borderColor: filterSbee ? theme.tertiaryFixedDim : theme.cardBorder,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.criteriaChipText,
                        { color: filterSbee ? theme.badgeGoldText : theme.text },
                      ]}>
                      Électricité SBEE
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setFilterBitume(!filterBitume)}
                    style={[
                      styles.criteriaChip,
                      {
                        backgroundColor: filterBitume ? theme.badgeGreenBg : theme.surfaceContainerLow,
                        borderColor: filterBitume ? theme.primaryContainer : theme.cardBorder,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.criteriaChipText,
                        { color: filterBitume ? theme.badgeGreenText : theme.text },
                      ]}>
                      Accès bitumé
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setFilterNonInondable(!filterNonInondable)}
                    style={[
                      styles.criteriaChip,
                      {
                        backgroundColor: filterNonInondable ? theme.badgeBlueBg : theme.surfaceContainerLow,
                        borderColor: filterNonInondable ? theme.secondary : theme.cardBorder,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.criteriaChipText,
                        { color: filterNonInondable ? theme.badgeBlueText : theme.text },
                      ]}>
                      Zone non inondable
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Budget Maximum */}
              <View style={styles.filterSection}>
                <Text style={[styles.filterGroupTitle, { color: theme.text }]}>Budget Max (FCFA)</Text>
                <TextInput
                  value={maxPrice}
                  onChangeText={setMaxPrice}
                  placeholder="Ex: 50 000 000"
                  placeholderTextColor={theme.outline}
                  keyboardType="numeric"
                  style={[
                    styles.budgetModalInput,
                    {
                      backgroundColor: theme.surfaceContainerLow,
                      borderColor: theme.cardBorder,
                      color: theme.text,
                    },
                  ]}
                />
              </View>
            </ScrollView>

            <View style={styles.filterModalFooter}>
              <Pressable
                onPress={() => {
                  setMaxPrice('');
                  setFilterTf(true);
                  setFilterConvention(false);
                  setFilterSoneb(true);
                  setFilterSbee(true);
                  setFilterBitume(false);
                  setFilterNonInondable(true);
                }}
                style={[styles.resetBtn, { borderColor: theme.cardBorder }]}>
                <Text style={[styles.resetBtnText, { color: theme.textSecondary }]}>Réinitialiser</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setShowFilterModal(false);
                  void loadSearchResults();
                }}
                style={[styles.applyBtn, { backgroundColor: theme.primaryContainer }]}>
                <Text style={styles.applyBtnText}>Appliquer les Filtres</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Toast */}
      {showSuccessToast && (
        <View style={[styles.toastContainer, { backgroundColor: theme.inverseSurface }]}>
          <SymbolView
            name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
            size={18}
            tintColor={theme.primaryFixedDim}
          />
          <Text style={[styles.toastText, { color: theme.inverseOnSurface }]}>
            Accès débloqué (Validité 15 min) • Micro-débit Kkiapay confirmé.
          </Text>
        </View>
      )}

      {/* Unlock Modal */}
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
  headerStack: {
    gap: 12,
    marginBottom: Spacing.three,
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
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  antiFraudNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  antiFraudTextCol: {
    flex: 1,
    gap: 2,
  },
  antiFraudTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  antiFraudDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  horizontalChipsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  chipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cityChipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  cityChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  counterText: {
    fontSize: 12,
    fontWeight: '500',
  },
  certSealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  certSealText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyBox: {
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  filterSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.four,
    maxHeight: '80%',
    gap: Spacing.three,
  },
  filterSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterSheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterSheetTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  closeModalBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterModalScroll: {
    maxHeight: 340,
  },
  filterSection: {
    gap: 8,
    marginBottom: 16,
  },
  filterGroupTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  criteriaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  criteriaChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  criteriaChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  budgetModalInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
  },
  filterModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 99,
  },
  toastText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});
