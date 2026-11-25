import { Lock } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SuperAdminPrincipalPortal } from '@/components/super-admin/super-admin-portal';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';

export default function FinanceVaultScreen() {
  const { isFinancialOwner } = useAuth();
  const theme = useTheme();

  if (isFinancialOwner) {
    return <SuperAdminPrincipalPortal initialPage="finance" />;
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Coffre-Fort Financier" subtitle="Accès restreint" />
      <View style={styles.deniedBox}>
        <Lock size={34} color={theme.primary} strokeWidth={2.2} />
        <Text style={[styles.deniedTitle, { color: theme.text }]}>
          Accès strictement réservé au propriétaire financier
        </Text>
        <Text style={[styles.deniedSub, { color: theme.textSecondary }]}>
          La trésorerie, le Grand Livre comptable, les webhooks financiers et les retraits OTP sont
          exclusivement accessibles au compte de M. Justin MAGNIDE.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  deniedBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  deniedTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  deniedSub: { fontSize: 13, textAlign: 'center', maxWidth: 420, lineHeight: 20 },
});
