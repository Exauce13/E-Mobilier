import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthModal } from '@/components/auth/auth-modal';
import { AuthProvider } from '@/context/auth-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="property/[id]" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="my-properties" />
          <Stack.Screen name="search-requests" />
          <Stack.Screen name="transactions" />
          <Stack.Screen name="cgu" />
          <Stack.Screen name="admin/index" />
          <Stack.Screen name="finance/index" />
        </Stack>
        <AuthModal />
      </ThemeProvider>
    </AuthProvider>
  );
}
