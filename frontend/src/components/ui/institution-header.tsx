import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';

interface InstitutionHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export function InstitutionHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
}: InstitutionHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, unreadNotificationsCount, openAuthModal } = useAuth();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/' as any);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 12),
          backgroundColor: theme.surfaceContainerLowest,
          borderBottomColor: theme.cardBorder,
        },
      ]}>
      <View style={styles.contentRow}>
        {showBack ? (
          <View style={styles.backRow}>
            <Pressable
              onPress={handleBack}
              hitSlop={12}
              style={[styles.backBtn, { backgroundColor: theme.surfaceContainerLow }]}>
              <SymbolView
                name={{ ios: 'chevron.backward', android: 'arrow_back', web: 'arrow_back' }}
                size={18}
                tintColor={theme.text}
              />
            </Pressable>
            <View style={styles.titleWrap}>
              <Text numberOfLines={1} style={[styles.screenTitle, { color: theme.text }]}>
                {title || 'Détail'}
              </Text>
              {subtitle ? (
                <Text numberOfLines={1} style={[styles.screenSubtitle, { color: theme.textSecondary }]}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <Pressable onPress={() => router.push('/' as any)} style={styles.brandRow}>
            <View style={[styles.logoIcon, { backgroundColor: theme.primaryContainer }]}>
              <SymbolView
                name={{ ios: 'building.2.fill', android: 'apartment', web: 'apartment' }}
                size={18}
                tintColor="#FFFFFF"
              />
            </View>
            <View style={styles.brandTextWrap}>
              <View style={styles.brandTitleRow}>
                <Text style={[styles.brandTitle, { color: theme.text }]}>E-Mobilier</Text>
                <View style={[styles.bjBadge, { backgroundColor: theme.tertiaryFixed }]}>
                  <Text style={[styles.bjText, { color: '#241A00' }]}>BJ</Text>
                </View>
              </View>
              <Text style={[styles.certText, { color: theme.primaryContainer }]}>SÉCURISÉ ARCEP</Text>
            </View>
          </Pressable>
        )}

        <View style={styles.rightActionsRow}>
          {rightAction ? (
            rightAction
          ) : (
            <>
              {/* Trust Tag */}
              <View
                style={[
                  styles.certPill,
                  {
                    backgroundColor: theme.surfaceContainerLow,
                    borderColor: theme.cardBorder,
                  },
                ]}>
                <SymbolView
                  name={{ ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' }}
                  size={13}
                  tintColor={theme.primaryContainer}
                />
                <Text style={[styles.certPillText, { color: theme.textSecondary }]}>Titre Certifié</Text>
              </View>

              {/* Notification Bell */}
              <Pressable
                onPress={() => {
                  if (isAuthenticated) {
                    router.push('/notifications' as any);
                  } else {
                    openAuthModal('login');
                  }
                }}
                hitSlop={8}
                style={[styles.actionBtn, { backgroundColor: theme.surfaceContainerLow }]}>
                <SymbolView
                  name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
                  size={18}
                  tintColor={theme.text}
                />
                {unreadNotificationsCount > 0 && (
                  <View style={[styles.notifBadge, { backgroundColor: theme.error }]}>
                    <Text style={styles.notifBadgeText}>
                      {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                    </Text>
                  </View>
                )}
              </Pressable>

              {/* User Avatar */}
              <Pressable
                onPress={() => {
                  if (isAuthenticated) {
                    router.push('/profile' as any);
                  } else {
                    openAuthModal('login');
                  }
                }}
                hitSlop={8}
                style={styles.avatarWrap}>
                <Image
                  source={{
                    uri:
                      user?.photo_url ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
                  }}
                  style={[styles.avatar, { borderColor: theme.primaryBorder }]}
                />
                <View
                  style={[
                    styles.onlineDot,
                    {
                      backgroundColor: isAuthenticated ? theme.primaryContainer : theme.outlineVariant,
                      borderColor: theme.surfaceContainerLowest,
                    },
                  ]}
                />
              </Pressable>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderBottomWidth: 1,
    zIndex: 40,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two + 2,
    minHeight: 52,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
    minWidth: 0,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  screenTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  screenSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  logoIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTextWrap: {
    flexDirection: 'column',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  bjBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  bjText: {
    fontSize: 9,
    fontWeight: '800',
  },
  certText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  certPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    display: Platform.OS === 'web' ? 'flex' : 'none',
  },
  certPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
});
