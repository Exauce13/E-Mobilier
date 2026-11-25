import * as WebBrowser from 'expo-web-browser';
import { FileText, Mail, Phone } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { adminApi, getStorageBaseUrl } from '@/services/api';
import type {
  AdminDemandeClientItem,
  AdminVisiteItem,
  BackendProperty,
  CoordonneesUnmaskedData,
  MatchingPropertySuggestion,
  OperationalMetricsData,
  PropertyDocumentItem,
  ZonePerformanceData,
  ZoneSummary,
} from '@/types/api';
import { formatFcfa, resolveStorageUrl } from '@/types/property';

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
      Alert.alert('Validé', res.message || 'Bien publié.');
      await load();
    } else {
      Alert.alert('Erreur', res.message || 'Action impossible.');
    }
  };

  const handleReject = async () => {
    if (!rejectTargetId || rejectMotif.trim().length < 5) {
      Alert.alert('Motif requis', 'Saisissez au moins 5 caractères.');
      return;
    }
    const res = await adminApi.rejeterPropriete(rejectTargetId, rejectMotif.trim());
    if (res.success) {
      setRejectTargetId(null);
      setRejectMotif('');
      await load();
    } else {
      Alert.alert('Erreur', res.message || 'Action impossible.');
    }
  };

  const handleViewDocs = async (id: number) => {
    const res = await adminApi.getProprieteDocuments(id);
    if (res.success) {
      setDocsModalItems((res as any).documents || res.data || []);
    } else {
      Alert.alert('Erreur', res.message || 'Impossible de consulter les documents.');
    }
  };

  const handleMarquerConclu = async () => {
    const propId = Number(concluIdInput);
    if (!propId) return;
    const res = await adminApi.marquerProprieteConclue(propId);
    Alert.alert(res.success ? 'Conclu' : 'Erreur', res.message || '');
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
  const theme = useTheme();
  const [visites, setVisites] = useState<AdminVisiteItem[]>([]);
  const [zones, setZones] = useState<ZoneSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVisit, setActiveVisit] = useState<AdminVisiteItem | null>(null);
  const [actionMode, setActionMode] = useState<'planifier' | 'cr' | 'cloturer' | 'escalade' | 'zone' | 'statut' | null>(null);

  const [dateInput, setDateInput] = useState('');
  const [instructions, setInstructions] = useState('');
  const [crInput, setCrInput] = useState('');
  const [clotureIssue, setClotureIssue] = useState<'succes_offre' | 'sans_suite' | 'client_absent' | 'autre'>('succes_offre');
  const [statusChoice, setStatusChoice] = useState<'pending' | 'confirmed' | 'completed' | 'cancelled'>('confirmed');
  const [statusMotif, setStatusMotif] = useState('');
  const [escaladeNote, setEscaladeNote] = useState('');
  const [escaladeAmount, setEscaladeAmount] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState<number>(1);
  const [unmaskedInfo, setUnmaskedInfo] = useState<CoordonneesUnmaskedData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [vRes, zRes] = await Promise.all([adminApi.getAdminVisites(), adminApi.getZones()]);
    if (vRes.statusCode === 403 && vRes.message?.toLowerCase().includes('charte')) {
      onCharteRequired(vRes.message);
      setLoading(false);
      return;
    }
    if (vRes.success && vRes.data) {
      setVisites((vRes.data as any).data || []);
    }
    if (zRes.success && Array.isArray(zRes.data)) {
      setZones(zRes.data);
      if (zRes.data[0]) setSelectedZoneId(zRes.data[0].id);
    }
    setLoading(false);
  }, [onCharteRequired]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleReadUnmasked = async (visitId: number) => {
    const res = await adminApi.getDossierCoordonnees('visite', visitId);
    if (res.success && res.data) {
      setUnmaskedInfo(res.data);
    } else if (res.demasquage_requis) {
      Alert.alert(
        'Démasquage requis (Anti-Contournement)',
        res.message || 'Soumettre une demande de démasquage temporaire ?',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Demander accès',
            onPress: async () => {
              const reqRes = await adminApi.demanderDemasquage({
                type_dossier: 'visite',
                dossier_id: visitId,
                motif: 'Coordination visite terrain',
                justification: `Contacter le client pour organiser la visite VIS-${visitId}.`,
              });
              Alert.alert(reqRes.success ? 'Demande envoyée' : 'Info', reqRes.message || '');
            },
          },
        ]
      );
    } else {
      Alert.alert('Erreur', res.message || 'Accès refusé.');
    }
  };

  const executeAction = async () => {
    if (!activeVisit || !actionMode) return;
    let res: any;
    if (actionMode === 'planifier') {
      res = await adminApi.planifierVisite(activeVisit.id, {
        scheduled_date: dateInput,
        instructions_itineraire: instructions,
      });
    } else if (actionMode === 'cr') {
      res = await adminApi.saisirCompteRendu(activeVisit.id, crInput);
    } else if (actionMode === 'cloturer') {
      res = await adminApi.cloturerVisite(activeVisit.id, clotureIssue);
    } else if (actionMode === 'escalade') {
      res = await adminApi.escaladerOffreVisite(
        activeVisit.id,
        escaladeNote,
        escaladeAmount ? Number(escaladeAmount) : undefined
      );
    } else if (actionMode === 'zone') {
      res = await adminApi.assignerZoneVisite(activeVisit.id, selectedZoneId);
    } else if (actionMode === 'statut') {
      res = await adminApi.updateAdminVisiteStatut(activeVisit.id, statusChoice, statusMotif.trim() || undefined);
    }

    Alert.alert(res?.success ? 'Succès' : 'Erreur', res?.message || '');
    if (res?.success) {
      setActionMode(null);
      setActiveVisit(null);
      await load();
    }
  };

  return (
    <View style={styles.sectionWrap}>
      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
      ) : (
        visites.map((v) => (
          <View key={v.id} style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              {v.reference_visite} • {v.status.toUpperCase()}
            </Text>
            <Text style={[styles.line, { color: theme.text }]}>
              Client : {v.client?.nom_complet || '-'} ({v.client?.telephone || 'Masqué'})
            </Text>
            {v.propriete && (
              <Text style={[styles.line, { color: theme.textSecondary }]}>
                Bien #{v.propriete.id} — {v.propriete.type} à {v.propriete.commune}
              </Text>
            )}
            <Text style={[styles.line, { color: theme.primaryDark }]}>
              Zone : {v.zone?.nom || 'Non assignée'} • {v.statut_paiement}
            </Text>

            <View style={styles.actionsWrap}>
              <Pressable onPress={() => handleReadUnmasked(v.id)} style={[styles.chipBtn, { backgroundColor: theme.navy }]}>
                <Text style={styles.chipBtnText}>Coordonnées</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setActiveVisit(v);
                  setStatusChoice((v.status as 'pending' | 'confirmed' | 'completed' | 'cancelled') || 'confirmed');
                  setStatusMotif('');
                  setActionMode('statut');
                }}
                style={[styles.chipBtn, { backgroundColor: '#0F766E' }]}>
                <Text style={styles.chipBtnText}>Statut</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setActiveVisit(v);
                  setActionMode('zone');
                }}
                style={[styles.chipBtn, { backgroundColor: theme.backgroundElement }]}>
                <Text style={{ color: theme.text, fontSize: 11, fontWeight: '700' }}>Zone</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setActiveVisit(v);
                  setDateInput(v.scheduled_date ? v.scheduled_date.slice(0, 19).replace('T', ' ') : '');
                  setActionMode('planifier');
                }}
                style={[styles.chipBtn, { backgroundColor: theme.primary }]}>
                <Text style={styles.chipBtnText}>Planifier</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setActiveVisit(v);
                  setActionMode('cr');
                }}
                style={[styles.chipBtn, { backgroundColor: theme.primaryLight }]}>
                <Text style={{ color: theme.primaryDark, fontSize: 11, fontWeight: '700' }}>Compte-rendu</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setActiveVisit(v);
                  setActionMode('cloturer');
                }}
                style={[styles.chipBtn, { backgroundColor: theme.badgeGoldBg }]}>
                <Text style={{ color: theme.badgeGoldText, fontSize: 11, fontWeight: '700' }}>Clôturer</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setActiveVisit(v);
                  setActionMode('escalade');
                }}
                style={[styles.chipBtn, { backgroundColor: '#7C2D12' }]}>
                <Text style={styles.chipBtnText}>Escalader offre</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      {/* Action modal */}
      <Modal visible={Boolean(actionMode)} transparent animationType="fade" onRequestClose={() => setActionMode(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              {activeVisit?.reference_visite} — {actionMode?.toUpperCase()}
            </Text>

            {actionMode === 'planifier' && (
              <>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.cardBorder }]}
                  placeholder="AAAA-MM-JJ HH:MM:SS"
                  value={dateInput}
                  onChangeText={setDateInput}
                />
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.cardBorder }]}
                  placeholder="Instructions itinéraire"
                  value={instructions}
                  onChangeText={setInstructions}
                />
              </>
            )}

            {actionMode === 'cr' && (
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, minHeight: 80 }]}
                placeholder="Compte-rendu terrain (min 10 caractères)..."
                multiline
                value={crInput}
                onChangeText={setCrInput}
              />
            )}

            {actionMode === 'cloturer' && (
              <View style={styles.chipsRow}>
                {(['succes_offre', 'sans_suite', 'client_absent', 'autre'] as const).map((iss) => (
                  <Pressable
                    key={iss}
                    onPress={() => setClotureIssue(iss)}
                    style={[styles.chip, { backgroundColor: clotureIssue === iss ? theme.primary : theme.backgroundElement }]}>
                    <Text style={{ color: clotureIssue === iss ? '#FFF' : theme.text, fontSize: 12 }}>{iss}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {actionMode === 'escalade' && (
              <>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.cardBorder }]}
                  placeholder="Montant offre (F CFA)"
                  keyboardType="numeric"
                  value={escaladeAmount}
                  onChangeText={setEscaladeAmount}
                />
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.cardBorder }]}
                  placeholder="Commentaires offre..."
                  value={escaladeNote}
                  onChangeText={setEscaladeNote}
                />
              </>
            )}

            {actionMode === 'zone' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {zones.map((z) => (
                  <Pressable
                    key={z.id}
                    onPress={() => setSelectedZoneId(z.id)}
                    style={[styles.chip, { backgroundColor: selectedZoneId === z.id ? theme.primary : theme.backgroundElement }]}>
                    <Text style={{ color: selectedZoneId === z.id ? '#FFF' : theme.text, fontSize: 12 }}>{z.nom}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {actionMode === 'statut' && (
              <>
                <View style={styles.chipsRow}>
                  {(['pending', 'confirmed', 'completed', 'cancelled'] as const).map((st) => (
                    <Pressable
                      key={st}
                      onPress={() => setStatusChoice(st)}
                      style={[styles.chip, { backgroundColor: statusChoice === st ? theme.primary : theme.backgroundElement }]}>
                      <Text style={{ color: statusChoice === st ? '#FFF' : theme.text, fontSize: 12 }}>{st}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.cardBorder }]}
                  placeholder="Motif optionnel..."
                  value={statusMotif}
                  onChangeText={setStatusMotif}
                />
              </>
            )}

            <Pressable onPress={executeAction} style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
              <Text style={styles.primaryBtnText}>Valider</Text>
            </Pressable>
            <Pressable onPress={() => setActionMode(null)} style={styles.cancelLink}>
              <Text style={{ color: theme.textSecondary }}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(unmaskedInfo)} transparent animationType="fade" onRequestClose={() => setUnmaskedInfo(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Coordonnées Tracées ({unmaskedInfo?.dossier_reference})
            </Text>
            <Text style={{ color: theme.text, fontWeight: '700' }}>{unmaskedInfo?.nom_complet}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Phone size={14} color={theme.primaryDark} strokeWidth={2.2} />
              <Text style={{ color: theme.primaryDark }}>{unmaskedInfo?.telephone}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Mail size={14} color={theme.textSecondary} strokeWidth={2} />
              <Text style={{ color: theme.textSecondary }}>{unmaskedInfo?.email}</Text>
            </View>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
              Mode : {unmaskedInfo?.mode_acces}
              {unmaskedInfo?.expires_at ? ` • Expire le ${new Date(unmaskedInfo.expires_at).toLocaleString('fr-FR')}` : ''}
            </Text>
            <Pressable onPress={() => setUnmaskedInfo(null)} style={[styles.primaryBtn, { backgroundColor: theme.navy }]}>
              <Text style={styles.primaryBtnText}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function DemandesMatchingSection({ onCharteRequired }: { onCharteRequired: CharteErrorHandler }) {
  const theme = useTheme();
  const [demandes, setDemandes] = useState<AdminDemandeClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchingForId, setMatchingForId] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<MatchingPropertySuggestion[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminApi.getAdminDemandes();
    if (res.statusCode === 403 && res.message?.toLowerCase().includes('charte')) {
      onCharteRequired(res.message);
      setLoading(false);
      return;
    }
    if (res.success && res.data) {
      setDemandes((res.data as any).data || []);
    }
    setLoading(false);
  }, [onCharteRequired]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleOpenMatching = async (demandeId: number) => {
    const res = await adminApi.getMatchingBiens(demandeId);
    if (res.success) {
      setMatchingForId(demandeId);
      setSuggestions((res as any).biens_suggeres || res.data?.biens_suggeres || []);
    } else {
      Alert.alert('Erreur', res.message || 'Matching impossible.');
    }
  };

  const handleAssocier = async (propId: number) => {
    if (!matchingForId) return;
    const res = await adminApi.associerBienDemande(matchingForId, propId);
    Alert.alert(res.success ? 'Associé !' : 'Erreur', res.message || '');
    if (res.success) {
      setMatchingForId(null);
      await load();
    }
  };

  const handleReadUnmasked = async (demandeId: number) => {
    const res = await adminApi.getDossierCoordonnees('demande_client', demandeId);
    if (res.success && res.data) {
      Alert.alert(
        res.data.dossier_reference,
        `${res.data.nom_complet}\nTél : ${res.data.telephone}\nE-mail : ${res.data.email}\n${res.data.mode_acces}`
      );
    } else if (res.demasquage_requis) {
      const reqRes = await adminApi.demanderDemasquage({
        type_dossier: 'demande_client',
        dossier_id: demandeId,
        motif: 'Proposition de biens compatibilité',
        justification: `Contacter le demandeur pour la demande DEM-${demandeId}.`,
      });
      Alert.alert(reqRes.success ? 'Demande envoyée' : 'Démasquage requis', reqRes.message || '');
    } else {
      Alert.alert('Erreur', res.message || '');
    }
  };

  return (
    <View style={styles.sectionWrap}>
      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
      ) : (
        demandes.map((d) => (
          <View key={d.id} style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              {d.reference_dossier} • {d.property_type.toUpperCase()} ({d.transaction_type})
            </Text>
            <Text style={[styles.line, { color: theme.text }]}>
              {d.target_commune} • Budget max : {formatFcfa(d.budget_max)}
            </Text>
            <Text style={[styles.line, { color: theme.textSecondary }]}>
              Client : {d.client?.nom_complet || '-'} ({d.client?.telephone || 'Masqué'})
            </Text>

            <View style={styles.actionsWrap}>
              <Pressable
                onPress={async () => {
                  const res = await adminApi.prendreEnChargeDemande(d.id);
                  Alert.alert(res.success ? 'Prise en charge' : 'Erreur', res.message || '');
                }}
                style={[styles.chipBtn, { backgroundColor: theme.navy }]}>
                <Text style={styles.chipBtnText}>Prendre en charge</Text>
              </Pressable>
              <Pressable onPress={() => handleOpenMatching(d.id)} style={[styles.chipBtn, { backgroundColor: theme.primary }]}>
                <Text style={styles.chipBtnText}>Matching Biens</Text>
              </Pressable>
              <Pressable onPress={() => handleReadUnmasked(d.id)} style={[styles.chipBtn, { backgroundColor: theme.backgroundElement }]}>
                <Text style={{ color: theme.text, fontSize: 11, fontWeight: '700' }}>Coordonnées</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  const res = await adminApi.cloturerDemande(d.id, 'satisfaite');
                  Alert.alert(res.success ? 'Clôturée' : 'Erreur', res.message || '');
                  if (res.success) await load();
                }}
                style={[styles.chipBtn, { backgroundColor: theme.badgeGreenBg }]}>
                <Text style={{ color: theme.badgeGreenText, fontSize: 11, fontWeight: '700' }}>Satisfaite</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Modal visible={Boolean(matchingForId)} transparent animationType="fade" onRequestClose={() => setMatchingForId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder, maxHeight: '80%' }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Biens compatibles (DEM-{matchingForId})</Text>
            <ScrollView contentContainerStyle={{ gap: 8 }}>
              {suggestions.length === 0 ? (
                <Text style={{ color: theme.textSecondary }}>Aucun bien compatible trouvé.</Text>
              ) : (
                suggestions.map((s) => (
                  <View key={s.propriete_id} style={[styles.docRow, { borderColor: theme.cardBorder }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontWeight: '800', fontSize: 13 }}>
                        #{s.propriete_id} {s.type} • {s.commune} ({s.score_matching_pourcentage}%)
                      </Text>
                      <Text style={{ color: theme.primaryDark, fontSize: 12 }}>{formatFcfa(s.prix)}</Text>
                    </View>
                    <Pressable onPress={() => handleAssocier(s.propriete_id)} style={[styles.chipBtn, { backgroundColor: theme.primary }]}>
                      <Text style={styles.chipBtnText}>Associer</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
            <Pressable onPress={() => setMatchingForId(null)} style={[styles.primaryBtn, { backgroundColor: theme.navy }]}>
              <Text style={styles.primaryBtnText}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionWrap: { gap: Spacing.two },
  card: { borderRadius: 16, borderWidth: 1, padding: Spacing.three, gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  line: { fontSize: 13 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  inlineRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  inputFlex: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 14 },
  smallBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  smallBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  actBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  chipBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  chipBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.65)', justifyContent: 'center', padding: Spacing.four },
  modalCard: { borderRadius: 20, borderWidth: 1, padding: Spacing.four, gap: 10 },
  input: { borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 14 },
  primaryBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800' },
  cancelLink: { alignItems: 'center', paddingVertical: 6 },
  docRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
});
