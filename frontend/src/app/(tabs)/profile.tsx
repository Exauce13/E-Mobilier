import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useThemeMode } from '@/context/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const { isDark, toggleTheme } = useThemeMode();
  const insets = useSafeAreaInsets();
  const { horizontalPadding } = useResponsive();
  const {
    user,
    isAuthenticated,
    logout,
    unreadNotificationsCount,
    isAdminStaff,
    isSuperAdminPrincipal,
    isAgentMobilier,
    openAuthModal,
  } = useAuth();

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.guestContent,
            {
              paddingHorizontal: horizontalPadding,
              paddingBottom: BottomTabInset + insets.bottom + 84,
            },
          ]}>
          <View style={styles.guestWrap}>
            <View style={[styles.guestAvatar, { backgroundColor: theme.primaryLight }]}>
              <SymbolView
                name={{ ios: 'person.crop.circle', android: 'person', web: 'person' }}
                size={54}
                tintColor={theme.primary}
              />
            </View>
            <Text style={[styles.guestTitle, { color: theme.text }]}>Espace Personnel E-Mobilier</Text>
            <Text style={[styles.guestSub, { color: theme.textSecondary }]}>
              Connectez-vous ou accédez directement à nos espaces Client, Agent Immobilier et Formulaire Client.
            </Text>

            <View style={styles.guestBtns}>
              <Pressable
                onPress={() => openAuthModal('login')}
                style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
                <Text style={styles.primaryBtnText}>Se connecter</Text>
              </Pressable>
              <Pressable
                onPress={() => openAuthModal('register')}
                style={[
                  styles.secondaryBtn,
                  { borderColor: theme.primary, backgroundColor: theme.cardBackground },
                ]}>
                <Text style={[styles.secondaryBtnText, { color: theme.primary }]}>
                  Créer un compte
                </Text>
              </Pressable>

              <View style={[styles.menuCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder, marginTop: 8 }]}>
                <MenuRow
                  icon="👤"
                  title="Espace Client"
                  subtitle="Suivez vos favoris, demandes et projets immobiliers"
                  onPress={() => router.push('/client' as any)}
                  theme={theme}
                />
                <MenuRow
                  icon="🏢"
                  title="Espace Agent Immobilier"
                  subtitle="Tableau de bord professionnel et gestion des biens"
                  onPress={() => router.push('/agent' as any)}
                  theme={theme}
                />
                <MenuRow
                  icon="📝"
                  title="Formulaire Client"
                  subtitle="Décrivez votre besoin pour être accompagné"
                  onPress={() => router.push('/client-form' as any)}
                  theme={theme}
                />
                <MenuRow
                  icon="⚖️"
                  title="Conditions Générales d'Utilisation"
                  subtitle="Consulter la charte légale officielle"
                  onPress={() => router.push('/cgu' as any)}
                  theme={theme}
                  last
                />
              </View>

              <View
                style={[
                  styles.themeCard,
                  { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                ]}>
                <Text style={styles.menuIcon}>{isDark ? '🌙' : '☀️'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuTitle, { color: theme.text }]}>
                    {isDark ? 'Mode Sombre' : 'Mode Clair'}
                  </Text>
                  <Text style={[styles.menuSub, { color: theme.textSecondary }]}>
                    Apparence de l'application
                  </Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={() => {
                    void toggleTheme();
                  }}
                  trackColor={{ false: '#CBD5E1', true: theme.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: BottomTabInset + insets.bottom + 84,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.innerWrap}>
          {/* Identity Card */}
          <View style={[styles.profileHeaderCard, { backgroundColor: theme.navy }]}>
            <View style={styles.profileTopRow}>
              <View style={[styles.avatarCircle, { backgroundColor: '#F59E0B' }]}>
                <Text style={styles.avatarInitials}>
                  {user.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userPhone}>🇧🇯 {user.phone}</Text>
                {user.email ? <Text style={styles.userEmail}>{user.email}</Text> : null}
              </View>
            </View>

            <View style={styles.rolesWrap}>
              {(user.roles.length > 0
                ? user.roles
                : [isAgentMobilier ? 'Agent mobilier' : 'Client']
              ).map((r) => (
                <View key={r} style={styles.rolePill}>
                  <Text style={styles.rolePillText}>{r}</Text>
                </View>
              ))}
              <View
                style={[
                  styles.rolePill,
                  { backgroundColor: user.is_verifed ? '#065F46' : '#78350F' },
                ]}>
                <Text style={styles.rolePillText}>
                  {user.is_verifed ? '✓ Compte vérifié' : '⏳ Vérification en attente'}
                </Text>
              </View>
            </View>
          </View>

          {/* Primary Workspace Cards (Client & Agent) */}
          <View style={styles.spacesRow}>
            <Pressable
              onPress={() => router.push('/client' as any)}
              style={[
                styles.workspaceCard,
                { backgroundColor: theme.cardBackground, borderColor: theme.primary },
              ]}>
              <Text style={styles.workspaceEmoji}>👤</Text>
              <Text style={[styles.workspaceTitle, { color: theme.text }]}>Espace Client</Text>
              <Text style={[styles.workspaceSub, { color: theme.textSecondary }]}>
                Visites, recherches, favoris & annonces
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/agent' as any)}
              style={[
                styles.workspaceCard,
                { backgroundColor: theme.navyLight, borderColor: '#F59E0B' },
              ]}>
              <Text style={styles.workspaceEmoji}>🏢</Text>
              <Text style={[styles.workspaceTitle, { color: '#FFFFFF' }]}>Tableau Agent</Text>
              <Text style={[styles.workspaceSub, { color: '#CBD5E1' }]}>
                Biens, demandes reçues & prospects
              </Text>
            </Pressable>
          </View>

          {/* Admin & Finance Cards */}
          {isAdminStaff && (
            <Pressable
              onPress={() => router.push('/admin' as any)}
              style={[styles.specialCard, { backgroundColor: theme.navyLight, borderColor: '#F59E0B' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.specialTitle, { color: '#FDE68A' }]}>
                  Espace Administration & Gouvernance
                </Text>
                <Text style={styles.specialSub}>
                  Modération catalogue, visites terrain, matching demandes, démasquages TTL, zones, KYC & diagnostic tech.
                </Text>
              </View>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={20}
                tintColor="#FFFFFF"
              />
            </Pressable>
          )}

          {isSuperAdminPrincipal && (
            <Pressable
              onPress={() => router.push('/finance' as any)}
              style={[styles.specialCard, { backgroundColor: '#1E1B4B', borderColor: '#F59E0B' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.specialTitle, { color: '#FDE68A' }]}>
                  Coffre-Fort Financier & Retraits OTP
                </Text>
                <Text style={styles.specialSub}>
                  Trésorerie temps réel, Grand Livre HMAC, retraits sécurisés par OTP & coupe-circuit.
                </Text>
              </View>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={20}
                tintColor="#FFFFFF"
              />
            </Pressable>
          )}

          {/* Theme Mode Toggle */}
          <View style={[styles.menuCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.menuRow}>
              <Text style={styles.menuIcon}>{isDark ? '🌙' : '☀️'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuTitle, { color: theme.text }]}>
                  {isDark ? 'Mode Sombre activé' : 'Mode Clair activé'}
                </Text>
                <Text style={[styles.menuSub, { color: theme.textSecondary }]}>
                  Basculer entre l'affichage clair et sombre
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={() => {
                  void toggleTheme();
                }}
                trackColor={{ false: '#CBD5E1', true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Menu Shortcuts */}
          <View style={[styles.menuCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <MenuRow
              icon="📝"
              title="Formulaire Client"
              subtitle="Soumettre un besoin ou demander un accompagnement"
              onPress={() => router.push('/client-form' as any)}
              theme={theme}
            />
            <MenuRow
              icon="➕"
              title={isAgentMobilier ? 'Publier un bien (Agent — 100 F)' : 'Publier un bien (Client — 500 F)'}
              subtitle="Déposer une nouvelle annonce avec photos et justificatifs"
              onPress={() => router.push((isAgentMobilier ? '/publish-agent' : '/publish-client') as any)}
              theme={theme}
            />
            <MenuRow
              icon="🏠"
              title="Mes annonces immobilières"
              subtitle="Modifier ou retirer mes biens publiés"
              onPress={() => router.push('/my-properties' as any)}
              theme={theme}
            />
            <MenuRow
              icon="🔎"
              title="Mes demandes de recherche"
              subtitle="Créer et suivre mes recherches personnalisées"
              onPress={() => router.push('/search-requests' as any)}
              theme={theme}
            />
            <MenuRow
              icon="🔔"
              title="Notifications & Alertes"
              subtitle="Statuts de validation, visites et opportunités"
              badgeCount={unreadNotificationsCount}
              onPress={() => router.push('/notifications' as any)}
              theme={theme}
            />
            <MenuRow
              icon="🧾"
              title="Quittances & Paiements Kkiapay"
              subtitle="Vérifier une transaction et télécharger un reçu"
              onPress={() => router.push('/transactions' as any)}
              theme={theme}
            />
            <MenuRow
              icon="⚖️"
              title="Conditions Générales d'Utilisation"
              subtitle="Consulter la charte légale officielle"
              onPress={() => router.push('/cgu' as any)}
              theme={theme}
              last
            />
          </View>

          <Pressable
            onPress={logout}
            style={[styles.logoutBtn, { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]}>
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  badgeCount,
  onPress,
  theme,
  last,
}: {
  icon: string;
  title: string;
  subtitle: string;
  badgeCount?: number;
  onPress: () => void;
  theme: any;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        !last && { borderBottomWidth: 1, borderBottomColor: theme.cardBorder },
        pressed && { opacity: 0.7 },
      ]}>
      <Text style={styles.menuIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.menuSub, { color: theme.textSecondary }]}>{subtitle}</Text>
      </View>
      {badgeCount && badgeCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeCount}</Text>
        </View>
      ) : null}
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        size={16}
        tintColor={theme.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingTop: Spacing.three },
  innerWrap: { width: '100%', maxWidth: 820, alignSelf: 'center', gap: Spacing.three },
  profileHeaderCard: { borderRadius: 22, padding: Spacing.four, gap: Spacing.three },
  profileTopRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarCircle: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#0F172A', fontSize: 20, fontWeight: '900' },
  userName: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  userPhone: { color: '#CBD5E1', fontSize: 13, marginTop: 2 },
  userEmail: { color: '#94A3B8', fontSize: 12, marginTop: 1 },
  rolesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rolePill: { backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  rolePillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  spacesRow: { flexDirection: 'row', gap: 12 },
  workspaceCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    gap: 4,
  },
  workspaceEmoji: { fontSize: 24, marginBottom: 2 },
  workspaceTitle: { fontSize: 16, fontWeight: '900' },
  workspaceSub: { fontSize: 12, lineHeight: 17 },
  specialCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  specialTitle: { fontSize: 15, fontWeight: '900' },
  specialSub: { color: '#E2E8F0', fontSize: 12, marginTop: 3, lineHeight: 17 },
  menuCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  themeCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, gap: 12 },
  menuIcon: { fontSize: 20 },
  menuTitle: { fontSize: 15, fontWeight: '700' },
  menuSub: { fontSize: 12, marginTop: 1 },
  badge: {
    backgroundColor: '#EF4444',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  logoutBtn: { borderRadius: 14, borderWidth: 1, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: '#DC2626', fontSize: 15, fontWeight: '800' },
  guestContent: { flexGrow: 1, justifyContent: 'center', paddingTop: Spacing.five },
  guestWrap: { width: '100%', maxWidth: 560, alignSelf: 'center', alignItems: 'center', gap: 12 },
  guestAvatar: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center' },
  guestTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  guestSub: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  guestBtns: { width: '100%', gap: 10, marginTop: 6 },
  primaryBtn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryBtn: { borderRadius: 14, borderWidth: 1.5, paddingVertical: 14, alignItems: 'center' },
  secondaryBtnText: { fontSize: 15, fontWeight: '700' },
});
