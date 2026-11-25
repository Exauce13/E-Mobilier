import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PublishPropertyForm } from '@/components/publish/publish-property-form';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useTheme } from '@/hooks/use-theme';

export default function PublishAgentScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Publier un bien (Agent)"
        subtitle="Agent Immobilier Agréé • Tarif 100 F CFA"
      />
      <PublishPropertyForm mode="agent" bottomPadding={insets.bottom + 36} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
