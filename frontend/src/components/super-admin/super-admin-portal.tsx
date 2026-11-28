import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  Activity,
  Bell,
  Building2,
  Calendar,
  CalendarCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  Wallet,
  X,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AgentsKycSection,
  DemasquagesSection,
  GovernanceSection,
  TechHealthSection,
} from '@/components/admin/admin-gov-sections';
import { VisitesDemandesWorkspace } from '@/components/admin/visites-demandes-workspace';
import { SuperAdminDashboardPro } from '@/components/super-admin/super-admin-dashboard';
import {
  SA_COLORS,
  SuperAdminFinanceSection,
  SuperAdminLogsSection,
  SuperAdminPageKey,
  SuperAdminPostsSection,
  SuperAdminProfileSection,
  SuperAdminSettingsSection,
} from '@/components/super-admin/super-admin-sections';
import { useAuth } from '@/context/auth-context';
import { useResponsive } from '@/hooks/use-responsive';
import type {
  SuperAdminSidebarBadges,
  SuperAdminSystemHealthSummary,
} from '@/types/api';

const PAGE_META: Record<SuperAdminPageKey, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Tableau de bord',
    subtitle: 'Vue globale des opérations et de la performance de la plateforme',
  },
  finance: {
    title: 'Coffre-Fort & Retraits',
    subtitle: 'Trésorerie, Grand Livre HMAC, retraits OTP & coupe-circuit',
  },
  moderation: {
    title: 'Posts Clients & Agents',
    subtitle: 'Toutes les annonces publiées et en attente de modération',
  },
  visites: {
    title: 'Visites & Demandes',
    subtitle: 'Supervision des visites physiques terrain et traitement opérationnel des demandes de recherche & matching',
  },
  demasquages: {
    title: 'Démasquages TTL',
    subtitle: 'Arbitrage anti-contournement des accès aux coordonnées',
  },
  equipe: {
    title: 'Équipe, KYC & Zones',
    subtitle: 'Gestion des rôles RBAC, agrément agents et zones du Bénin',
  },
  logs: {
    title: 'Journalisation Globale',
    subtitle: 'Audit chronologique complet de toute la plateforme E-Mobilier',
  },
  parametres: {
    title: 'Paramètres & Tarifs',
    subtitle: 'Tarifs officiels, contacts publics, TTL sécurité et bénéficiaire',
  },
  securite: {
    title: 'CGU & Santé Système',
    subtitle: 'Documents légaux, webhooks et santé infrastructure',
  },
  profil: {
    title: 'Mon Profil Super Admin',
    subtitle: 'Photo de profil, informations personnelles et sécurité 2FA',
  },
};

type NavIconComp = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const NAV_GROUPS: {
  section: string;
  items: {
    key: SuperAdminPageKey;
    label: string;
    Icon: NavIconComp;
    tag?: string;
    badgeKey?: keyof SuperAdminSidebarBadges;
  }[];
}[] = [
  {
    section: 'PILOTAGE',
    items: [
      { key: 'dashboard', label: 'Tableau de bord', Icon: LayoutDashboard },
      { key: 'finance', label: 'Coffre-Fort & Retraits', Icon: Wallet, tag: 'Exclusif', badgeKey: 'finance' },
    ],
  },
  {
    section: 'OPÉRATIONS',
    items: [
      { key: 'moderation', label: 'Posts Clients & Agents', Icon: Building2, badgeKey: 'moderation' },
      { key: 'visites', label: 'Visites & Demandes', Icon: CalendarCheck, badgeKey: 'visites' },
      { key: 'demasquages', label: 'Démasquages TTL', Icon: ShieldAlert, badgeKey: 'demasquages' },
    ],
  },
  {
    section: 'GOUVERNANCE & AUDIT',
    items: [
      { key: 'equipe', label: 'Équipe, KYC & Zones', Icon: Users, badgeKey: 'equipe' },
      { key: 'logs', label: 'Journalisation Globale', Icon: ScrollText },
      { key: 'parametres', label: 'Paramètres & Tarifs', Icon: SlidersHorizontal },
      { key: 'securite', label: 'CGU & Santé Système', Icon: Activity },
    ],
  },
];

