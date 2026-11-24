import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  const [editDesc, setEditDesc] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [editNegotiable, setEditNegotiable] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      return;
    }
    const res = await proprietesApi.getMyProperties(1);
    if (res.success && res.data) {
      setItems(res.data.data || []);
    }
  }, [isAuthenticated]);

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
    setSaving(true);
    const res = await proprietesApi.update(editing.id, {
      prix: numericPrice,
      description: editDesc.trim(),
      location_details: editDetails.trim(),
      is_negotiable: editNegotiable,
    });
    setSaving(false);
    if (res.success) {
      setEditing(null);
      setFeedback({ text: `Annonce #${editing.id} mise à jour avec succès.`, type: 'success' });
      await load();
    } else {
      setEditError(res.message || 'Impossible de modifier.');
    }
  };

  const handleDelete = (item: BackendProperty) => {
    Alert.alert('Supprimer ce bien ?', `Annonce #${item.id} (${item.commune})`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          const res = await proprietesApi.delete(item.id);
          if (res.success) {
            setFeedback({ text: `Annonce #${item.id} supprimée.`, type: 'success' });
            await load();
          } else {
            setFeedback({ text: res.message || 'Suppression impossible.', type: 'error' });
          }
        },
      },
    ]);
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

                <Text style={[styles.loc, { color: theme.textSecondary }]}>
                  📍 {[item.quartier, item.arrondissement, item.commune].filter(Boolean).join(', ')} •{' '}
                  {item.surface} m²
                </Text>
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
