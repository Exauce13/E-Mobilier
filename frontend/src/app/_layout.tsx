import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Platform } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

if (Platform.OS === 'web') {
  require('@/global.css');
}
import { AuthModal } from '@/components/auth/auth-modal';
import { AuthProvider } from '@/context/auth-context';
import { PlatformConfigProvider } from '@/context/platform-config-context';
import { ThemeModeProvider, useThemeMode } from '@/context/theme-context';

SplashScreen.preventAutoHideAsync();

function RootNavigationShell() {
  const { isDark } = useThemeMode();

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="property/[id]" />
        <Stack.Screen name="client" />
        <Stack.Screen name="client-form" />
        <Stack.Screen name="agent" />
        <Stack.Screen name="publish-client" />
        <Stack.Screen name="publish-agent" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="my-properties" />
        <Stack.Screen name="search-requests" />
        <Stack.Screen name="transactions" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="cgu" />
        <Stack.Screen name="admin/index" />
        <Stack.Screen name="finance/index" />
      </Stack>
      <AuthModal />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeModeProvider>
      <PlatformConfigProvider>
        <AuthProvider>
          <RootNavigationShell />
        </AuthProvider>
      </PlatformConfigProvider>
    </ThemeModeProvider>
  );
}
