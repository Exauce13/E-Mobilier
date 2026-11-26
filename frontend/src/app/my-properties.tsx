import { router } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { proprietesApi } from '@/services/api';
import type { BackendProperty } from '@/types/api';
import { formatFcfa } from '@/types/property';
import { confirmDialog } from '@/utils/dialog';
import { getStatusDisplay } from '@/utils/validation';

export default function MyPropertiesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { horizontalPadding } = useResponsive();
  const { isAuthenticated, isAgentMobilier, openAuthModal } = useAuth();

  const [items, setItems] = useState<BackendProperty[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('tous');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [editing, setEditing] = useState<BackendProperty | null>(null);
  const [editPrix, setEditPrix] = useState('');
  const [editCommune, setEditCommune] = useState('');
  const [editQuartier, setEditQuartier] = useState('');
  const [editSurface, setEditSurface] = useState('');
  const [editAccess, setEditAccess] = useState('');
  const [editEau, setEditEau] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [editNegotiable, setEditNegotiable] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(
    async (targetPage = 1, replace = true) => {
      setLoadError(null);
      if (!isAuthenticated) {
        setItems([]);
        return;
      }
      const res = await proprietesApi.getMyProperties(targetPage);
      if (res.success && res.data) {
        const list = res.data.data || [];
        setItems((prev) => (replace ? list : [...prev, ...list]));
        setPage(res.data.current_page || targetPage);
        setLastPage(res.data.last_page || 1);
      } else {
        setLoadError(res.message || 'Impossible de charger vos annonces.');
      }
    },
    [isAuthenticated]
  );

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const filteredItems = useMemo(() => {
    if (statusFilter === 'tous') return items;
    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openEdit = (item: BackendProperty) => {
    setEditing(item);
    setEditPrix(String(item.prix ?? ''));
    setEditCommune(item.commune || '');
    setEditQuartier(item.quartier || '');
    setEditSurface(item.surface ? String(item.surface) : '');
    setEditAccess(item.accessibilite || '');
    setEditEau(item.eau_courant || '');
    setEditDesc(item.description || '');
    setEditDetails(item.location_details || '');
    setEditNegotiable(Boolean(item.is_negotiable));
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const numericPrice = Number(editPrix.replace(/\s+/g, ''));
    if (Number.isNaN(numericPrice) || numericPrice <= 0) {
      setEditError('Veuillez saisir un prix valide supérieur à 0 F CFA.');
      return;
    }
    const numericSurface = editSurface.trim() ? Number(editSurface.replace(/\s+/g, '')) : undefined;
    if (numericSurface !== undefined && (Number.isNaN(numericSurface) || numericSurface <= 0)) {
      setEditError('Veuillez saisir une surface valide en m².');
      return;
    }
    setSaving(true);
    const res = await proprietesApi.update(editing.id, {
      prix: numericPrice,
      ...(editCommune.trim() ? { commune: editCommune.trim() } : {}),
      ...(editQuartier.trim() ? { quartier: editQuartier.trim() } : {}),
      ...(numericSurface ? { surface: numericSurface } : {}),
      ...(editAccess.trim() ? { accessibilite: editAccess.trim() } : {}),
      ...(editEau.trim() ? { eau_courant: editEau.trim() } : {}),
      description: editDesc.trim(),
      location_details: editDetails.trim(),
      is_negotiable: editNegotiable,
    });
    setSaving(false);
    if (res.success) {
      setEditing(null);
      setFeedback({ text: `Annonce #${editing.id} mise à jour avec succès.`, type: 'success' });
      await load(1, true);
    } else {
      setEditError(res.message || 'Impossible de modifier.');
    }
  };

  const handleDelete = async (item: BackendProperty) => {
    const ok = await confirmDialog(
      'Supprimer ce bien ?',
      `Annonce #${item.id} (${item.commune})`,
      'Supprimer'
    );
    if (!ok) return;

    const res = await proprietesApi.delete(item.id);
    if (res.success) {
      setFeedback({ text: `Annonce #${item.id} supprimée.`, type: 'success' });
      await load(1, true);
    } else {
      setFeedback({ text: res.message || 'Suppression impossible.', type: 'error' });
    }
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Mes Annonces"
        subtitle={`${items.length} bien(s) déposé(s)`}
        rightAction={
          <Pressable
            onPress={() =>
              router.push((isAgentMobilier ? '/publish-agent' : '/publish-client') as any)
            }
            style={[styles.addBtn, { backgroundColor: '#F59E0B' }]}>
            <Text style={styles.addBtnText}>+ Publier</Text>
          </Pressable>
        }
      />

      {!isAuthenticated ? (
        <View style={styles.gateBox}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Connexion requise</Text>
          <Text style={{ color: theme.textSecondary, textAlign: 'center', fontSize: 14 }}>
            Connectez-vous pour gérer vos biens immobiliers publiés.
          </Text>
          <Pressable
            onPress={() => openAuthModal('login')}
            style={[styles.saveBtn, { backgroundColor: theme.primary, paddingHorizontal: 24 }]}>
            <Text style={styles.saveBtnText}>Se connecter</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
          }
          contentContainerStyle={[
            styles.list,
            { paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + 28 },
          ]}
          ListHeaderComponent={
            <View style={{ gap: 10 }}>
              {loadError ? (
                <View style={[styles.feedbackBanner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                  <Text style={{ color: '#B91C1C', fontSize: 13, fontWeight: '700' }}>{loadError}</Text>
                </View>
              ) : null}
              {feedback && (
                <View
                  style={[
                    styles.feedbackBanner,
                    {
                      backgroundColor: feedback.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                      borderColor: feedback.type === 'success' ? '#A7F3D0' : '#FECACA',
                    },
                  ]}>
                  <Text
                    style={{
                      color: feedback.type === 'success' ? '#047857' : '#B91C1C',
                      fontSize: 13,
                      fontWeight: '700',
                    }}>
                    {feedback.text}
                  </Text>
                </View>
              )}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {[
                  { key: 'tous', label: `Tous (${items.length})` },
                  { key: 'published', label: 'Publiés' },
                  { key: 'pending', label: 'En attente' },
                  { key: 'rejected', label: 'Rejetés' },
                  { key: 'sold_rented', label: 'Conclus' },
                ].map((f) => {
                  const active = statusFilter === f.key;
                  return (
                    <Pressable
                      key={f.key}
                      onPress={() => setStatusFilter(f.key)}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: active ? theme.primary : theme.cardBackground,
                          borderColor: active ? theme.primary : theme.cardBorder,
                        },
                      ]}>
                      <Text
                        style={{
                          color: active ? '#FFFFFF' : theme.text,
                          fontSize: 12,
                          fontWeight: '700',
                        }}>
                        {f.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          }
          renderItem={({ item }) => {
            const st = getStatusDisplay(item.status);
            return (
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                ]}>
                <View style={styles.cardTop}>
                  <Text style={[styles.title, { color: theme.text }]}>
                    #{item.id} • {item.type.toUpperCase()} ({item.transaction_type})
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: st.text }}>
                      {st.label}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <MapPin size={13} color={theme.primary} strokeWidth={2.2} />
                  <Text style={[styles.loc, { color: theme.textSecondary, flex: 1 }]}>
                    {[item.quartier, item.arrondissement, item.commune].filter(Boolean).join(', ')}
                    {item.surface && Number(item.surface) > 0 ? ` • ${item.surface} m²` : ''}
                  </Text>
                </View>
                <Text style={[styles.price, { color: theme.primary }]}>
                  {formatFcfa(item.prix)}
                  {item.transaction_type === 'location' ? '/mois' : ''}
                </Text>

                {item.motif_rejet ? (
                  <View style={styles.rejectBox}>
                    <Text style={styles.rejectText}>Motif de rejet : {item.motif_rejet}</Text>
                  </View>
                ) : null}

                <View style={styles.actions}>
                  <Pressable
                    onPress={() => router.push(`/property/${item.id}` as any)}
                    style={[styles.btn, { backgroundColor: theme.backgroundElement }]}>
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>Voir</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => openEdit(item)}
                    style={[styles.btn, { backgroundColor: theme.primaryLight }]}>
                    <Text style={{ color: theme.primaryDark, fontWeight: '700', fontSize: 12 }}>
                      Modifier
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(item)}
                    style={[styles.btn, { backgroundColor: '#FEE2E2' }]}>
                    <Text style={{ color: '#B91C1C', fontWeight: '700', fontSize: 12 }}>Supprimer</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            page < lastPage ? (
              <Pressable
                onPress={async () => {
                  setLoadingMore(true);
                  await load(page + 1, false);
                  setLoadingMore(false);
                }}
                disabled={loadingMore}
                style={[styles.saveBtn, { backgroundColor: theme.navy, marginTop: 6 }]}>
                <Text style={styles.saveBtnText}>
                  {loadingMore ? 'Chargement...' : 'Charger plus d’annonces'}
                </Text>
              </Pressable>
            ) : undefined
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
            ) : (
              <View style={styles.empty}>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>
                  Aucune annonce dans cette catégorie
                </Text>
                <Pressable
                  onPress={() =>
                    router.push((isAgentMobilier ? '/publish-agent' : '/publish-client') as any)
                  }
                  style={[styles.saveBtn, { backgroundColor: theme.primary, paddingHorizontal: 22 }]}>
                  <Text style={styles.saveBtnText}>Publier un bien</Text>
                </Pressable>
              </View>
            )
          }
        />
      )}

      <Modal
        visible={Boolean(editing)}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
            ]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Modifier l'annonce #{editing?.id}
            </Text>
            {editError ? <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '700' }}>{editError}</Text> : null}
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 10 }}>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement },
                ]}
                placeholder="Prix (FCFA)"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                value={editPrix}
                onChangeText={setEditPrix}
              />
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement },
                ]}
                placeholder="Commune"
                placeholderTextColor={theme.textSecondary}
                value={editCommune}
                onChangeText={setEditCommune}
              />
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement },
                ]}
                placeholder="Quartier"
                placeholderTextColor={theme.textSecondary}
                value={editQuartier}
                onChangeText={setEditQuartier}
              />
              {!(editing?.type === 'chambre' && editing?.transaction_type === 'location') && (
                <TextInput
                  style={[
                    styles.input,
                    { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement },
                  ]}
                  placeholder="Surface (m²)"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  value={editSurface}
                  onChangeText={setEditSurface}
                />
              )}
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement },
                ]}
                placeholder="Accessibilité (voie pavée, bitumée...)"
                placeholderTextColor={theme.textSecondary}
                value={editAccess}
                onChangeText={setEditAccess}
              />
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement },
                ]}
                placeholder="Eau & électricité (SBEE / SONEB)"
                placeholderTextColor={theme.textSecondary}
                value={editEau}
                onChangeText={setEditEau}
              />
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement },
                ]}
                placeholder="Repères d'accès"
                placeholderTextColor={theme.textSecondary}
                value={editDetails}
                onChangeText={setEditDetails}
              />
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    borderColor: theme.cardBorder,
                    backgroundColor: theme.backgroundElement,
                    minHeight: 84,
                    textAlignVertical: 'top',
                  },
                ]}
                placeholder="Description"
                placeholderTextColor={theme.textSecondary}
                multiline
                value={editDesc}
                onChangeText={setEditDesc}
              />
              <View style={styles.switchRow}>
                <Text style={{ color: theme.text, fontWeight: '700' }}>Prix négociable</Text>
                <Switch
                  value={editNegotiable}
                  onValueChange={setEditNegotiable}
                  trackColor={{ true: theme.primary }}
                />
              </View>
            </ScrollView>
            <Pressable
              onPress={handleSaveEdit}
              disabled={saving}
              style={[styles.saveBtn, { backgroundColor: theme.primary }]}>
              <Text style={styles.saveBtnText}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Text>
            </Pressable>
            <Pressable onPress={() => setEditing(null)} style={styles.cancelLink}>
              <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  addBtn: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9 },
  addBtnText: { color: '#0F172A', fontWeight: '800', fontSize: 12 },
  list: { paddingTop: Spacing.three, gap: 12, maxWidth: 860, width: '100%', alignSelf: 'center' },
  feedbackBanner: { borderRadius: 12, borderWidth: 1, padding: 12 },
  filterChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '800', flex: 1 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  loc: { fontSize: 13 },
  price: { fontSize: 17, fontWeight: '900' },
  rejectBox: { backgroundColor: '#FEF2F2', padding: 8, borderRadius: 8 },
  rejectText: { color: '#B91C1C', fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  empty: { alignItems: 'center', marginTop: 48, gap: 12 },
  gateBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.68)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  input: { borderRadius: 12, borderWidth: 1, padding: 11, fontSize: 14 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  saveBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  cancelLink: { alignItems: 'center', paddingVertical: 8 },
});
