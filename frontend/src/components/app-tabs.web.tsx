import { router } from 'expo-router';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Building2, Calendar, Home, PlusCircle, Search } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const { isAuthenticated } = useAuth();
  const { isMobile } = useResponsive();

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />

      <TabList asChild>
        <CustomTabList isMobile={isMobile}>
          <TabTrigger name="home" href="/" asChild>
            <TabButton compact={isMobile} icon="home">
              Accueil
            </TabButton>
          </TabTrigger>

          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton compact={isMobile} icon="search">
              Recherche
            </TabButton>
          </TabTrigger>

          <TabTrigger name="publish" href="/publish" asChild>
            <TabButton compact={isMobile} icon="publish">
              Publier
            </TabButton>
          </TabTrigger>

          {isAuthenticated && (
            <TabTrigger name="visits" href="/visits" asChild>
              <TabButton compact={isMobile} icon="visits">
                Visites
              </TabButton>
            </TabTrigger>
          )}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

type TabIconKey = 'home' | 'search' | 'publish' | 'visits';

export function TabButton({
  children,
  isFocused,
  compact,
  icon,
  ...props
}: TabTriggerSlotProps & { compact?: boolean; icon?: TabIconKey }) {
  const theme = useTheme();
  const iconColor = isFocused ? '#FFFFFF' : '#CBD5E1';
  const iconSize = compact ? 15 : 16;

  const renderIcon = () => {
    switch (icon) {
      case 'home':
        return <Home size={iconSize} color={iconColor} strokeWidth={2} />;
      case 'search':
        return <Search size={iconSize} color={iconColor} strokeWidth={2} />;
      case 'publish':
        return <PlusCircle size={iconSize} color={iconColor} strokeWidth={2} />;
      case 'visits':
        return <Calendar size={iconSize} color={iconColor} strokeWidth={2} />;
      default:
        return null;
    }
  };

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
        {renderIcon()}
        <Text
          numberOfLines={1}
          style={[
            styles.tabButtonText,
            compact && styles.tabButtonTextCompact,
            {
              color: iconColor,
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
  children,
  ...props
}: TabListProps & { isMobile: boolean }) {
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
            <View style={styles.brandIconWrap}>
              <Building2 size={15} color="#F59E0B" strokeWidth={2.2} />
            </View>
            <Text style={[styles.brandText, { color: '#F59E0B' }]}>E-Mobilier</Text>
            <View style={styles.countryPill}>
              <Text style={styles.countryPillText}>BJ</Text>
            </View>
          </Pressable>
        )}

        <View style={[styles.tabsRow, isMobile && styles.tabsRowMobile]}>{children}</View>
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
    gap: 16,
    maxWidth: 740,
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
    gap: 7,
    flexShrink: 0,
  },
  brandIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  countryPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  countryPillText: {
    color: '#FDE68A',
    fontSize: 10,
    fontWeight: '800',
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  tabsRowMobile: {
    width: '100%',
    justifyContent: 'space-around',
    gap: 2,
  },
  pressed: {
    opacity: 0.78,
  },
  tabButtonView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  tabButtonCompact: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 14,
    gap: 4,
  },
  tabButtonText: {
    fontSize: 13,
  },
  tabButtonTextCompact: {
    fontSize: 12,
  },
});
