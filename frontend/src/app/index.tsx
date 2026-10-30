import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useMemo, useState } from 'react';
import {
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
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { FILTER_CATEGORIES, MOCK_PROPERTIES } from '@/data/mock-properties';
import { useTheme } from '@/hooks/use-theme';
import { PropertyItem, PropertyType } from '@/types/property';

export default function HomeScreen() {
  const { isAuthenticated, openLogin, openRegister } = useAuth();

  const handleOpenLogin = () => {
    openLogin();
    if (Platform.OS === 'web') {
      router.push('/login' as any);
    }
  };

  const handleOpenRegister = () => {
    openRegister();
    if (Platform.OS === 'web') {
      router.push('/register' as any);
    }
  };

  if (!isAuthenticated) {
    return (
      <LandingShowcase
        onOpenLogin={handleOpenLogin}
        onOpenRegister={handleOpenRegister}
      />
    );
  }

  return <AuthenticatedCatalog onOpenLogin={handleOpenLogin} />;
}

function AuthenticatedCatalog({ onOpenLogin }: { onOpenLogin: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();

  const [properties, setProperties] = useState<PropertyItem[]>(MOCK_PROPERTIES);
  const [selectedCategory, setSelectedCategory] = useState<PropertyType>('tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPropertyForUnlock, setSelectedPropertyForUnlock] = useState<PropertyItem | null>(null);

  // Dynamic filter by category and search query
  const filteredProperties = useMemo(() => {
    return properties.filter((item) => {
      // Category filter
      const matchesCategory =
        selectedCategory === 'tous' ? true : item.type === selectedCategory;

      // Search query filter (search across title, commune, quartier, tags)
      const query = searchQuery.trim().toLowerCase();
      if (!query) return matchesCategory;

      const matchesSearch =
        item.title.toLowerCase().includes(query) ||
        item.location.commune.toLowerCase().includes(query) ||
        item.location.quartier.toLowerCase().includes(query) ||
        item.tags.some((tag) => tag.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [properties, selectedCategory, searchQuery]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  };

  const handleToggleFavorite = (id: string) => {
    setProperties((prev) =>
      prev.map((prop) =>
        prop.id === id ? { ...prop, isFavorite: !prop.isFavorite } : prop
      )
    );
  };

  const handleUnlockProperty = (id: string) => {
    setProperties((prev) =>
      prev.map((prop) =>
        prop.id === id ? { ...prop, isUnlocked: true } : prop
      )
    );
    setSelectedPropertyForUnlock(null);
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.centerWrapper}>
        <FlatList
          data={filteredProperties}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          contentContainerStyle={[
            styles.feedContent,
            { paddingBottom: BottomTabInset + Spacing.six + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.headerSection}>
              {/* Top Navigation Bar: Logo & Notification Icon */}
              <View style={styles.topBar}>
                <View style={styles.brandRow}>
                  <View
                    style={[
                      styles.logoBadge,
                      { backgroundColor: theme.primaryLight },
                    ]}>
                    <SymbolView
                      name={{
                        ios: 'house.lodge.fill',
                        android: 'home',
                        web: 'home',
                      }}
                      size={22}
                      tintColor={theme.primary}
                    />
                  </View>
                  <Text style={[styles.brandTitle, { color: theme.primaryDark }]}>
                    E-Mobilier
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                  {/* Notifications Bell */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.notificationButton,
                      {
                        backgroundColor: theme.cardBackground,
                        borderColor: theme.cardBorder,
                      },
                      pressed && { opacity: 0.7 },
                    ]}>
                    <SymbolView
                      name={{
                        ios: 'bell.fill',
                        android: 'notifications',
                        web: 'notifications',
                      }}
                      size={20}
                      tintColor={theme.primary}
                    />
                    <View style={styles.unreadDot} />
                  </Pressable>

                  {/* Auth / Profile Button */}
                  <Pressable
                    onPress={() => {
                      if (isAuthenticated) {
                        router.push('/profile' as any);
                      } else {
                        onOpenLogin();
                      }
                    }}
                    style={({ pressed }) => [
                      styles.topAuthButton,
                      {
                        backgroundColor: isAuthenticated ? theme.primaryLight : theme.primary,
                        borderColor: isAuthenticated ? theme.primaryBorder : theme.primary,
                      },
                      pressed && { opacity: 0.85 },
                    ]}>
                    <SymbolView
                      name={{
                        ios: isAuthenticated ? 'person.crop.circle.fill' : 'person.fill',
                        android: 'person',
                        web: 'person',
                      }}
                      size={14}
                      tintColor={isAuthenticated ? theme.primary : '#FFFFFF'}
                    />
                    <Text
                      style={[
                        styles.topAuthButtonText,
                        { color: isAuthenticated ? theme.primaryDark : '#FFFFFF' },
                      ]}>
                      {isAuthenticated ? (user?.name ? user.name.split(' ')[0] : 'Profil') : 'Connexion'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Search Bar Input */}
              <View
                style={[
                  styles.searchContainer,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.cardBorder,
                  },
                ]}>
                <SymbolView
                  name={{
                    ios: 'magnifyingglass',
                    android: 'search',
                    web: 'search',
                  }}
                  size={19}
                  tintColor={theme.textSecondary}
                />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Rechercher des chambres, parcelles, maisons..."
                  placeholderTextColor={theme.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && (
                  <Pressable
                    onPress={() => setSearchQuery('')}
                    style={styles.clearSearchBtn}>
                    <SymbolView
                      name={{
                        ios: 'xmark.circle.fill',
                        android: 'cancel',
                        web: 'cancel',
                      }}
                      size={18}
                      tintColor={theme.textSecondary}
                    />
                  </Pressable>
                )}
              </View>

              {/* Horizontal Filter Categories Tags */}
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
                      style={({ pressed }) => [
                        styles.filterChip,
                        {
                          backgroundColor: isActive
                            ? theme.primary
                            : theme.cardBackground,
                          borderColor: isActive
                            ? theme.primary
                            : theme.cardBorder,
                        },
                        pressed && { opacity: 0.8 },
                      ]}>
                      <Text
                        style={[
                          styles.filterChipText,
                          {
                            color: isActive ? '#FFFFFF' : theme.tagText,
                            fontWeight: isActive ? '700' : '500',
                          },
                        ]}>
                        {category.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Member Welcome Banner */}
              <Pressable
                onPress={() => router.push('/profile' as any)}
                style={[
                  styles.authBanner,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.cardBorder,
                  },
                ]}>
                <View style={styles.authBannerHeader}>
                  <View
                    style={[
                      styles.authBannerBadge,
                      { backgroundColor: theme.primaryLight },
                    ]}>
                    <SymbolView
                      name={{ ios: 'person.crop.circle.fill', android: 'person', web: 'person' }}
                      size={20}
                      tintColor={theme.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.authBannerTitle, { color: theme.text }]}>
                      Ravi de vous revoir, {user?.name} !
                    </Text>
                    <Text
                      style={[styles.authBannerSubtitle, { color: theme.textSecondary }]}>
                      Solde disponible : {user?.balanceFifa.toLocaleString()} F CFA • Accéder à mon profil →
                    </Text>
                  </View>
                </View>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <PropertyCard
              property={item}
              onPressDetails={(prop) => setSelectedPropertyForUnlock(prop)}
              onToggleFavorite={handleToggleFavorite}
            />
          )}
          ListEmptyComponent={
            <View
              style={[
                styles.emptyContainer,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}>
              <SymbolView
                name={{
                  ios: 'doc.text.magnifyingglass',
                  android: 'search_off',
                  web: 'search_off',
                }}
                size={40}
                tintColor={theme.textSecondary}
              />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                Aucun bien trouvé
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Essayez d'autres mots-clés ou modifiez votre filtre.
              </Text>
              <Pressable
                onPress={() => {
                  setSearchQuery('');
                  setSelectedCategory('tous');
                }}
                style={[
                  styles.resetFilterButton,
                  { backgroundColor: theme.primaryLight },
                ]}>
                <Text style={{ color: theme.primaryDark, fontWeight: '700' }}>
                  Réinitialiser les filtres
                </Text>
              </Pressable>
            </View>
          }
        />
      </View>

      {/* Micro-Payment Unlock Details Modal */}
      <UnlockModal
        visible={!!selectedPropertyForUnlock}
        property={selectedPropertyForUnlock}
        onClose={() => setSelectedPropertyForUnlock(null)}
        onConfirmUnlock={handleUnlockProperty}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerWrapper: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  feedContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  headerSection: {
    marginBottom: Spacing.four,
    gap: 14,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
      },
    }),
  },
  unreadDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 6,
    borderRadius: 26,
    borderWidth: 1,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
      },
    }),
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
  },
  clearSearchBtn: {
    padding: 4,
  },
  filterScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: Spacing.four,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  resetFilterButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  topAuthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  topAuthButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  authBanner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      },
    }),
  },
  authBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  authBannerBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  authBannerSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  authBannerActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  authBannerLoginBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authBannerLoginText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  authBannerRegisterBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authBannerRegisterText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