export function SuperAdminPrincipalPortal({
  initialPage = 'dashboard',
}: {
  initialPage?: SuperAdminPageKey;
}) {
  const { width, isSmallMobile, isDesktop, isLargeDesktop, contentMaxWidth, horizontalPadding } = useResponsive();
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { user, unreadNotificationsCount, isFinancialOwner, logout } = useAuth();
  const safeInitialPage: SuperAdminPageKey =
    initialPage === 'finance' && !isFinancialOwner ? 'dashboard' : initialPage;
  const [activePage, setActivePage] = useState<SuperAdminPageKey>(safeInitialPage);
  const [visitesSubTab, setVisitesSubTab] = useState<'visites' | 'demandes'>('visites');
  const [equipeSubTab, setEquipeSubTab] = useState<'governance' | 'kyc'>('governance');

  const [sidebarBadges, setSidebarBadges] = useState<SuperAdminSidebarBadges>({
    moderation: 0,
    visites: 0,
    demasquages: 0,
    equipe: 0,
    finance: 0,
  });
  const [systemHealth, setSystemHealth] = useState<SuperAdminSystemHealthSummary>({
    status: 'operational',
    label: 'Système opérationnel',
    db_latency_ms: null,
    failed_jobs: 0,
  });

  const handleNavigate = useCallback((page: SuperAdminPageKey, subTab?: string) => {
    if (page === 'visites' && (subTab === 'visites' || subTab === 'demandes')) {
      setVisitesSubTab(subTab);
    }
    if (page === 'equipe' && (subTab === 'governance' || subTab === 'kyc')) {
      setEquipeSubTab(subTab);
    }
    setActivePage(page);
  }, []);

  const handleSyncHeaderState = useCallback(
    (payload: {
      sidebarBadges: SuperAdminSidebarBadges;
      systemHealth: SuperAdminSystemHealthSummary;
    }) => {
      setSidebarBadges(payload.sidebarBadges);
      setSystemHealth(payload.systemHealth);
    },
    []
  );

  const todayFormatted = useMemo(() => {
    const raw = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, []);

  const meta = PAGE_META[activePage];
  const drawerWidth = Math.min(308, Math.round(width * 0.86));
  const initials = (user?.name || 'JM')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const healthColors =
    systemHealth.status === 'error'
      ? { bg: SA_COLORS.dangerBg, dot: SA_COLORS.danger, text: SA_COLORS.danger }
      : systemHealth.status === 'degraded'
      ? { bg: SA_COLORS.amberBg, dot: '#D97706', text: SA_COLORS.amberText }
      : { bg: SA_COLORS.greenSoft, dot: SA_COLORS.green, text: SA_COLORS.green };

  const noopCharte = () => {};

  const renderNavGroups = (closeDrawerOnPress = false) => (
    <ScrollView style={styles.navScroll} contentContainerStyle={{ padding: 12, gap: 4 }}>
      {NAV_GROUPS.map((group) => (
        <View key={group.section} style={{ marginBottom: 12 }}>
          <Text style={styles.navSectionTitle}>{group.section}</Text>
          <View style={{ gap: 2 }}>
            {group.items
              .filter((item) => item.key !== 'finance' || isFinancialOwner)
              .map((item) => {
                const active = activePage === item.key;
                const badgeCount = item.badgeKey ? sidebarBadges[item.badgeKey] : 0;
                const IconComp = item.Icon;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => {
                      setActivePage(item.key);
                      if (closeDrawerOnPress) setDrawerOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.navItem,
                      active && styles.navItemActive,
                      pressed && !active && { backgroundColor: '#F8FAFC' },
                      Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null,
                    ]}>
                    {active && <View style={styles.navActiveBar} />}
                    <View style={styles.navItemLeft}>
                      <IconComp
                        size={16}
                        color={active ? SA_COLORS.green : '#64748B'}
                        strokeWidth={active ? 2.4 : 2}
                      />
                      <Text
                        numberOfLines={1}
                        style={[styles.navItemText, active && styles.navItemTextActive]}>
                        {item.label}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      {badgeCount > 0 ? (
                        <View style={styles.pendingBadge}>
                          <Text style={styles.pendingBadgeText}>
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </Text>
                        </View>
                      ) : item.tag ? (
                        <View style={styles.tagPill}>
                          <Text style={styles.tagPillText}>{item.tag}</Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
          </View>
        </View>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={[styles.shell, isDesktop && styles.shellDesktop]}>
        {/* Desktop Sidebar */}
        {isDesktop && (
          <View style={styles.sidebar}>
            <View style={styles.brandHeader}>
              <View style={styles.brandLogo}>
                <Text style={styles.brandLogoText}>EM</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={styles.brandTitle}>E-Mobilier</Text>
                <Text numberOfLines={1} style={styles.brandRole}>Super Admin Principal</Text>
              </View>
            </View>

            {renderNavGroups(false)}

            {/* User Footer */}
            <View style={styles.sidebarFooter}>
              <Pressable onPress={() => setActivePage('profil')} style={styles.userFooterRow}>
                {user?.photo_url ? (
                  <Image source={{ uri: user.photo_url }} style={styles.avatarSmallImg} contentFit="cover" />
                ) : (
                  <View style={styles.avatarSmall}>
                    <Text style={styles.avatarSmallText}>{initials}</Text>
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={styles.userFooterName}>
                    {user?.name || 'Super Admin'}
                  </Text>
                  <Text numberOfLines={1} style={styles.userFooterLink}>
                    Mon profil &amp; sécurité
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => void logout()}
                style={[styles.sidebarLogoutBtn, { flexDirection: 'row', justifyContent: 'center', gap: 6 }]}>
                <LogOut size={14} color={SA_COLORS.danger} strokeWidth={2.2} />
                <Text style={styles.sidebarLogoutText}>Se déconnecter</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Main Column */}
        <View style={styles.mainCol}>
          {/* Top Header */}
          <View style={[styles.topHeader, isSmallMobile && { paddingHorizontal: 10, gap: 8 }]}>
            {!isDesktop && (
              <Pressable
                accessibilityLabel="Ouvrir le menu administration"
                onPress={() => setDrawerOpen(true)}
                style={styles.mobileMenuBtn}
                hitSlop={6}>
                <Menu size={20} color={SA_COLORS.text} strokeWidth={2.2} />
              </Pressable>
            )}

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={[styles.headerTitle, isSmallMobile && { fontSize: 15 }]}>
                {meta.title}
              </Text>
              {!isSmallMobile && (
                <Text numberOfLines={1} style={styles.headerSub}>
                  {meta.subtitle}
                </Text>
              )}
            </View>

            <View style={styles.headerRight}>
              {isLargeDesktop && (
                <View style={styles.dateChip}>
                  <Calendar size={13} color={SA_COLORS.muted} strokeWidth={2.1} />
                  <Text style={styles.dateChipText}>{todayFormatted}</Text>
                </View>
              )}

              {isDesktop && (
                <Pressable
                  onPress={() => setActivePage('securite')}
                  style={[styles.statusChip, { backgroundColor: healthColors.bg }]}>
                  <View style={[styles.statusDot, { backgroundColor: healthColors.dot }]} />
                  <Text style={[styles.statusChipText, { color: healthColors.text }]}>
                    {systemHealth.label}
                  </Text>
                </Pressable>
              )}

              <Pressable
                accessibilityLabel="Notifications"
                onPress={() => router.push('/notifications' as any)}
                style={styles.notifBtn}>
                <Bell size={15} color={SA_COLORS.text} strokeWidth={2.2} />
                {!isSmallMobile && <Text style={styles.notifBtnText}>Notifs</Text>}
                {unreadNotificationsCount > 0 && (
                  <View style={styles.notifCount}>
                    <Text style={styles.notifCountText}>
                      {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                    </Text>
                  </View>
                )}
              </Pressable>

              <Pressable onPress={() => setActivePage('profil')} style={styles.headerProfilePill}>
                {user?.photo_url ? (
                  <Image source={{ uri: user.photo_url }} style={styles.headerAvatarImg} contentFit="cover" />
                ) : (
                  <View style={styles.headerAvatarCircle}>
                    <Text style={styles.avatarSmallText}>{initials}</Text>
                  </View>
                )}
                {isDesktop && (
                  <View style={{ maxWidth: 130 }}>
                    <Text numberOfLines={1} style={styles.headerProfileName}>
                      {user?.name || 'Super Admin'}
                    </Text>
                    <Text numberOfLines={1} style={styles.headerProfileRole}>
                      Super Admin
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>

          {/* Mobile / Tablet Hamburger Drawer */}
          <Modal
            visible={drawerOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setDrawerOpen(false)}>
            <View style={styles.drawerOverlay}>
              <Pressable style={styles.drawerBackdrop} onPress={() => setDrawerOpen(false)} />
              <SafeAreaView edges={['top', 'bottom']} style={[styles.drawerPanel, { width: drawerWidth }]}>
                <View style={styles.brandHeader}>
                  <View style={styles.brandLogo}>
                    <Text style={styles.brandLogoText}>EM</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={styles.brandTitle}>E-Mobilier</Text>
                    <Text numberOfLines={1} style={styles.brandRole}>Super Admin Principal</Text>
                  </View>
                  <Pressable onPress={() => setDrawerOpen(false)} style={styles.drawerCloseBtn} hitSlop={8}>
                    <X size={18} color={SA_COLORS.text} strokeWidth={2.2} />
                  </Pressable>
                </View>

                {renderNavGroups(true)}

                <View style={styles.sidebarFooter}>
                  <Pressable
                    onPress={() => {
                      setActivePage('profil');
                      setDrawerOpen(false);
                    }}
                    style={styles.userFooterRow}>
                    {user?.photo_url ? (
                      <Image source={{ uri: user.photo_url }} style={styles.avatarSmallImg} contentFit="cover" />
                    ) : (
                      <View style={styles.avatarSmall}>
                        <Text style={styles.avatarSmallText}>{initials}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={styles.userFooterName}>
                        {user?.name || 'Super Admin'}
                      </Text>
                      <Text numberOfLines={1} style={styles.userFooterLink}>
                        Mon profil &amp; sécurité
                      </Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setDrawerOpen(false);
                      void logout();
                    }}
                    style={[styles.sidebarLogoutBtn, { flexDirection: 'row', justifyContent: 'center', gap: 6 }]}>
                    <LogOut size={14} color={SA_COLORS.danger} strokeWidth={2.2} />
                    <Text style={styles.sidebarLogoutText}>Se déconnecter</Text>
                  </Pressable>
                </View>
              </SafeAreaView>
            </View>
          </Modal>

          {/* Mobile Horizontal Nav */}
          {!isDesktop && (
            <View style={styles.mobileNavStrip}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mobileNavContent}>
                {[
                  { key: 'dashboard', label: 'Tableau de bord' },
                  ...(isFinancialOwner ? [{ key: 'finance', label: 'Coffre-Fort', badge: sidebarBadges.finance }] : []),
                  { key: 'moderation', label: 'Posts', badge: sidebarBadges.moderation },
                  { key: 'visites', label: 'Visites', badge: sidebarBadges.visites },
                  { key: 'demasquages', label: 'TTL', badge: sidebarBadges.demasquages },
                  { key: 'equipe', label: 'Équipe & KYC', badge: sidebarBadges.equipe },
                  { key: 'logs', label: 'Journal' },
                  { key: 'parametres', label: 'Paramètres' },
                  { key: 'securite', label: 'Système' },
                  { key: 'profil', label: 'Profil' },
                ].map((tab) => {
                  const active = activePage === tab.key;
                  return (
                    <Pressable
                      key={tab.key}
                      onPress={() => setActivePage(tab.key as SuperAdminPageKey)}
                      style={[styles.mobilePill, active && styles.mobilePillActive]}>
                      <Text style={[styles.mobilePillText, active && styles.mobilePillTextActive]}>
                        {tab.label}
                        {tab.badge && tab.badge > 0 ? ` (${tab.badge})` : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Main Scrollable Content */}
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={[
              styles.contentContainer,
              {
                maxWidth: Math.min(contentMaxWidth, 1340),
                paddingHorizontal: horizontalPadding,
                paddingBottom: Math.max(insets.bottom, 24) + 28,
              },
            ]}
            showsVerticalScrollIndicator={false}>
            {activePage === 'dashboard' && (
              <SuperAdminDashboardPro
                onNavigate={handleNavigate}
                onSyncHeaderState={handleSyncHeaderState}
              />
            )}
            {activePage === 'finance' && isFinancialOwner && <SuperAdminFinanceSection />}
            {activePage === 'moderation' && <SuperAdminPostsSection />}

            {activePage === 'visites' && (
              <VisitesDemandesWorkspace
                activeTab={visitesSubTab}
                onTabChange={setVisitesSubTab}
                onCharteRequired={noopCharte}
              />
            )}

            {activePage === 'demasquages' && <DemasquagesSection />}

            {activePage === 'equipe' && (
              <View style={{ gap: 14 }}>
                <View style={styles.subTabRow}>
                  <Pressable
                    onPress={() => setEquipeSubTab('governance')}
                    style={equipeSubTab === 'governance' ? styles.subTabActive : styles.subTab}>
                    <Text style={equipeSubTab === 'governance' ? styles.subTabTextActive : styles.subTabText}>
                      Utilisateurs, Staff &amp; Zones
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setEquipeSubTab('kyc')}
                    style={equipeSubTab === 'kyc' ? styles.subTabActive : styles.subTab}>
                    <Text style={equipeSubTab === 'kyc' ? styles.subTabTextActive : styles.subTabText}>
                      Agrément &amp; KYC Agents
                    </Text>
                  </Pressable>
                </View>
                {equipeSubTab === 'governance' ? <GovernanceSection /> : <AgentsKycSection />}
              </View>
            )}

            {activePage === 'logs' && <SuperAdminLogsSection />}
            {activePage === 'parametres' && <SuperAdminSettingsSection />}
            {activePage === 'securite' && <TechHealthSection />}
            {activePage === 'profil' && <SuperAdminProfileSection />}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SA_COLORS.white },
  shell: { flex: 1, flexDirection: 'column', backgroundColor: '#F4F7F6' },
  shellDesktop: { flexDirection: 'row' },
  sidebar: {
    width: 268,
    backgroundColor: SA_COLORS.white,
    borderRightWidth: 1,
    borderRightColor: SA_COLORS.border,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: SA_COLORS.slateSoft,
  },
  brandLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: SA_COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoText: { color: SA_COLORS.white, fontSize: 13, fontWeight: '900' },
  brandTitle: { fontSize: 15, fontWeight: '900', color: SA_COLORS.text },
  brandRole: { fontSize: 11, fontWeight: '700', color: SA_COLORS.green },
  navScroll: { flex: 1 },
  navSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.9,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  navItem: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 11,
    gap: 8,
  },
  navItemActive: { backgroundColor: SA_COLORS.greenSoft },
  navActiveBar: {
    position: 'absolute',
    left: 0,
    top: 7,
    bottom: 7,
    width: 3.5,
    borderRadius: 4,
    backgroundColor: SA_COLORS.green,
  },
  navItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  navItemText: { fontSize: 13, fontWeight: '600', color: '#334155', flex: 1 },
  navItemTextActive: { color: SA_COLORS.green, fontWeight: '800' },
  tagPill: { backgroundColor: SA_COLORS.greenSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tagPillText: { color: SA_COLORS.green, fontSize: 10, fontWeight: '800' },
  pendingBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBadgeText: { color: '#DC2626', fontSize: 10, fontWeight: '900' },
  sidebarFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: SA_COLORS.slateSoft,
    backgroundColor: '#FAFCFB',
    gap: 10,
  },
  userFooterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  avatarSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: SA_COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmallImg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: SA_COLORS.green,
  },
  avatarSmallText: { color: SA_COLORS.white, fontSize: 12, fontWeight: '800' },
  userFooterName: { fontSize: 12, fontWeight: '800', color: SA_COLORS.text },
  userFooterLink: { fontSize: 11, fontWeight: '700', color: SA_COLORS.green },
  sidebarLogoutBtn: {
    borderWidth: 1,
    borderColor: SA_COLORS.dangerBorder,
    backgroundColor: SA_COLORS.white,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  sidebarLogoutText: { color: SA_COLORS.danger, fontSize: 12, fontWeight: '800' },
  mainCol: { flex: 1, backgroundColor: '#F4F7F6' },
  topHeader: {
    backgroundColor: SA_COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: SA_COLORS.border,
    paddingHorizontal: 20,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: SA_COLORS.text },
  headerSub: { fontSize: 12, color: SA_COLORS.muted, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: SA_COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  dateChipText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusChipText: { fontSize: 11, fontWeight: '800' },
  notifBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: SA_COLORS.border,
    backgroundColor: SA_COLORS.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  notifBtnText: { fontSize: 12, fontWeight: '700', color: SA_COLORS.text },
  notifCount: {
    backgroundColor: SA_COLORS.green,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifCountText: { color: SA_COLORS.white, fontSize: 10, fontWeight: '800' },
  headerProfilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  headerAvatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: SA_COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarImg: { width: 34, height: 34, borderRadius: 17 },
  headerProfileName: { fontSize: 12, fontWeight: '800', color: SA_COLORS.text },
  headerProfileRole: { fontSize: 10, fontWeight: '700', color: SA_COLORS.green },
  mobileNavStrip: {
    backgroundColor: SA_COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: SA_COLORS.border,
  },
  mobileNavContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  mobilePill: {
    backgroundColor: SA_COLORS.slateSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  mobilePillActive: { backgroundColor: SA_COLORS.green },
  mobilePillText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  mobilePillTextActive: { color: SA_COLORS.white, fontWeight: '700' },
  mobileMenuBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SA_COLORS.border,
    backgroundColor: SA_COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawerPanel: {
    height: '100%',
    backgroundColor: SA_COLORS.white,
    borderRightWidth: 1,
    borderRightColor: SA_COLORS.border,
    zIndex: 2,
  },
  drawerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SA_COLORS.slateSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentScroll: { flex: 1 },
  contentContainer: {
    paddingVertical: 18,
    maxWidth: 1340,
    width: '100%',
    alignSelf: 'center',
  },
  subTabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subTab: {
    backgroundColor: SA_COLORS.white,
    borderWidth: 1,
    borderColor: SA_COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  subTabActive: {
    backgroundColor: SA_COLORS.green,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  subTabText: { fontSize: 12, fontWeight: '700', color: SA_COLORS.text },
  subTabTextActive: { fontSize: 12, fontWeight: '800', color: SA_COLORS.white },
});
