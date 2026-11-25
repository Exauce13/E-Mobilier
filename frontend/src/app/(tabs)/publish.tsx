import { PlusCircle } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PublishPropertyForm } from '@/components/publish/publish-property-form';
import { BottomTabInset } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

export default function PublishScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { horizontalPadding } = useResponsive();
  const { isAgentMobilier } = useAuth();

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.headerWrap,
          {
            paddingHorizontal: horizontalPadding,
            backgroundColor: theme.cardBackground,
            borderBottomColor: theme.cardBorder,
          },
        ]}>
        <View style={styles.headerInner}>
          <View style={[styles.iconBox, { backgroundColor: theme.primaryLight }]}>
            <PlusCircle size={20} color={theme.primary} strokeWidth={2.2} />
          </View>
          <View style={styles.titleCol}>
            <Text style={[styles.title, { color: theme.text }]}>Publier une annonce</Text>
            <Text style={[styles.sub, { color: theme.textSecondary }]}>
              Choisissez Louer ou Vendre, ajoutez photos, vidéos et justificatifs
            </Text>
          </View>
        </View>
      </View>

      <PublishPropertyForm
        mode={isAgentMobilier ? 'agent' : 'client'}
        bottomPadding={BottomTabInset + insets.bottom + 84}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrap: {
    borderBottomWidth: 1,
    paddingVertical: 14,
  },
  headerInner: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: { flex: 1 },
  title: { fontSize: 19, fontWeight: '900' },
  sub: { fontSize: 12, marginTop: 1 },
});
