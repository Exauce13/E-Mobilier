import { router } from 'expo-router';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const { isAuthenticated, isAgentMobilier } = useAuth();
  const { isMobile } = useResponsive();

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />

      <TabList asChild>
        <CustomTabList isMobile={isMobile} isAuthenticated={isAuthenticated} isAgent={isAgentMobilier}>
          <TabTrigger name="home" href="/" asChild>
            <TabButton compact={isMobile}>{isAuthenticated ? 'Accueil' : 'Accueil'}</TabButton>
          </TabTrigger>

          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton compact={isMobile}>Recherche</TabButton>
          </TabTrigger>

          <TabTrigger name="publish" href="/publish" asChild>
            <TabButton compact={isMobile}>Publier</TabButton>
          </TabTrigger>

          {isAuthenticated && (
            <TabTrigger name="visits" href="/visits" asChild>
              <TabButton compact={isMobile}>Visites</TabButton>
            </TabTrigger>
          )}

          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton compact={isMobile}>
              {isAuthenticated ? (isAgentMobilier ? 'Agent' : 'Client') : 'Compte'}
            </TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({
  children,
  isFocused,
  compact,
  ...props
}: TabTriggerSlotProps & { compact?: boolean }) {
  const theme = useTheme();

  return (
    <Pressable {...(props as any)} style={({ pressed }) => pressed && styles.pressed}>
      <View
        style={[
          styles.tabButtonView,
          compact && styles.tabButtonCompact,
          {
            backgroundColor: isFocused ? theme.primary : 'transparent',
          },
        ]}>
        <Text
          numberOfLines={1}
          style={[
            styles.tabButtonText,
            compact && styles.tabButtonTextCompact,
            {
              color: isFocused ? '#FFFFFF' : '#CBD5E1',
              fontWeight: isFocused ? '700' : '500',
            },
          ]}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

export function CustomTabList({
  isMobile,
  isAuthenticated,
  isAgent,
  children,
  ...props
}: TabListProps & { isMobile: boolean; isAuthenticated: boolean; isAgent: boolean }) {
  const theme = useTheme();

  return (
    <View {...props} style={[styles.tabListContainer, isMobile && styles.tabListContainerMobile]}>
      <View
        style={[
          styles.innerContainer,
          isMobile && styles.innerContainerMobile,
          {
            backgroundColor: theme.navy,
            borderColor: 'rgba(255,255,255,0.12)',
          },
        ]}>
        {!isMobile && (
          <Pressable onPress={() => router.push('/' as any)} style={styles.brandRow}>
            <Text style={[styles.brandText, { color: '#F59E0B' }]}>E-Mobilier</Text>
            <Text style={styles.flagText}>🇧🇯</Text>
          </Pressable>
        )}

        <View style={[styles.tabsRow, isMobile && styles.tabsRowMobile]}>{children}</View>

        {!isMobile && (
          <View style={styles.quickSpaceRow}>
            <Pressable
              onPress={() => router.push((isAgent ? '/agent' : '/client') as any)}
              style={[styles.spaceChip, { backgroundColor: 'rgba(20, 184, 166, 0.18)', borderColor: 'rgba(20, 184, 166, 0.45)' }]}>
              <Text style={styles.spaceChipText}>
                {isAgent ? 'Espace Agent' : 'Espace Client'}
              </Text>
            </Pressable>
            {!isAuthenticated && (
              <Pressable
                onPress={() => router.push('/agent' as any)}
                style={[styles.spaceChip, { backgroundColor: 'rgba(245, 158, 11, 0.16)', borderColor: 'rgba(245, 158, 11, 0.4)' }]}>
                <Text style={[styles.spaceChipText, { color: '#FDE68A' }]}>Agent</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    width: '100%',
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    pointerEvents: 'box-none',
    zIndex: 40,
  },
  tabListContainerMobile: {
    bottom: 10,
    paddingHorizontal: 10,
  },
  innerContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    maxWidth: 960,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  innerContainerMobile: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 20,
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  brandText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  flagText: {
    fontSize: 12,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  tabsRowMobile: {
    width: '100%',
    justifyContent: 'space-around',
    gap: 2,
  },
  quickSpaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  spaceChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  spaceChipText: {
    color: '#99F6E4',
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
  },
  tabButtonView: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 16,
  },
  tabButtonCompact: {
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 14,
  },
  tabButtonText: {
    fontSize: 13,
  },
  tabButtonTextCompact: {
    fontSize: 12,
  },
});
