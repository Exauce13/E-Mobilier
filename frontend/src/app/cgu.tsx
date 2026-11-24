import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { cguApi } from '@/services/api';
import type { LegalDocumentItem } from '@/types/api';

const FALLBACK_CGU = `CONDITIONS GÉNÉRALES D'UTILISATION — E-MOBILIER BÉNIN

1. Objet
E-Mobilier est une plateforme numérique de mise en relation immobilière, de vérification de titres fonciers et d'accompagnement aux visites en République du Bénin.

2. Vérification des biens et documents
Chaque annonce de vente (maison ou parcelle) doit comporter au moins un justificatif légal (Titre Foncier, Convention de vente, Permis d'habiter ou Attestation de recasement) soumis à la modération avant publication.

3. Tarification transparente
- Déblocage des coordonnées détaillées et pièces d'un bien : 50 F CFA (paiement unique).
- Visite physique encadrée par un conseiller terrain : 500 F CFA.
- Publication d'annonce : 500 F CFA (Client / Propriétaire) ou 100 F CFA (Agent Immobilier agréé).

4. Protection des données et anti-contournement
Les coordonnées saisies (Nom, Prénom, Téléphone, E-mail) sont exclusivement utilisées pour le suivi de vos demandes de visites, rendez-vous et accompagnement immobilier.`;

export default function CguScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { horizontalPadding } = useResponsive();
  const [doc, setDoc] = useState<LegalDocumentItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await cguApi.getCguCourante();
      if (res.success && res.data) setDoc(res.data);
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
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + 28 },
        ]}>
        <View style={styles.innerWrap}>
          {loading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
          ) : doc ? (
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
          ) : (
            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.title, { color: theme.text }]}>
                Conditions Générales d'Utilisation E-Mobilier
              </Text>
              <Text style={[styles.body, { color: theme.text }]}>{FALLBACK_CGU}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingTop: Spacing.three },
  innerWrap: { width: '100%', maxWidth: 860, alignSelf: 'center' },
  card: { borderRadius: 18, borderWidth: 1, padding: Spacing.four, gap: 10 },
  title: { fontSize: 19, fontWeight: '900' },
  meta: { fontSize: 12, fontWeight: '600' },
  hash: { fontSize: 11, fontFamily: 'monospace' },
  body: { fontSize: 14, lineHeight: 22, marginTop: 6 },
});
