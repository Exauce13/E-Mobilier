import { Slot } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useThemeMode } from '@/context/theme-context';

export default function AppTabs() {
  const { colorScheme } = useThemeMode();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { isAuthenticated, isSuperAdminPrincipal, isAgentMobilier } = useAuth();

  if (isAuthenticated && isSuperAdminPrincipal) {
    return <Slot />;
  }

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Accueil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Recherche</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="publish">
        <NativeTabs.Trigger.Label>Publier</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      {isAuthenticated && isAgentMobilier ? (
        <NativeTabs.Trigger name="agent-space">
          <NativeTabs.Trigger.Label>Espace Agent</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            src={require('@/assets/images/tabIcons/explore.png')}
            renderingMode="template"
          />
        </NativeTabs.Trigger>
      ) : isAuthenticated ? (
        <NativeTabs.Trigger name="client-space">
          <NativeTabs.Trigger.Label>Espace Client</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            src={require('@/assets/images/tabIcons/home.png')}
            renderingMode="template"
          />
        </NativeTabs.Trigger>
      ) : null}
    </NativeTabs>
  );
}
