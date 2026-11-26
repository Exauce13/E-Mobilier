import { Platform, useWindowDimensions } from 'react-native';

export interface ResponsiveMetrics {
  width: number;
  height: number;
  isSmallMobile: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isLaptop: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  isWide: boolean;
  isUltraWide: boolean;
  gridColumns: 1 | 2 | 3 | 4;
  twoColLayout: boolean;
  contentMaxWidth: number;
  horizontalPadding: number;
  getGridItemWidth: (columns: number, gap: number) => any;
}

/**
 * Calcule la largeur exacte d'un élément de grille multi-colonnes sans erreur d'arrondi ni débordement.
 * Sur Web, utilise CSS calc() afin que (columns * width + (columns - 1) * gap) === 100% exactement.
 */
export function computeGridItemWidth(columns: number, gap: number): any {
  if (columns <= 1) return '100%';
  if (Platform.OS === 'web') {
    const gapShare = ((columns - 1) * gap) / columns;
    return `calc(${100 / columns}% - ${gapShare.toFixed(2)}px)`;
  }
  const safePercent = Math.floor(((100 - (columns - 1) * 2.5) / columns) * 10) / 10;
  return `${safePercent}%`;
}

/**
 * Hook Mobile-First réactif aux résolutions :
 * 320 / 375 / 430 / 768 / 1024 / 1366 / 1440 / 1920 px.
 */
export function useResponsive(): ResponsiveMetrics {
  const { width, height } = useWindowDimensions();

  const isSmallMobile = width < 400;
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isLaptop = width >= 1024 && width < 1366;
  const isDesktop = width >= 1024;
  const isLargeDesktop = width >= 1366;
  const isWide = width >= 1440;
  const isUltraWide = width >= 1800;

  const gridColumns: 1 | 2 | 3 | 4 =
    width >= 1440 ? 4 : width >= 1024 ? 3 : width >= 640 ? 2 : 1;

  const twoColLayout = width >= 768;

  const contentMaxWidth = isUltraWide
    ? 1480
    : isWide
    ? 1360
    : isLargeDesktop
    ? 1240
    : isDesktop
    ? 1140
    : 960;

  const horizontalPadding = isUltraWide
    ? 40
    : isLargeDesktop
    ? 32
    : isTablet || isDesktop
    ? 24
    : isSmallMobile
    ? 12
    : 16;

  return {
    width,
    height,
    isSmallMobile,
    isMobile,
    isTablet,
    isLaptop,
    isDesktop,
    isLargeDesktop,
    isWide,
    isUltraWide,
    gridColumns,
    twoColLayout,
    contentMaxWidth,
    horizontalPadding,
    getGridItemWidth: computeGridItemWidth,
  };
}
