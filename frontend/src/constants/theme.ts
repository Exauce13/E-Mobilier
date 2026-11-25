/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0F172A',
    background: '#F8FAFC',
    backgroundElement: '#F1F5F9',
    backgroundSelected: '#E2E8F0',
    textSecondary: '#64748B',
    primary: '#008751', // Vert Feu Tricolore républicain franc
    primaryDark: '#005A36',
    primaryLight: '#E8F5E9',
    primaryBorder: '#10B981',
    gold: '#B45309',
    goldLight: '#FEF3C7',
    navy: '#0F172A',
    navyLight: '#1E293B',
    cardBackground: '#FFFFFF',
    cardBorder: '#E2E8F0',
    tagBackground: '#F1F5F9',
    tagText: '#334155',
    badgeGreenBg: '#ECFDF5',
    badgeGreenText: '#008751',
    badgeBlueBg: '#EFF6FF',
    badgeBlueText: '#1E40AF',
    badgeGoldBg: '#FEF3C7',
    badgeGoldText: '#92400E',
  },
  dark: {
    text: '#F8FAFC',
    background: '#0B0F19', // Midnight slate
    backgroundElement: '#151D2E',
    backgroundSelected: '#1E293B',
    textSecondary: '#94A3B8',
    primary: '#10B981',
    primaryDark: '#008751',
    primaryLight: '#064E3B',
    primaryBorder: '#34D399',
    gold: '#F59E0B',
    goldLight: '#451A03',
    navy: '#0B0F19',
    navyLight: '#1E293B',
    cardBackground: '#151D2E',
    cardBorder: '#223048',
    tagBackground: '#1E293B',
    tagText: '#E2E8F0',
    badgeGreenBg: '#052E16',
    badgeGreenText: '#86EFAC',
    badgeBlueBg: '#1E3A8A',
    badgeBlueText: '#BFDBFE',
    badgeGoldBg: '#451A03',
    badgeGoldText: '#FDE68A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
