import * as WebBrowser from 'expo-web-browser';
import { FileText } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { VisitesDemandesWorkspace } from '@/components/admin/visites-demandes-workspace';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { adminApi, getStorageBaseUrl } from '@/services/api';
import type {
  BackendProperty,
  OperationalMetricsData,
  PropertyDocumentItem,
  ZonePerformanceData,
  ZoneSummary,
} from '@/types/api';
import { formatFcfa, resolveStorageUrl } from '@/types/property';
import { showMessage } from '@/utils/dialog';

type CharteErrorHandler = (msg?: string) => void;

export function MetricsSection({ onCharteRequired }: { onCharteRequired: CharteErrorHandler }) {
  const theme = useTheme();
  const { hasAnyRole } = useAuth();
  const canGlobal = hasAnyRole(['Super Admin Principal', 'Secrétaire', 'Admin']);

  const [globalMetrics, setGlobalMetrics] = useState<OperationalMetricsData | null>(null);
  const [zoneMetrics, setZoneMetrics] = useState<ZonePerformanceData | null>(null);
  const [zones, setZones] = useState<ZoneSummary[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const zRes = await adminApi.getZones();
    if (zRes.success && Array.isArray(zRes.data)) {
      setZones(zRes.data);
    }

    if (canGlobal) {
      const gRes = await adminApi.getOperationsGlobales();
      if (gRes.statusCode === 403 && gRes.message?.toLowerCase().includes('charte')) {
        onCharteRequired(gRes.message);
        setLoading(false);
        return;
      }
      if (gRes.success) {
        setGlobalMetrics(gRes as unknown as OperationalMetricsData);
      }
    }

    const zpRes = await adminApi.getZonePerformance(selectedZoneId);
    if (zpRes.statusCode === 403 && zpRes.message?.toLowerCase().includes('charte')) {
      onCharteRequired(zpRes.message);
    } else if (zpRes.success) {
      setZoneMetrics(zpRes as unknown as ZonePerformanceData);
    }
    setLoading(false);
  }, [canGlobal, selectedZoneId, onCharteRequired]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />;

  return (
    <View style={styles.sectionWrap}>
      {globalMetrics?.indicateurs_visites_terrain && (
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Performance Globale ({globalMetrics.periode?.mois})
          </Text>
          <Text style={[styles.line, { color: theme.text }]}>
            Visites mois : {globalMetrics.indicateurs_visites_terrain.visites_effectuees}/
            {globalMetrics.indicateurs_visites_terrain.total_visites} (
            {globalMetrics.indicateurs_visites_terrain.taux_completion_pourcentage}%)
          </Text>
          <Text style={[styles.line, { color: theme.text }]}>
            Demandes satisfaites : {globalMetrics.indicateurs_demandes_recherche?.demandes_satisfaites}/
            {globalMetrics.indicateurs_demandes_recherche?.total_demandes} (
            {globalMetrics.indicateurs_demandes_recherche?.taux_transformation_pourcentage}%)
          </Text>
          <Text style={[styles.line, { color: theme.textSecondary }]}>
            Catalogue : {globalMetrics.catalogue_immobilier?.annonces_en_ligne} en ligne •{' '}
            {globalMetrics.catalogue_immobilier?.annonces_en_attente_moderation} en attente •{' '}
            {globalMetrics.catalogue_immobilier?.biens_vendus_ou_loues_ce_mois} conclus ce mois
          </Text>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Performance Sectorielle par Zone</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {zones.map((z) => (
            <Pressable
              key={z.id}
              onPress={() => setSelectedZoneId(z.id)}
              style={[
                styles.chip,
                { backgroundColor: selectedZoneId === z.id ? theme.primary : theme.backgroundElement },
              ]}>
              <Text style={{ color: selectedZoneId === z.id ? '#FFF' : theme.text, fontSize: 12, fontWeight: '700' }}>
                {z.nom}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        {zoneMetrics?.zone && (
          <View style={{ gap: 4, marginTop: 6 }}>
            <Text style={[styles.line, { color: theme.primaryDark, fontWeight: '800' }]}>
              {zoneMetrics.zone.nom} ({zoneMetrics.zone.code})
            </Text>
            {Object.entries(zoneMetrics.performance_operationnelle || {}).map(([k, v]) => (
              <Text key={k} style={[styles.line, { color: theme.textSecondary }]}>
                {k.replace(/_/g, ' ')} : {v}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export function ModerationSection({ onCharteRequired }: { onCharteRequired: CharteErrorHandler }) {
  const theme = useTheme();
  const { hasAnyRole } = useAuth();
  const canModerateCatalog = hasAnyRole([
    'Super Admin Principal',
    'Super Admin Technique',
    'Secrétaire',
    'Admin',
  ]);
  const storageBaseUrl = useMemo(() => getStorageBaseUrl(), []);
  const [items, setItems] = useState<BackendProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);
  const [rejectMotif, setRejectMotif] = useState('');
  const [concluIdInput, setConcluIdInput] = useState('');
  const [docsModalItems, setDocsModalItems] = useState<PropertyDocumentItem[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminApi.getProprietesEnAttente();
    if (res.statusCode === 403 && res.message?.toLowerCase().includes('charte')) {
      onCharteRequired(res.message);
    } else if (res.success && Array.isArray(res.data)) {
      setItems(res.data);
    }
    setLoading(false);
  }, [onCharteRequired]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleValidate = async (id: number) => {
    const res = await adminApi.validerPropriete(id);
    if (res.success) {
      showMessage('Validé', res.message || 'Bien publié.');
      await load();
    } else {
      showMessage('Erreur', res.message || 'Action impossible.');
    }
  };

  const handleReject = async () => {
    if (!rejectTargetId || rejectMotif.trim().length < 5) {
      showMessage('Motif requis', 'Saisissez au moins 5 caractères.');
      return;
    }
    const res = await adminApi.rejeterPropriete(rejectTargetId, rejectMotif.trim());
    if (res.success) {
      setRejectTargetId(null);
      setRejectMotif('');
      await load();
    } else {
      showMessage('Erreur', res.message || 'Action impossible.');
    }
  };

  const handleViewDocs = async (id: number) => {
    const res = await adminApi.getProprieteDocuments(id);
    if (res.success) {
      setDocsModalItems((res as any).documents || res.data || []);
    } else {
      showMessage('Erreur', res.message || 'Impossible de consulter les documents.');
    }
  };

  const handleMarquerConclu = async () => {
    const propId = Number(concluIdInput);
    if (!propId) return;
    const res = await adminApi.marquerProprieteConclue(propId);
    showMessage(res.success ? 'Conclu' : 'Erreur', res.message || '');
    if (res.success) setConcluIdInput('');
  };

  return (
    <View style={styles.sectionWrap}>
      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Marquer un bien conclu (Vendu / Loué)</Text>
        <View style={styles.inlineRow}>
          <TextInput
            style={[styles.inputFlex, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
            placeholder="ID du bien"
            keyboardType="numeric"
            value={concluIdInput}
            onChangeText={setConcluIdInput}
          />
          <Pressable onPress={handleMarquerConclu} style={[styles.smallBtn, { backgroundColor: theme.navy }]}>
            <Text style={styles.smallBtnText}>Clôturer</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
      ) : items.length === 0 ? (
        <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 20 }}>
          Aucune annonce en attente de modération.
        </Text>
      ) : (
        items.map((prop) => (
          <View key={prop.id} style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              #{prop.id} — {prop.type.toUpperCase()} ({prop.transaction_type}) • {prop.commune}
            </Text>
            <Text style={[styles.line, { color: theme.primaryDark, fontWeight: '800' }]}>
              {formatFcfa(prop.prix)} • {prop.surface} m²
            </Text>
            <Text style={[styles.line, { color: theme.textSecondary }]}>
              Statut : {prop.status} • Par {prop.user?.name || `User #${prop.user_id}`}
            </Text>

            {canModerateCatalog && (
              <View style={styles.actionsRow}>
                <Pressable onPress={() => handleViewDocs(prop.id)} style={[styles.actBtn, { backgroundColor: theme.backgroundElement }]}>
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>Documents</Text>
                </Pressable>
                <Pressable onPress={() => handleValidate(prop.id)} style={[styles.actBtn, { backgroundColor: theme.primary }]}>
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 12 }}>Valider</Text>
                </Pressable>
                <Pressable onPress={() => setRejectTargetId(prop.id)} style={[styles.actBtn, { backgroundColor: '#EF4444' }]}>
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 12 }}>Rejeter</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))
      )}

      <Modal visible={Boolean(rejectTargetId)} transparent animationType="fade" onRequestClose={() => setRejectTargetId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Motif de rejet (#{rejectTargetId})</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
              placeholder="Motif détaillé..."
              value={rejectMotif}
              onChangeText={setRejectMotif}
              multiline
            />
            <Pressable onPress={handleReject} style={[styles.primaryBtn, { backgroundColor: '#EF4444' }]}>
              <Text style={styles.primaryBtnText}>Confirmer le rejet</Text>
            </Pressable>
            <Pressable onPress={() => setRejectTargetId(null)} style={styles.cancelLink}>
              <Text style={{ color: theme.textSecondary }}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(docsModalItems)} transparent animationType="fade" onRequestClose={() => setDocsModalItems(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Documents du bien</Text>
            {(docsModalItems || []).length === 0 ? (
              <Text style={{ color: theme.textSecondary }}>Aucun document joint.</Text>
            ) : (
              (docsModalItems || []).map((doc) => {
                const url = resolveStorageUrl(doc.url_consultation || doc.document_url, storageBaseUrl);
                return (
                  <Pressable
                    key={doc.id}
                    onPress={() => url && WebBrowser.openBrowserAsync(url)}
                    style={[styles.docRow, { borderColor: theme.cardBorder }]}>
                    <FileText size={15} color={theme.primary} strokeWidth={2} />
                    <Text style={{ color: theme.text, flex: 1, fontSize: 13 }}>
                      {doc.type || doc.document_type} — {doc.nom || ''}
                    </Text>
                    <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 12 }}>Ouvrir</Text>
                  </Pressable>
                );
              })
            )}
            <Pressable onPress={() => setDocsModalItems(null)} style={[styles.primaryBtn, { backgroundColor: theme.navy }]}>
              <Text style={styles.primaryBtnText}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function VisitesOpsSection({ onCharteRequired }: { onCharteRequired: CharteErrorHandler }) {
  return <VisitesDemandesWorkspace initialTab="visites" onCharteRequired={onCharteRequired} />;
}

export function DemandesMatchingSection({ onCharteRequired }: { onCharteRequired: CharteErrorHandler }) {
  return <VisitesDemandesWorkspace initialTab="demandes" onCharteRequired={onCharteRequired} />;
}

const styles = StyleSheet.create({
  sectionWrap: { gap: Spacing.two },
  card: { borderRadius: 16, borderWidth: 1, padding: Spacing.three, gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  line: { fontSize: 13 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  inlineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  inputFlex: { flex: 1, minWidth: 150, borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 14 },
  smallBtn: { paddingHorizontal: 14, paddingVertical: 10, minHeight: 40, borderRadius: 10, justifyContent: 'center' },
  smallBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  actionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  actBtn: { flex: 1, minWidth: 110, minHeight: 40, paddingVertical: 9, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chipBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  chipBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.65)', justifyContent: 'center', alignItems: 'center', padding: Spacing.three },
  modalCard: { width: '100%', maxWidth: 520, borderRadius: 20, borderWidth: 1, padding: Spacing.four, gap: 10 },
  input: { borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 14 },
  primaryBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800' },
  cancelLink: { alignItems: 'center', paddingVertical: 6 },
  docRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
});
