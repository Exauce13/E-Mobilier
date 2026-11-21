/**
 * E-Mobilier Bénin Design System Tokens
 * Conforme à la maquette officielle Google Stitch (Projet 2386687948358093437)
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Surfaces & Backgrounds
    background: '#F8F9FF',
    surface: '#F8F9FF',
    surfaceDim: '#CBDBF5',
    surfaceBright: '#F8F9FF',
    surfaceContainerLowest: '#FFFFFF',
    surfaceContainerLow: '#EFF4FF',
    surfaceContainer: '#E5EEFF',
    surfaceContainerHigh: '#DCE9FF',
    surfaceContainerHighest: '#D3E4FE',
    backgroundElement: '#EFF4FF',
    backgroundSelected: '#E5EEFF',
    cardBackground: '#FFFFFF',
    cardBorder: '#E2E8F0',
    outline: '#6E7977',
    outlineVariant: '#BDC9C6',

    // Typography
    text: '#0B1C30',
    onSurface: '#0B1C30',
    textSecondary: '#3E4947',
    onSurfaceVariant: '#3E4947',
    inverseSurface: '#213145',
    inverseOnSurface: '#EAF1FF',

    // Primary: Vert Feu Tricolore (#008751)
    primary: '#008751',
    primaryContainer: '#008751',
    primaryDark: '#005A36',
    primaryLight: '#86EFAC',
    primaryBorder: '#10B981',
    primaryFixed: '#D1FAE5',
    primaryFixedDim: '#A7F3D0',
    onPrimary: '#FFFFFF',
    onPrimaryContainer: '#FFFFFF',

    // Secondary: Bleu Nuit Institutionnel (#565E74 & #0F172A)
    secondary: '#565E74',
    secondaryContainer: '#DAE2FD',
    navy: '#0F172A',
    navyLight: '#1E293B',
    onSecondary: '#FFFFFF',

    // Tertiary / Gold: Or Foncier & Certification Notariale (#735C00 & #D4AF37)
    tertiary: '#735C00',
    tertiaryContainer: '#CCA830',
    tertiaryFixed: '#FFE088',
    tertiaryFixedDim: '#E9C349',
    gold: '#D4AF37',
    goldDark: '#B45309',
    goldLight: '#FFFBEB',
    onTertiary: '#FFFFFF',

    // Status / Badges
    tagBackground: '#EFF4FF',
    tagText: '#0B1C30',
    badgeGreenBg: '#DCFCE7',
    badgeGreenText: '#008751',
    badgeBlueBg: '#EFF6FF',
    badgeBlueText: '#1E40AF',
    badgeGoldBg: '#FEF3C7',
    badgeGoldText: '#92400E',
    error: '#BA1A1A',
    errorContainer: '#FFDAD6',
    success: '#008751',
    successBg: '#DCFCE7',
  },
  dark: {
    // Surfaces & Backgrounds
    background: '#0B1C30',
    surface: '#111F33',
    surfaceDim: '#19273D',
    surfaceBright: '#1A2A42',
    surfaceContainerLowest: '#152238',
    surfaceContainerLow: '#1A2A42',
    surfaceContainer: '#20324E',
    surfaceContainerHigh: '#273C5C',
    surfaceContainerHighest: '#30476C',
    backgroundElement: '#1A2A42',
    backgroundSelected: '#20324E',
    cardBackground: '#152238',
    cardBorder: '#273C5C',
    outline: '#889593',
    outlineVariant: '#3E4947',

    // Typography
    text: '#EAF1FF',
    onSurface: '#EAF1FF',
    textSecondary: '#BDC9C6',
    onSurfaceVariant: '#BDC9C6',
    inverseSurface: '#F8F9FF',
    inverseOnSurface: '#0B1C30',

    // Primary: Vert Feu Tricolore
    primary: '#10B981',
    primaryContainer: '#008751',
    primaryDark: '#005A36',
    primaryLight: '#86EFAC',
    primaryBorder: '#10B981',
    primaryFixed: '#D1FAE5',
    primaryFixedDim: '#A7F3D0',
    onPrimary: '#002012',
    onPrimaryContainer: '#D1FAE5',

    // Secondary
    secondary: '#BEC6E0',
    secondaryContainer: '#2C3549',
    navy: '#0B1C30',
    navyLight: '#152238',
    onSecondary: '#131B2E',

    // Tertiary / Gold
    tertiary: '#FFE088',
    tertiaryContainer: '#CCA830',
    tertiaryFixed: '#FFE088',
    tertiaryFixedDim: '#E9C349',
    gold: '#FFE088',
    goldDark: '#CCA830',
    goldLight: '#3A2E05',
    onTertiary: '#241A00',

    // Status
    tagBackground: '#20324E',
    tagText: '#EAF1FF',
    badgeGreenBg: '#052E16',
    badgeGreenText: '#86EFAC',
    badgeBlueBg: '#1E3A8A',
    badgeBlueText: '#BFDBFE',
    badgeGoldBg: '#451A03',
    badgeGoldText: '#FDE68A',
    error: '#FFB4AB',
    errorContainer: '#93000A',
    success: '#10B981',
    successBg: '#052E16',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'PlusJakartaSans-Bold',
    body: 'Inter-Regular',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    body: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    body: 'var(--font-body)',
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

export const Rounded = {
  sm: 4,
  default: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
