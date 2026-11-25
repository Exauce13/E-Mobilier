import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AgentsKycSection,
  DemasquagesSection,
  GovernanceSection,
  TechHealthSection,
} from '@/components/admin/admin-gov-sections';
import {
  DemandesMatchingSection,
  VisitesOpsSection,
} from '@/components/admin/admin-ops-sections';
import {
  SA_COLORS,
  SuperAdminDashboardSection,
  SuperAdminFinanceSection,
  SuperAdminLogsSection,
  SuperAdminPageKey,
  SuperAdminPostsSection,
  SuperAdminProfileSection,
  SuperAdminSettingsSection,
} from '@/components/super-admin/super-admin-sections';
import { useAuth } from '@/context/auth-context';

const PAGE_META: Record<SuperAdminPageKey, { title: string; subtitle: string }> = {
  dashboard: { title: 'Tableau de bord', subtitle: 'Vue globale des opérations et de la trésorerie' },
  finance: { title: 'Coffre-Fort & Retraits', subtitle: 'Trésorerie, Grand Livre HMAC, retraits OTP & coupe-circuit' },
  moderation: { title: 'Posts Clients & Agents Immobiliers', subtitle: 'Toutes les annonces publiées et en attente de modération' },
  visites: { title: 'Visites & Demandes', subtitle: 'Assignation par zone, visites terrain et matching recherches' },
  demasquages: { title: 'Démasquages TTL', subtitle: 'Arbitrage anti-contournement des accès aux coordonnées' },
  equipe: { title: 'Équipe, KYC & Zones', subtitle: 'Gestion des rôles RBAC, agrément agents et zones du Bénin' },
  logs: { title: 'Journalisation Globale', subtitle: 'Audit chronologique complet de toute la plateforme E-Mobilier' },
  parametres: { title: 'Paramètres & Tarifs', subtitle: 'Tarifs officiels, contacts publics, TTL sécurité et bénéficiaire' },
  securite: { title: 'CGU & Santé Système', subtitle: 'Documents légaux, webhooks et santé infrastructure' },
  profil: { title: 'Mon Profil Super Admin', subtitle: 'Photo de profil, informations personnelles et sécurité 2FA' },
};

const NAV_GROUPS: Array<{
  section: string;
  items: Array<{ key: SuperAdminPageKey; label: string; tag?: string }>;
}> = [
  {
    section: 'PILOTAGE',
    items: [
      { key: 'dashboard', label: 'Tableau de bord' },
      { key: 'finance', label: 'Coffre-Fort & Retraits', tag: 'Exclusif' },
    ],
  },
  {
    section: 'OPÉRATIONS',
    items: [
      { key: 'moderation', label: 'Posts Clients & Agents' },
      { key: 'visites', label: 'Visites & Demandes' },
      { key: 'demasquages', label: 'Démasquages TTL' },
    ],
  },
  {
    section: 'GOUVERNANCE & AUDIT',
    items: [
      { key: 'equipe', label: 'Équipe, KYC & Zones' },
      { key: 'logs', label: 'Journalisation Globale' },
      { key: 'parametres', label: 'Paramètres & Tarifs' },
      { key: 'securite', label: 'CGU & Santé Système' },
    ],
  },
];

