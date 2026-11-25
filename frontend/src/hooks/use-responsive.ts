import { useWindowDimensions } from 'react-native';

export interface ResponsiveMetrics {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWide: boolean;
  gridColumns: 1 | 2 | 3;
  twoColLayout: boolean;
  contentMaxWidth: number;
  horizontalPadding: number;
}

/**
 * Hook réactif aux changements de taille d'écran (mobile, tablette, desktop).
 */
export function useResponsive(): ResponsiveMetrics {
  const { width, height } = useWindowDimensions();

  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1100;
  const isDesktop = width >= 1100;
  const isWide = width >= 1320;

  const gridColumns: 1 | 2 | 3 = isDesktop ? 3 : isTablet ? 2 : 1;
  const twoColLayout = width >= 768;
  const contentMaxWidth = isWide ? 1280 : isDesktop ? 1160 : 960;
  const horizontalPadding = isDesktop ? 32 : isTablet ? 24 : 16;

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
    isWide,
    gridColumns,
    twoColLayout,
    contentMaxWidth,
    horizontalPadding,
  };
}
