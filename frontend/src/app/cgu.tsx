import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { cguApi } from '@/services/api';
import type { LegalDocumentItem } from '@/types/api';

export default function CguScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [doc, setDoc] = useState<LegalDocumentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await cguApi.getCguCourante();
      if (res.success && res.data) setDoc(res.data);
      else setErrorMsg(res.message || 'Document indisponible.');
      setLoading(false);
    };
    void load();
  }, []);

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Conditions Générales"
        subtitle={doc ? `Version ${doc.version}` : 'Conformité légale E-Mobilier'}
      />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
        ) : errorMsg || !doc ? (
          <Text style={{ color: '#DC2626', textAlign: 'center', marginTop: 40 }}>{errorMsg}</Text>
        ) : (
          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.title, { color: theme.text }]}>{doc.titre}</Text>
            <Text style={[styles.meta, { color: theme.textSecondary }]}>
              Version {doc.version} • Publiée le {new Date(doc.published_at).toLocaleDateString('fr-FR')}
            </Text>
            <Text style={[styles.hash, { color: theme.textSecondary }]}>
              Empreinte SHA-256 : {doc.hash_contenu.slice(0, 24)}...
            </Text>
            <Text style={[styles.body, { color: theme.text }]}>{doc.contenu}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.three },
  card: { borderRadius: 18, borderWidth: 1, padding: Spacing.four, gap: 10 },
  title: { fontSize: 18, fontWeight: '900' },
  meta: { fontSize: 12, fontWeight: '600' },
  hash: { fontSize: 11, fontFamily: 'monospace' },
  body: { fontSize: 14, lineHeight: 22, marginTop: 8 },
});