export function SuperAdminPrincipalPortal({
  initialPage = 'dashboard',
}: {
  initialPage?: SuperAdminPageKey;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width >= 900;

  const { user, unreadNotificationsCount, isFinancialOwner, logout } = useAuth();
  const safeInitialPage: SuperAdminPageKey =
    initialPage === 'finance' && !isFinancialOwner ? 'dashboard' : initialPage;
  const [activePage, setActivePage] = useState<SuperAdminPageKey>(safeInitialPage);
  const [visitesSubTab, setVisitesSubTab] = useState<'visites' | 'demandes'>('visites');
  const [equipeSubTab, setEquipeSubTab] = useState<'governance' | 'kyc'>('governance');

  const meta = PAGE_META[activePage];
  const initials = (user?.name || 'JM')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const noopCharte = () => {};

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
              <View style={{ flex: 1 }}>
                <Text style={styles.brandTitle}>E-Mobilier</Text>
                <Text style={styles.brandRole}>Super Admin Principal</Text>
              </View>
            </View>

            <ScrollView style={styles.navScroll} contentContainerStyle={{ padding: 12, gap: 4 }}>
              {NAV_GROUPS.map((group) => (
                <View key={group.section} style={{ marginBottom: 10 }}>
                  <Text style={styles.navSectionTitle}>{group.section}</Text>
                  {group.items
                    .filter((item) => item.key !== 'finance' || isFinancialOwner)
                    .map((item) => {
                      const active = activePage === item.key;
                      return (
                        <Pressable
                          key={item.key}
                          onPress={() => setActivePage(item.key)}
                          style={[styles.navItem, active && styles.navItemActive]}>
                          <Text style={[styles.navItemText, active && styles.navItemTextActive]}>
                            {item.label}
                          </Text>
                          {item.tag && (
                            <View style={styles.tagPill}>
                              <Text style={styles.tagPillText}>{item.tag}</Text>
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                </View>
              ))}
            </ScrollView>

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
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.userFooterName}>
                    {user?.name || 'Super Admin'}
                  </Text>
                  <Text numberOfLines={1} style={styles.userFooterLink}>
                    Mon profil &amp; photo
                  </Text>
                </View>
              </Pressable>

              <Pressable onPress={() => void logout()} style={styles.sidebarLogoutBtn}>
                <Text style={styles.sidebarLogoutText}>Se déconnecter</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Main Column */}
        <View style={styles.mainCol}>
          {/* Top Header */}
          <View style={styles.topHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={styles.headerTitle}>
                {meta.title}
              </Text>
              <Text numberOfLines={1} style={styles.headerSub}>
                {meta.subtitle}
              </Text>
            </View>

            <View style={styles.headerRight}>
              {isDesktop && (
                <View style={styles.statusChip}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusChipText}>Système opérationnel</Text>
                </View>
              )}

              <Pressable
                onPress={() => router.push('/notifications' as any)}
                style={styles.notifBtn}>
                <Text style={styles.notifBtnText}>Notifs</Text>
                {unreadNotificationsCount > 0 && (
                  <View style={styles.notifCount}>
                    <Text style={styles.notifCountText}>{unreadNotificationsCount}</Text>
                  </View>
                )}
              </Pressable>

              <Pressable onPress={() => setActivePage('profil')} style={styles.headerAvatarWrap}>
                {user?.photo_url ? (
                  <Image source={{ uri: user.photo_url }} style={styles.headerAvatarImg} contentFit="cover" />
                ) : (
                  <View style={styles.headerAvatarCircle}>
                    <Text style={styles.avatarSmallText}>{initials}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>

          {/* Mobile Horizontal Nav */}
          {!isDesktop && (
            <View style={styles.mobileNavStrip}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mobileNavContent}>
                {[
                  { key: 'dashboard', label: 'Accueil' },
                  ...(isFinancialOwner ? [{ key: 'finance', label: 'Coffre-Fort' }] : []),
                  { key: 'moderation', label: 'Posts' },
                  { key: 'visites', label: 'Visites' },
                  { key: 'demasquages', label: 'TTL' },
                  { key: 'equipe', label: 'Équipe & KYC' },
                  { key: 'logs', label: 'Journalisation' },
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
              { paddingBottom: Math.max(insets.bottom, 24) + 24 },
            ]}
            showsVerticalScrollIndicator={false}>
            {activePage === 'dashboard' && <SuperAdminDashboardSection onNavigate={setActivePage} />}
            {activePage === 'finance' && isFinancialOwner && <SuperAdminFinanceSection />}
            {activePage === 'moderation' && <SuperAdminPostsSection />}

            {activePage === 'visites' && (
              <View style={{ gap: 14 }}>
                <View style={styles.subTabRow}>
                  <Pressable
                    onPress={() => setVisitesSubTab('visites')}
                    style={visitesSubTab === 'visites' ? styles.subTabActive : styles.subTab}>
                    <Text style={visitesSubTab === 'visites' ? styles.subTabTextActive : styles.subTabText}>
                      Visites physiques
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setVisitesSubTab('demandes')}
                    style={visitesSubTab === 'demandes' ? styles.subTabActive : styles.subTab}>
                    <Text style={visitesSubTab === 'demandes' ? styles.subTabTextActive : styles.subTabText}>
                      Demandes de recherche &amp; Matching
                    </Text>
                  </Pressable>
                </View>
                {visitesSubTab === 'visites' ? (
                  <VisitesOpsSection onCharteRequired={noopCharte} />
                ) : (
                  <DemandesMatchingSection onCharteRequired={noopCharte} />
                )}
              </View>
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
  shell: { flex: 1, flexDirection: 'column', backgroundColor: SA_COLORS.bg },
  shellDesktop: { flexDirection: 'row' },
  sidebar: {
    width: 260,
    backgroundColor: SA_COLORS.white,
    borderRightWidth: 1,
    borderRightColor: SA_COLORS.border,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 18,
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
    letterSpacing: 0.8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  navItemActive: { backgroundColor: SA_COLORS.greenSoft },
  navItemText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  navItemTextActive: { color: SA_COLORS.green, fontWeight: '800' },
  tagPill: { backgroundColor: SA_COLORS.greenSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tagPillText: { color: SA_COLORS.green, fontSize: 10, fontWeight: '800' },
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
  mainCol: { flex: 1, backgroundColor: SA_COLORS.bg },
  topHeader: {
    backgroundColor: SA_COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: SA_COLORS.border,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '900', color: SA_COLORS.text },
  headerSub: { fontSize: 12, color: SA_COLORS.muted, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SA_COLORS.greenSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: SA_COLORS.green },
  statusChipText: { color: SA_COLORS.green, fontSize: 11, fontWeight: '700' },
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
  headerAvatarWrap: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden' },
  headerAvatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: SA_COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarImg: { width: 34, height: 34, borderRadius: 17 },
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
  contentScroll: { flex: 1 },
  contentContainer: {
    padding: 16,
    maxWidth: 1120,
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
