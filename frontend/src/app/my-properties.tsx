import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { proprietesApi } from '@/services/api';
import type { BackendProperty } from '@/types/api';
import { formatFcfa } from '@/types/property';

export default function MyPropertiesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<BackendProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editing, setEditing] = useState<BackendProperty | null>(null);
  const [editPrix, setEditPrix] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [editNegotiable, setEditNegotiable] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await proprietesApi.getMyProperties(1);
    if (res.success && res.data) {
      setItems(res.data.data || []);
    }
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

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
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const res = await proprietesApi.update(editing.id, {
      prix: Number(editPrix) || editing.prix,
      description: editDesc,
      location_details: editDetails,
      is_negotiable: editNegotiable,
    });
    setSaving(false);
    if (res.success) {
      setEditing(null);
      await load();
    } else {
      Alert.alert('Erreur', res.message || 'Impossible de modifier.');
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
          if (res.success) await load();
          else Alert.alert('Erreur', res.message || 'Suppression impossible.');
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
          <Pressable onPress={() => router.push('/publish' as any)} style={[styles.addBtn, { backgroundColor: theme.gold }]}>
            <Text style={styles.addBtnText}>+ Publier</Text>
          </Pressable>
        }
      />

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.cardTop}>
              <Text style={[styles.title, { color: theme.text }]}>
                #{item.id} • {item.type.toUpperCase()} ({item.transaction_type})
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      item.status === 'published'
                        ? theme.badgeGreenBg
                        : item.status === 'rejected'
                        ? '#FEE2E2'
                        : theme.badgeGoldBg,
                  },
                ]}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    color:
                      item.status === 'published'
                        ? theme.badgeGreenText
                        : item.status === 'rejected'
                        ? '#B91C1C'
                        : theme.badgeGoldText,
                  }}>
                  {item.status.toUpperCase()}
                </Text>
              </View>
            </View>

            <Text style={[styles.loc, { color: theme.textSecondary }]}>
              {[item.quartier, item.arrondissement, item.commune].filter(Boolean).join(', ')}
            </Text>
            <Text style={[styles.price, { color: theme.primaryDark }]}>{formatFcfa(item.prix)}</Text>

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
                <Text style={{ color: theme.primaryDark, fontWeight: '700', fontSize: 12 }}>Modifier</Text>
              </Pressable>
              <Pressable
                onPress={() => handleDelete(item)}
                style={[styles.btn, { backgroundColor: '#FEE2E2' }]}>
                <Text style={{ color: '#B91C1C', fontWeight: '700', fontSize: 12 }}>Supprimer</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Aucune annonce publiée</Text>
            </View>
          )
        }
      />

      <Modal visible={Boolean(editing)} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Modifier l'annonce #{editing?.id}</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
              placeholder="Prix (FCFA)"
              keyboardType="numeric"
              value={editPrix}
              onChangeText={setEditPrix}
            />
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
              placeholder="Repères d'accès"
              value={editDetails}
              onChangeText={setEditDetails}
            />
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement, minHeight: 80 }]}
              placeholder="Description"
              multiline
              value={editDesc}
              onChangeText={setEditDesc}
            />
            <View style={styles.switchRow}>
              <Text style={{ color: theme.text, fontWeight: '600' }}>Négociable</Text>
              <Switch value={editNegotiable} onValueChange={setEditNegotiable} />
            </View>
            <Pressable onPress={handleSaveEdit} disabled={saving} style={[styles.saveBtn, { backgroundColor: theme.primary }]}>
              <Text style={styles.saveBtnText}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Text>
            </Pressable>
            <Pressable onPress={() => setEditing(null)} style={styles.cancelLink}>
              <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  addBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addBtnText: { color: '#0F172A', fontWeight: '800', fontSize: 12 },
  list: { padding: Spacing.three, gap: Spacing.three },
  card: { borderRadius: 16, borderWidth: 1, padding: Spacing.three, gap: 6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  loc: { fontSize: 13 },
  price: { fontSize: 16, fontWeight: '900' },
  rejectBox: { backgroundColor: '#FEF2F2', padding: 8, borderRadius: 8 },
  rejectText: { color: '#B91C1C', fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  empty: { alignItems: 'center', marginTop: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.65)', justifyContent: 'center', padding: Spacing.four },
  modalCard: { borderRadius: 20, borderWidth: 1, padding: Spacing.four, gap: 10 },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  input: { borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 14 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  saveBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800' },
  cancelLink: { alignItems: 'center', paddingVertical: 8 },
});
