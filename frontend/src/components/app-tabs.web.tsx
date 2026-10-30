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

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const { isAuthenticated, user } = useAuth();

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />

      {/* La barre de navigation web n'est affichée QUE lorsque l'utilisateur est connecté */}
      {isAuthenticated && (
        <TabList asChild>
          <CustomTabList>
            <TabTrigger name="home" href="/" asChild>
              <TabButton>Catalogue</TabButton>
            </TabTrigger>

            <TabTrigger name="explore" href="/explore" asChild>
              <TabButton>Recherche</TabButton>
            </TabTrigger>

            {user?.role === 'agent_immobilier' && (
              <TabTrigger name="publish" href="/publish" asChild>
                <TabButton>Publier</TabButton>
              </TabTrigger>
            )}

            {user?.role === 'agent_immobilier' && (
              <TabTrigger name="visits" href="/visits" asChild>
                <TabButton>Visites</TabButton>
              </TabTrigger>
            )}

            <TabTrigger name="profile" href="/profile" asChild>
              <TabButton>Mon Profil</TabButton>
            </TabTrigger>
          </CustomTabList>
        </TabList>
      )}
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();

  return (
    <Pressable {...(props as any)} style={({ pressed }) => pressed && styles.pressed}>
      <View
        style={[
          styles.tabButtonView,
          {
            backgroundColor: isFocused ? theme.primary : 'transparent',
          },
        ]}>
        <Text
          style={[
            styles.tabButtonText,
            {
              color: isFocused ? '#FFFFFF' : theme.textSecondary,
              fontWeight: isFocused ? '700' : '500',
            },
          ]}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const theme = useTheme();

  return (
    <View {...props} style={styles.tabListContainer}>
      <View
        style={[
          styles.innerContainer,
          {
            backgroundColor: theme.navyLight,
            borderColor: theme.cardBorder,
          },
        ]}>
        <View style={styles.brandRow}>
          <Text style={[styles.brandText, { color: theme.gold }]}>E-Mobilier</Text>
          <View style={styles.flagBadge}>
            <Text style={styles.flagText}>🇧🇯</Text>
          </View>
        </View>

        <View style={styles.tabsRow}>{props.children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    width: '100%',
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    pointerEvents: 'box-none',
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
    maxWidth: MaxContentWidth,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  flagBadge: {
    paddingHorizontal: 4,
  },
  flagText: {
    fontSize: 12,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pressed: {
    opacity: 0.75,
  },
  tabButtonView: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  tabButtonText: {
    fontSize: 13,
  },
});
