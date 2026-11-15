import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';
import { BENIN_COMMUNES } from '@/constants/locations';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { demandesRechercheApi } from '@/services/api';
import type { DemandeRechercheItem } from '@/types/api';
import { formatFcfa } from '@/types/property';

export default function SearchRequestsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [requests, setRequests] = useState<DemandeRechercheItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DemandeRechercheItem | null>(null);
  const [propertyType, setPropertyType] = useState<'parcelle' | 'maison' | 'chambre'>('maison');
  const [transactionType, setTransactionType] = useState<'location' | 'vente'>('location');
  const [commune, setCommune] = useState('Cotonou');
  const [arrondissement, setArrondissement] = useState('');
  const [quartier, setQuartier] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await demandesRechercheApi.getMyRequests();
    if (res.success && res.data) {
      setRequests(res.data.data || []);
    }
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setPropertyType('maison');
    setTransactionType('location');
    setCommune('Cotonou');
    setArrondissement('');
    setQuartier('');
    setBudgetMax('');
    setDetails('');
    setFormOpen(true);
  };

  const openEdit = (item: DemandeRechercheItem) => {
    setEditing(item);
    setPropertyType(item.property_type);
    setTransactionType(item.transaction_type);
    setCommune(item.target_commune);
    setArrondissement(item.target_arrondissement || '');
    setQuartier(item.target_quartier || '');
    setBudgetMax(String(item.budget_max));
    setDetails(item.criteria_details || '');
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!commune.trim() || !budgetMax.trim() || Number(budgetMax) <= 0) {
      Alert.alert('Champs requis', 'Commune cible et budget maximum sont obligatoires.');
      return;
    }
    setSaving(true);
    const payload = {
      property_type: propertyType,
      transaction_type: transactionType,
      target_commune: commune.trim(),
      target_arrondissement: arrondissement.trim() || undefined,
      target_quartier: quartier.trim() || undefined,
      budget_max: Number(budgetMax),
      criteria_details: details.trim() || undefined,
    };

    const res = editing
      ? await demandesRechercheApi.update(editing.id, payload)
      : await demandesRechercheApi.create(payload);

    setSaving(false);
    if (res.success) {
      setFormOpen(false);
      await load();
    } else {
      Alert.alert('Erreur', res.message || 'Impossible d’enregistrer la demande.');
    }
  };

  const handleDelete = (item: DemandeRechercheItem) => {
    Alert.alert('Supprimer cette demande ?', `DEM-${String(item.id).padStart(5, '0')}`, [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui',
        style: 'destructive',
        onPress: async () => {
          const res = await demandesRechercheApi.delete(item.id);
          if (res.success) await load();
          else Alert.alert('Erreur', res.message || 'Suppression refusée.');
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Mes Demandes de Recherche"
        subtitle="Trouvez votre bien sur mesure"
        rightAction={
          <Pressable onPress={openCreate} style={[styles.addBtn, { backgroundColor: theme.gold }]}>
            <Text style={styles.addBtnText}>+ Nouvelle</Text>
          </Pressable>
        }
      />

      <FlatList
        data={requests}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.topRow}>
              <Text style={[styles.refText, { color: theme.gold }]}>
                DEM-{String(item.id).padStart(5, '0')}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: theme.badgeBlueBg }]}>
                <Text style={{ color: theme.badgeBlueText, fontSize: 11, fontWeight: '800' }}>
                  {item.status.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              {item.property_type.toUpperCase()} ({item.transaction_type}) — {item.target_commune}
            </Text>
            <Text style={[styles.budget, { color: theme.primaryDark }]}>
              Budget max : {formatFcfa(item.budget_max)}
            </Text>
            {item.criteria_details ? (
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{item.criteria_details}</Text>
            ) : null}

            <View style={styles.actions}>
              <Pressable onPress={() => openEdit(item)} style={[styles.btn, { backgroundColor: theme.primaryLight }]}>
                <Text style={{ color: theme.primaryDark, fontWeight: '700', fontSize: 12 }}>Modifier</Text>
              </Pressable>
              <Pressable onPress={() => handleDelete(item)} style={[styles.btn, { backgroundColor: '#FEE2E2' }]}>
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
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Aucune demande enregistrée</Text>
              <Pressable onPress={openCreate} style={[styles.saveBtn, { backgroundColor: theme.primary, paddingHorizontal: 20 }]}>
                <Text style={styles.saveBtnText}>Déposer une demande</Text>
              </Pressable>
            </View>
          )
        }
      />

      <Modal visible={formOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFormOpen(false)}>
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
          <ScreenHeader
            title={editing ? 'Modifier la demande' : 'Nouvelle demande'}
            onBack={() => setFormOpen(false)}
          />
          <ScrollView contentContainerStyle={styles.formScroll}>
            <Text style={[styles.label, { color: theme.text }]}>Type de bien</Text>
            <View style={styles.rowWrap}>
              {(['maison', 'parcelle', 'chambre'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setPropertyType(t)}
                  style={[
                    styles.pill,
                    { backgroundColor: propertyType === t ? theme.primary : theme.backgroundElement },
                  ]}>
                  <Text style={{ color: propertyType === t ? '#FFFFFF' : theme.text, fontWeight: '700' }}>{t}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, { color: theme.text }]}>Transaction</Text>
            <View style={styles.rowWrap}>
              {(['location', 'vente'] as const).map((tr) => (
                <Pressable
                  key={tr}
                  onPress={() => setTransactionType(tr)}
                  style={[
                    styles.pill,
                    { backgroundColor: transactionType === tr ? theme.gold : theme.backgroundElement },
                  ]}>
                  <Text style={{ color: transactionType === tr ? '#0F172A' : theme.text, fontWeight: '700' }}>{tr}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, { color: theme.text }]}>Commune cible *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowWrap}>
              {BENIN_COMMUNES.filter((c) => c !== 'Toutes les communes').map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCommune(c)}
                  style={[styles.pill, { backgroundColor: commune === c ? theme.navy : theme.backgroundElement }]}>
                  <Text style={{ color: commune === c ? '#FFFFFF' : theme.text, fontSize: 12, fontWeight: '600' }}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.cardBackground }]}
              placeholder="Arrondissement (optionnel)"
              placeholderTextColor={theme.textSecondary}
              value={arrondissement}
              onChangeText={setArrondissement}
            />
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.cardBackground }]}
              placeholder="Quartier souhaité (optionnel)"
              placeholderTextColor={theme.textSecondary}
              value={quartier}
              onChangeText={setQuartier}
            />
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.cardBackground }]}
              placeholder="Budget maximum (F CFA) *"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
              value={budgetMax}
              onChangeText={setBudgetMax}
            />
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.cardBackground, minHeight: 90 }]}
              placeholder="Critères particuliers (nombre de chambres, accès, proximité...)"
              placeholderTextColor={theme.textSecondary}
              multiline
              value={details}
              onChangeText={setDetails}
            />

            <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, { backgroundColor: theme.primary }]}>
              <Text style={styles.saveBtnText}>{saving ? 'Enregistrement...' : 'Valider la demande'}</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
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
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  refText: { fontSize: 11, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  budget: { fontSize: 15, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  empty: { alignItems: 'center', marginTop: 48, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  formScroll: { padding: Spacing.three, gap: 12 },
  label: { fontSize: 13, fontWeight: '800' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 },
  input: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14 },
  saveBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
