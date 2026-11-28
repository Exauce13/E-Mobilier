import { router } from 'expo-router';
import {
  Bell,
  Briefcase,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileText,
  LogOut,
  Menu,
  Moon,
  PlusCircle,
  Search,
  Settings,
  Sun,
  User,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { MobileNavDrawer, type MobileNavItem } from '@/components/ui/mobile-nav-drawer';
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

const FEED_PER_PAGE = 12;

function buildPaginationSlots(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, total, current]);
  if (current > 1) pages.add(current - 1);
  if (current < total) pages.add(current + 1);
  const sorted = Array.from(pages).sort((a, b) => a - b);

  const slots: (number | 'ellipsis')[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      slots.push('ellipsis');
    }
    slots.push(sorted[i]);
  }
  return slots;
}

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

  return <AuthenticatedPropertyFeed />;
}

function AuthenticatedPropertyFeed() {
  const theme = useTheme();
  const { isDark, toggleTheme } = useThemeMode();
  const insets = useSafeAreaInsets();
  const {
    isSmallMobile,
    isMobile,
    isDesktop,
    gridColumns,
    contentMaxWidth,
    horizontalPadding,
    getGridItemWidth,
  } = useResponsive();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const {
    user,
    logout,
    unreadNotificationsCount,
    refreshUnreadCount,
    isAdminStaff,
    isAgentMobilier,
  } = useAuth();
  const storageBaseUrl = useMemo(() => getStorageBaseUrl(), []);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const [selectedCategory, setSelectedCategory] = useState<PropertyCategory>('tous');
  const [selectedTransaction, setSelectedTransaction] = useState<'tous' | 'location' | 'vente'>('tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 320);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchFeedPage = useCallback(
    async (targetPage: number, mode: 'initial' | 'paginate' | 'refresh' = 'initial') => {
      setErrorMsg(null);
      if (mode === 'initial') setLoading(true);
      if (mode === 'paginate') setPageLoading(true);

      try {
        const favs = await favoritesStorage.getAll();
        const res = await proprietesApi.getFeed({
          type: selectedCategory === 'tous' ? undefined : selectedCategory,
          transaction_type: selectedTransaction === 'tous' ? undefined : selectedTransaction,
          search: debouncedSearch || undefined,
          page: targetPage,
          per_page: FEED_PER_PAGE,
        });

        if (!res.success || !res.data) {
          setProperties([]);
          setTotalItems(0);
          setLastPage(1);
          setErrorMsg(res.message || 'Impossible de charger le feed des biens immobiliers.');
          return;
        }

        const mapped = (res.data.data || []).map((p: BackendProperty) =>
          mapBackendPropertyToItem(p, storageBaseUrl, favs)
        );

        setProperties(mapped);
        setPage(res.data.current_page || targetPage);
        setLastPage(res.data.last_page || 1);
        setTotalItems(res.data.total ?? mapped.length);
      } catch {
        setErrorMsg('Erreur de connexion au serveur. Veuillez réessayer.');
      } finally {
        if (mode === 'initial') setLoading(false);
        if (mode === 'paginate') setPageLoading(false);
      }
    },
    [selectedCategory, selectedTransaction, debouncedSearch, storageBaseUrl]
  );

  // Recharge systématiquement page 1 à chaque changement de filtre / recherche
  useEffect(() => {
    void fetchFeedPage(1, 'initial');
    void refreshUnreadCount();
  }, [fetchFeedPage, refreshUnreadCount]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchFeedPage(page, 'refresh'), refreshUnreadCount()]);
    setRefreshing(false);
  };

  const handleGoToPage = async (targetPage: number) => {
    if (pageLoading || loading || targetPage < 1 || targetPage > lastPage || targetPage === page) {
      return;
    }
    await fetchFeedPage(targetPage, 'paginate');
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleToggleFavorite = async (id: string) => {
    const next = await favoritesStorage.toggle(id);
    setProperties((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isFavorite: next.has(id) } : item))
    );
  };

  const handleOpenProperty = (property: PropertyItem) => {
    router.push(`/property/${property.id}` as any);
  };

  const handleResetFilters = () => {
    setSelectedCategory('tous');
    setSelectedTransaction('tous');
    setSearchQuery('');
  };

  const paginationSlots = useMemo(() => buildPaginationSlots(page, lastPage), [page, lastPage]);

  const cardWidth = getGridItemWidth(gridColumns, 16);

  const mobileNavItems = useMemo<MobileNavItem[]>(() => {
    const list: MobileNavItem[] = [
      {
        key: 'publish',
        label: 'Publier un bien',
        subtitle: 'Déposer une annonce immobilière',
        icon: <PlusCircle size={18} color={theme.primary} strokeWidth={2.2} />,
        accent: true,
        onPress: () => router.push('/publish' as any),
      },
      {
        key: 'explore',
        label: 'Recherche avancée',
        subtitle: 'Commune, budget, surface, chambres',
        icon: <Search size={18} color={theme.primary} strokeWidth={2.2} />,
        onPress: () => router.push('/explore' as any),
      },
    ];

    if (isAgentMobilier) {
      list.push({
        key: 'agent-space',
        label: 'Espace Agent',
        subtitle: 'Mes biens, mes visites, mon profil',
        icon: <Briefcase size={18} color={theme.primary} strokeWidth={2.2} />,
        onPress: () => router.push('/agent-space' as any),
      });
    } else {
      list.push({
        key: 'client-space',
        label: 'Espace Client',
        subtitle: 'Mes annonces, mes recherches, mes visites, mon profil',
        icon: <User size={18} color={theme.primary} strokeWidth={2.2} />,
        onPress: () => router.push('/client-space' as any),
      });
    }

    list.push({
      key: 'notifications',
      label: 'Notifications',
      subtitle: 'Alertes en temps réel',
      badge: unreadNotificationsCount || undefined,
      icon: <Bell size={18} color={theme.primary} strokeWidth={2.2} />,
      onPress: () => router.push('/notifications' as any),
    });

    if (isAdminStaff) {
      list.push({
        key: 'admin',
        label: 'Back-Office Admin',
        subtitle: 'Modération, visites & gouvernance',
        icon: <Settings size={18} color="#D97706" strokeWidth={2.2} />,
        onPress: () => router.push('/admin' as any),
      });
    }

    list.push({
      key: 'cgu',
      label: 'CGU & Tarifs',
      subtitle: 'Conditions générales d’utilisation',
      icon: <FileText size={18} color={theme.textSecondary} strokeWidth={2.2} />,
      onPress: () => router.push('/cgu' as any),
    });

    return list;
  }, [isAgentMobilier, isAdminStaff, unreadNotificationsCount, theme.primary, theme.textSecondary]);

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <MobileNavDrawer
        visible={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        title="E-Mobilier"
        subtitle={user?.name || 'Mon espace'}
        items={mobileNavItems}
        isDark={isDark}
        onToggleTheme={() => {
          void toggleTheme();
        }}
        footerAction={{
          label: 'Se déconnecter',
          danger: true,
          onPress: () => {
            void logout();
          },
        }}
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: BottomTabInset + insets.bottom + 88,
          },
        ]}>
        <View style={[styles.innerWrap, { maxWidth: contentMaxWidth }]}>
          {/* Top Navigation Bar */}
          <View style={styles.brandRow}>
            {!isDesktop && (
              <Pressable
                accessibilityLabel="Ouvrir le menu"
                onPress={() => setMobileMenuOpen(true)}
                style={[
                  styles.iconCircleBtn,
                  { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                ]}
                hitSlop={6}>
                <Menu size={19} color={theme.text} strokeWidth={2.2} />
              </Pressable>
            )}

            <View style={styles.brandTitleGroup}>
              <View style={styles.titleWithFlag}>
                <Building2 size={isSmallMobile ? 18 : 20} color={theme.primary} strokeWidth={2.2} />
                <Text
                  numberOfLines={1}
                  style={[styles.brandName, { color: theme.primary }, isSmallMobile && { fontSize: 18 }]}>
                  E-Mobilier
                </Text>
                {!isSmallMobile && (
                  <View style={[styles.flagChip, { backgroundColor: theme.backgroundElement }]}>
                    <Text style={[styles.flagText, { color: theme.text }]}>FEED</Text>
                  </View>
                )}
              </View>
              <Text numberOfLines={1} style={[styles.brandSubtitle, { color: theme.textSecondary }]}>
                Bonjour {user?.prenom || user?.name?.split(' ')[0] || 'Bienvenue'} • Biens immobiliers publiés
              </Text>
            </View>

            <View style={styles.headerActions}>
              {!isSmallMobile && (
                <Pressable
                  accessibilityLabel="Changer de thème"
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
              )}

              <Pressable
                accessibilityLabel="Notifications"
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

              {isDesktop && (
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
                  <Text style={styles.logoutPillText}>Déconnexion</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Compact Role-Aware Action Strip (Desktop: full horizontal bar | Mobile/Tablet: concise 2-CTA strip + Hamburger menu) */}
          <View style={[styles.quickStrip, { backgroundColor: theme.navy }]}>
            <Pressable
              onPress={() => router.push('/publish' as any)}
              style={[
                styles.quickActionBtn,
                { backgroundColor: theme.primary },
                isMobile && { flex: 1, justifyContent: 'center' },
              ]}>
              <PlusCircle size={15} color="#FFFFFF" strokeWidth={2.2} />
              <Text numberOfLines={1} style={styles.quickActionText}>
                Publier un bien
              </Text>
            </Pressable>

            {isDesktop ? (
              <>
                <Pressable
                  onPress={() => router.push('/explore' as any)}
                  style={[styles.quickActionBtn, styles.quickActionOutline]}>
                  <Search size={15} color="#FFFFFF" strokeWidth={2} />
                  <Text style={styles.quickActionText}>Filtres avancés</Text>
                </Pressable>

                {isAgentMobilier ? (
                  <Pressable
                    onPress={() => router.push('/agent-space' as any)}
                    style={[styles.quickActionBtn, styles.quickActionOutline]}>
                    <Briefcase size={15} color="#FDE68A" strokeWidth={2} />
                    <Text style={[styles.quickActionText, { color: '#FDE68A' }]}>Espace Agent</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => router.push('/client-space' as any)}
                    style={[styles.quickActionBtn, styles.quickActionOutline]}>
                    <User size={15} color="#FDE68A" strokeWidth={2} />
                    <Text style={[styles.quickActionText, { color: '#FDE68A' }]}>Espace Client</Text>
                  </Pressable>
                )}

                {isAdminStaff && (
                  <Pressable
                    onPress={() => router.push('/admin' as any)}
                    style={[styles.quickActionBtn, styles.quickActionOutline]}>
                    <Settings size={15} color="#FDE68A" strokeWidth={2} />
                    <Text style={[styles.quickActionText, { color: '#FDE68A' }]}>Back-Office Admin</Text>
                  </Pressable>
                )}
              </>
            ) : isAdminStaff ? (
              <Pressable
                onPress={() => router.push('/admin' as any)}
                style={[styles.quickActionBtn, styles.quickActionOutline, isMobile && { flex: 1, justifyContent: 'center' }]}>
                <Settings size={15} color="#FDE68A" strokeWidth={2} />
                <Text numberOfLines={1} style={[styles.quickActionText, { color: '#FDE68A' }]}>
                  Admin
                </Text>
              </Pressable>
            ) : isAgentMobilier ? (
              <Pressable
                onPress={() => router.push('/agent-space' as any)}
                style={[styles.quickActionBtn, styles.quickActionOutline, isMobile && { flex: 1, justifyContent: 'center' }]}>
                <Briefcase size={15} color="#FDE68A" strokeWidth={2} />
                <Text numberOfLines={1} style={[styles.quickActionText, { color: '#FDE68A' }]}>
                  Espace Agent
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push('/client-space' as any)}
                style={[styles.quickActionBtn, styles.quickActionOutline, isMobile && { flex: 1, justifyContent: 'center' }]}>
                <User size={15} color="#FDE68A" strokeWidth={2} />
                <Text numberOfLines={1} style={[styles.quickActionText, { color: '#FDE68A' }]}>
                  Espace Client
                </Text>
              </Pressable>
            )}
          </View>

          {/* Search & Quick Category / Transaction Filters */}
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
                placeholder="Rechercher par commune, quartier, maison, parcelle, chambre..."
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

              <View style={[styles.txSegmented, { backgroundColor: theme.backgroundElement }, isMobile && { width: '100%' }]}>
                {(['tous', 'location', 'vente'] as const).map((tr) => {
                  const active = selectedTransaction === tr;
                  const label = tr === 'tous' ? 'Tous' : tr === 'location' ? 'Location' : 'Vente';
                  return (
                    <Pressable
                      key={tr}
                      onPress={() => setSelectedTransaction(tr)}
                      style={[
                        styles.txBtn,
                        isMobile && { flex: 1, alignItems: 'center' },
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

          {/* Feed Heading & Counter */}
          <View style={styles.resultsRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {selectedCategory === 'tous'
                ? 'Feed des biens immobiliers publiés'
                : `Biens publiés — ${selectedCategory}`}
            </Text>
            <Text style={[styles.resultsCount, { color: theme.textSecondary }]}>
              {totalItems} bien{totalItems > 1 ? 's' : ''}
              {lastPage > 1 ? ` • Page ${page}/${lastPage}` : ''}
            </Text>
          </View>

          {/* Feed Content States */}
          {loading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Chargement des biens immobiliers publiés...
              </Text>
            </View>
          ) : errorMsg ? (
            <View
              style={[
                styles.emptyContainer,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: '#FECACA',
                  borderWidth: 1,
                  borderRadius: 20,
                },
              ]}>
              <Text style={[styles.emptyTitle, { color: '#B91C1C' }]}>
                Erreur de chargement du feed
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>{errorMsg}</Text>
              <Pressable
                onPress={() => void fetchFeedPage(page, 'initial')}
                style={[styles.retryBtn, { backgroundColor: theme.primary }]}>
                <Text style={styles.retryText}>Réessayer</Text>
              </Pressable>
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
                Aucun bien immobilier disponible
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                {selectedCategory !== 'tous' || selectedTransaction !== 'tous' || debouncedSearch.length > 0
                  ? 'Aucun bien publié ne correspond à vos filtres actuels.'
                  : "Aucun bien n'est publié dans le catalogue pour le moment."}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 6 }}>
                {(selectedCategory !== 'tous' || selectedTransaction !== 'tous' || debouncedSearch.length > 0) && (
                  <Pressable
                    onPress={handleResetFilters}
                    style={[styles.retryBtn, { backgroundColor: theme.primary }]}>
                    <Text style={styles.retryText}>Réinitialiser les filtres</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => void fetchFeedPage(1, 'initial')}
                  style={[styles.retryBtn, { backgroundColor: theme.navy }]}>
                  <Text style={styles.retryText}>Actualiser</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {pageLoading && (
                <View style={styles.pageLoaderRow}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '600' }}>
                    Chargement de la page...
                  </Text>
                </View>
              )}

              <View style={[styles.cardsGrid, pageLoading && { opacity: 0.6 }]}>
                {properties.map((item) => (
                  <View key={item.id} style={{ width: cardWidth }}>
                    <PropertyCard
                      property={item}
                      onPressCard={handleOpenProperty}
                      onPressDetails={handleOpenProperty}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  </View>
                ))}
              </View>

              {/* Backend-Connected Page-by-Page Pagination */}
              {lastPage > 1 && (
                <View
                  style={[
                    styles.paginationCard,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}>
                  <Text style={[styles.paginationInfo, { color: theme.textSecondary }]}>
                    Page {page} sur {lastPage} ({totalItems} bien{totalItems > 1 ? 's' : ''} au total)
                  </Text>

                  <View style={styles.paginationControls}>
                    <Pressable
                      accessibilityLabel="Page précédente"
                      onPress={() => void handleGoToPage(page - 1)}
                      disabled={page <= 1 || pageLoading}
                      style={[
                        styles.pageNavBtn,
                        {
                          borderColor: theme.cardBorder,
                          backgroundColor: theme.backgroundElement,
                          opacity: page <= 1 || pageLoading ? 0.45 : 1,
                        },
                      ]}>
                      <ChevronLeft size={16} color={theme.text} strokeWidth={2.3} />
                      {!isSmallMobile && <Text style={[styles.pageNavText, { color: theme.text }]}>Précédent</Text>}
                    </Pressable>

                    <View style={styles.pageNumbersRow}>
                      {paginationSlots.map((slot, idx) =>
                        slot === 'ellipsis' ? (
                          <Text
                            key={`dots-${idx}`}
                            style={{ color: theme.textSecondary, paddingHorizontal: 4, fontWeight: '700' }}>
                            …
                          </Text>
                        ) : (
                          <Pressable
                            key={`page-${slot}`}
                            onPress={() => void handleGoToPage(slot)}
                            disabled={pageLoading}
                            style={[
                              styles.pageNumberBtn,
                              {
                                backgroundColor: slot === page ? theme.primary : theme.backgroundElement,
                                borderColor: slot === page ? theme.primary : theme.cardBorder,
                              },
                            ]}>
                            <Text
                              style={{
                                color: slot === page ? '#FFFFFF' : theme.text,
                                fontSize: 13,
                                fontWeight: '800',
                              }}>
                              {slot}
                            </Text>
                          </Pressable>
                        )
                      )}
                    </View>

                    <Pressable
                      accessibilityLabel="Page suivante"
                      onPress={() => void handleGoToPage(page + 1)}
                      disabled={page >= lastPage || pageLoading}
                      style={[
                        styles.pageNavBtn,
                        {
                          borderColor: theme.cardBorder,
                          backgroundColor: theme.backgroundElement,
                          opacity: page >= lastPage || pageLoading ? 0.45 : 1,
                        },
                      ]}>
                      {!isSmallMobile && <Text style={[styles.pageNavText, { color: theme.text }]}>Suivant</Text>}
                      <ChevronRight size={16} color={theme.text} strokeWidth={2.3} />
                    </Pressable>
                  </View>
                </View>
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
  innerWrap: { width: '100%', alignSelf: 'center', gap: 14 },
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

  quickStrip: {
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 11,
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

  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  resultsCount: { fontSize: 13, fontWeight: '600' },
  pageLoaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  paginationCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  paginationInfo: {
    fontSize: 12,
    fontWeight: '700',
  },
  paginationControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pageNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  pageNavText: {
    fontSize: 13,
    fontWeight: '700',
  },
  pageNumbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageNumberBtn: {
    minWidth: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  emptyContainer: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', maxWidth: 460 },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
