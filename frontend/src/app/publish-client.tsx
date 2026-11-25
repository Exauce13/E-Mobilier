import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PublishPropertyForm } from '@/components/publish/publish-property-form';
import { ScreenHeader } from '@/components/ui/screen-header';
import { usePlatformConfig } from '@/context/platform-config-context';
import { useTheme } from '@/hooks/use-theme';
import { formatFcfa } from '@/types/property';

export default function PublishClientScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { tarifs } = usePlatformConfig();

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Publier un bien (Client)"
        subtitle={
          tarifs
            ? `Particulier / Propriétaire • ${formatFcfa(tarifs.post_client)}`
            : 'Particulier / Propriétaire'
        }
      />
      <PublishPropertyForm mode="client" bottomPadding={insets.bottom + 36} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
