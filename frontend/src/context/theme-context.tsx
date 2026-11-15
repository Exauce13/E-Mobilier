import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'e_mobilier_theme_mode';

interface ThemeModeContextValue {
  colorScheme: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const ThemeModeContext = createContext<ThemeModeContextValue>({
  colorScheme: 'light',
  isDark: false,
  setThemeMode: async () => {},
  toggleTheme: async () => {},
});

/**
 * Fournit le thème actif de l'application (Mode Clair par défaut),
 * avec persistance locale via AsyncStorage indépendamment du thème système.
 */
export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [colorScheme, setColorScheme] = useState<ThemeMode>('light');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (!active) return;
        if (saved === 'dark' || saved === 'light') {
          setColorScheme(saved);
        }
      })
      .catch(() => {
        // Fallback sécurisé sur le mode clair
      });
    return () => {
      active = false;
    };
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setColorScheme(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Ignore storage failure
    }
  }, []);

  const toggleTheme = useCallback(async () => {
    const next: ThemeMode = colorScheme === 'dark' ? 'light' : 'dark';
    await setThemeMode(next);
  }, [colorScheme, setThemeMode]);

  return (
    <ThemeModeContext.Provider
      value={{
        colorScheme,
        isDark: colorScheme === 'dark',
        setThemeMode,
        toggleTheme,
      }}>
      {children}
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode(): ThemeModeContextValue {
  return useContext(ThemeModeContext);
}
