import { router } from 'expo-router';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Briefcase, Building2, Calendar, Home, PlusCircle, Search } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const { isAuthenticated, isSuperAdminPrincipal, isAgentMobilier } = useAuth();
  const { isMobile, isSmallMobile } = useResponsive();

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />

      {!isSuperAdminPrincipal && (
        <TabList asChild>
          <CustomTabList isMobile={isMobile} isSmallMobile={isSmallMobile}>
            <TabTrigger name="home" href="/" asChild>
              <TabButton compact={isMobile} ultraCompact={isSmallMobile} icon="home">
                Accueil
              </TabButton>
            </TabTrigger>

            <TabTrigger name="explore" href="/explore" asChild>
              <TabButton compact={isMobile} ultraCompact={isSmallMobile} icon="search">
                Recherche
              </TabButton>
            </TabTrigger>

            <TabTrigger name="publish" href="/publish" asChild>
              <TabButton compact={isMobile} ultraCompact={isSmallMobile} icon="publish">
                Publier
              </TabButton>
            </TabTrigger>

            {isAuthenticated && isAgentMobilier ? (
              <TabTrigger name="agent-space" href="/agent-space" asChild>
                <TabButton compact={isMobile} ultraCompact={isSmallMobile} icon="agent">
                  {isMobile ? 'Agent' : 'Espace Agent'}
                </TabButton>
              </TabTrigger>
            ) : isAuthenticated ? (
              <TabTrigger name="visits" href="/visits" asChild>
                <TabButton compact={isMobile} ultraCompact={isSmallMobile} icon="visits">
                  Visites
                </TabButton>
              </TabTrigger>
            ) : null}
          </CustomTabList>
        </TabList>
      )}
    </Tabs>
  );
}

type TabIconKey = 'home' | 'search' | 'publish' | 'visits' | 'agent';

export function TabButton({
  children,
  isFocused,
  compact,
  ultraCompact,
  icon,
  ...props
}: TabTriggerSlotProps & { compact?: boolean; ultraCompact?: boolean; icon?: TabIconKey }) {
  const theme = useTheme();
  const iconColor = isFocused ? '#FFFFFF' : '#CBD5E1';
  const iconSize = ultraCompact ? 16 : compact ? 17 : 16;

  const renderIcon = () => {
    switch (icon) {
      case 'home':
        return <Home size={iconSize} color={iconColor} strokeWidth={2.1} />;
      case 'search':
        return <Search size={iconSize} color={iconColor} strokeWidth={2.1} />;
      case 'publish':
        return <PlusCircle size={iconSize} color={iconColor} strokeWidth={2.1} />;
      case 'visits':
        return <Calendar size={iconSize} color={iconColor} strokeWidth={2.1} />;
      case 'agent':
        return <Briefcase size={iconSize} color={iconColor} strokeWidth={2.1} />;
      default:
        return null;
    }
  };

  return (
    <Pressable
      {...(props as any)}
      style={({ pressed }) => [
        compact && styles.tabPressableMobile,
        pressed && styles.pressed,
      ]}>
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
            ultraCompact && styles.tabButtonTextUltraCompact,
            {
              color: iconColor,
              fontWeight: isFocused ? '700' : '600',
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
  isSmallMobile,
  children,
  ...props
}: TabListProps & { isMobile: boolean; isSmallMobile: boolean }) {
  const theme = useTheme();

  return (
    <View
      {...props}
      style={[
        styles.tabListContainer,
        isMobile && styles.tabListContainerMobile,
        isSmallMobile && { paddingHorizontal: 6, bottom: 8 },
      ]}>
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
    maxWidth: 760,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  innerContainerMobile: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 20,
    justifyContent: 'center',
    gap: 0,
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
    justifyContent: 'space-between',
    gap: 4,
  },
  tabPressableMobile: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.78,
  },
  tabButtonView: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  tabButtonCompact: {
    flexDirection: 'column',
    minHeight: 48,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 14,
    gap: 3,
  },
  tabButtonText: {
    fontSize: 13,
  },
  tabButtonTextCompact: {
    fontSize: 11,
  },
  tabButtonTextUltraCompact: {
    fontSize: 10,
  },
});
