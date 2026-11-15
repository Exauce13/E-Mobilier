import { useThemeMode } from '@/context/theme-context';

export function useColorScheme() {
  return useThemeMode().colorScheme;
}
