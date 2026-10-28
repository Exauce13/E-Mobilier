import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, logout, openLogin, openRegister } = useAuth();

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

  const handleLogout = () => {
    logout();
    router.replace('/' as any);
  };

  // 1. Authenticated User Dashboard
  if (isAuthenticated && user) {
    return (
      <SafeAreaView
        edges={['top']}
        style={[styles.container, { backgroundColor: theme.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.dashboardContent,
            { paddingBottom: BottomTabInset + Spacing.five + insets.bottom },
          ]}>
          
          {/* Header */}
          <View style={styles.dashboardHeader}>
            <View style={[styles.avatarCircle, { backgroundColor: theme.primaryLight }]}>
              <SymbolView
                name={{ ios: 'person.crop.circle.fill', android: 'person', web: 'person' }}
                size={60}
                tintColor={theme.primary}
              />
            </View>
            <Text style={[styles.userName, { color: theme.text }]}>{user.name}</Text>
            <Text style={[styles.userPhone, { color: theme.textSecondary }]}>
              🇧🇯 {user.phone}
            </Text>

            {/* Role Badge */}
            <View
              style={[
                styles.roleBadge,
                {
                  backgroundColor:
                    user.role === 'agent_immobilier'
                      ? theme.badgeBlueBg
                      : theme.badgeGreenBg,
                },
              ]}>
              <Text
                style={[
                  styles.roleBadgeText,
                  {
                    color:
                      user.role === 'agent_immobilier'
                        ? theme.badgeBlueText
                        : theme.badgeGreenText,
                  },
                ]}>
                {user.role === 'agent_immobilier'
                  ? '🏢 Agent Immobilier Certifié'
                  : '🏡 Client / Propriétaire'}
              </Text>
            </View>
          </View>

          {/* Balance Card (Mobile Money Benin) */}
          <View
            style={[
              styles.cardBox,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Solde Portefeuille</Text>
              <Text style={[styles.networkBadge, { color: theme.primary }]}>MTN / Moov</Text>
            </View>
            <Text style={[styles.balanceValue, { color: theme.primaryDark }]}>
              {user.balanceFifa.toLocaleString()} F CFA
            </Text>
            <Text style={[styles.balanceHelp, { color: theme.textSecondary }]}>
              Disponible pour les frais de consultation et la publication de biens.
            </Text>
          </View>

          {/* Services Menu */}
          <View
            style={[
              styles.cardBox,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}>
            <Text style={[styles.cardTitle, { color: theme.text, marginBottom: Spacing.two }]}>
              Services & Préférences
            </Text>

            <Pressable style={styles.menuItem}>
              <SymbolView
                name={{ ios: 'house.fill', android: 'home', web: 'home' }}
                size={20}
                tintColor={theme.primary}
              />
              <Text style={[styles.menuItemText, { color: theme.text }]}>
                Mes annonces immobilières
              </Text>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={16}
                tintColor={theme.textSecondary}
              />
            </Pressable>

            <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />

            <Pressable style={styles.menuItem}>
              <SymbolView
                name={{ ios: 'lock.open.fill', android: 'lock_open', web: 'lock_open' }}
                size={20}
                tintColor={theme.primary}
              />
              <Text style={[styles.menuItemText, { color: theme.text }]}>
                Coordonnées propriétaires débloquées
              </Text>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={16}
                tintColor={theme.textSecondary}
              />
            </Pressable>

            <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />

            <Pressable style={styles.menuItem}>
              <SymbolView
                name={{ ios: 'creditcard.fill', android: 'payment', web: 'payment' }}
                size={20}
                tintColor={theme.primary}
              />
              <Text style={[styles.menuItemText, { color: theme.text }]}>
                Historique des transactions Mobile Money
              </Text>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={16}
                tintColor={theme.textSecondary}
              />
            </Pressable>
          </View>

          {/* Logout */}
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.logoutButton,
              {
                backgroundColor: theme.cardBackground,
                borderColor: '#FCA5A5',
              },
              pressed && { opacity: 0.8 },
            ]}>
            <SymbolView
              name={{ ios: 'arrow.right.square', android: 'logout', web: 'logout' }}
              size={18}
              tintColor="#DC2626"
            />
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </Pressable>

        </ScrollView>
      </SafeAreaView>
    );
  }

  // 2. Unauthenticated (Guest) Profile Screen
  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.guestContent,
          { paddingBottom: BottomTabInset + Spacing.six + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}>
        
        {/* Welcome Avatar / Icon */}
        <View style={[styles.guestAvatarCircle, { backgroundColor: theme.primaryLight }]}>
          <SymbolView
            name={{ ios: 'person.crop.circle', android: 'person', web: 'person' }}
            size={56}
            tintColor={theme.primary}
          />
        </View>

        <Text style={[styles.guestTitle, { color: theme.text }]}>
          Espace Personnel E-Mobilier
        </Text>
        <Text style={[styles.guestSubtitle, { color: theme.textSecondary }]}>
          Connectez-vous ou créez votre compte pour gérer vos annonces, enregistrer vos favoris et contacter directement les propriétaires au Bénin.
        </Text>

        {/* Action Buttons to separate pages */}
        <View style={styles.guestActions}>
          <Pressable
            onPress={handleOpenLogin}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: theme.primary },
              pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
            ]}>
            <SymbolView
              name={{ ios: 'arrow.right.circle.fill', android: 'login', web: 'login' }}
              size={18}
              tintColor="#FFFFFF"
            />
            <Text style={styles.primaryBtnText}>Se connecter</Text>
          </Pressable>

          <Pressable
            onPress={handleOpenRegister}
            style={({ pressed }) => [
              styles.secondaryBtn,
              {
                borderColor: theme.primary,
                backgroundColor: theme.cardBackground,
              },
              pressed && { opacity: 0.85 },
            ]}>
            <SymbolView
              name={{ ios: 'person.badge.plus', android: 'person_add', web: 'person_add' }}
              size={18}
              tintColor={theme.primary}
            />
            <Text style={[styles.secondaryBtnText, { color: theme.primary }]}>
              Créer un compte
            </Text>
          </Pressable>
        </View>

        {/* Benefits list */}
        <View
          style={[
            styles.benefitsCard,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.cardBorder,
            },
          ]}>
          <Text style={[styles.benefitsTitle, { color: theme.text }]}>
            Pourquoi rejoindre E-Mobilier Bénin ?
          </Text>

          <View style={styles.benefitRow}>
            <View style={[styles.benefitIconBox, { backgroundColor: theme.primaryLight }]}>
              <Text style={{ fontSize: 16 }}>🇧🇯</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.benefitItemTitle, { color: theme.text }]}>
                Paiement Mobile Money Sécurisé
              </Text>
              <Text style={[styles.benefitItemDesc, { color: theme.textSecondary }]}>
                Rechargez votre compte via MTN Money ou Moov Flooz en toute simplicité.
              </Text>
            </View>
          </View>

          <View style={styles.benefitRow}>
            <View style={[styles.benefitIconBox, { backgroundColor: theme.primaryLight }]}>
              <SymbolView
                name={{ ios: 'lock.open.fill', android: 'lock_open', web: 'lock_open' }}
                size={18}
                tintColor={theme.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.benefitItemTitle, { color: theme.text }]}>
                Accès direct aux propriétaires
              </Text>
              <Text style={[styles.benefitItemDesc, { color: theme.textSecondary }]}>
                Débloquez les contacts réels et visitez les biens sans intermédiaire inutile.
              </Text>
            </View>
          </View>

          <View style={styles.benefitRow}>
            <View style={[styles.benefitIconBox, { backgroundColor: theme.primaryLight }]}>
              <SymbolView
                name={{ ios: 'house.fill', android: 'home', web: 'home' }}
                size={18}
                tintColor={theme.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.benefitItemTitle, { color: theme.text }]}>
                Publication d'annonces
              </Text>
              <Text style={[styles.benefitItemDesc, { color: theme.textSecondary }]}>
                Publiez vos chambres, maisons ou parcelles à Cotonou, Calavi et partout au Bénin.
              </Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  guestContent: {
    padding: Spacing.four,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    paddingTop: Spacing.five,
  },
  guestAvatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  guestTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  guestSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: Spacing.five,
    paddingHorizontal: Spacing.two,
  },
  guestActions: {
    width: '100%',
    gap: Spacing.three,
    marginBottom: Spacing.five,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  benefitsCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  benefitIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  benefitItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  benefitItemDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  dashboardContent: {
    padding: Spacing.four,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  dashboardHeader: {
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  avatarCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  userPhone: {
    fontSize: 14,
    marginBottom: Spacing.two,
  },
  roleBadge: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 5,
    borderRadius: 20,
  },
  roleBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  cardBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
    marginBottom: Spacing.three,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  networkBadge: {
    fontSize: 12,
    fontWeight: '700',
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '800',
    marginVertical: Spacing.one,
  },
  balanceHelp: {
    fontSize: 13,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
  },
});
