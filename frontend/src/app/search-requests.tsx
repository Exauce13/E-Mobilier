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
import { BENIN_COMMUNES, QUARTIERS_BY_COMMUNE } from '@/constants/locations';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { demandesRechercheApi } from '@/services/api';
import type { DemandeRechercheItem } from '@/types/api';
import { formatFcfa } from '@/types/property';
import { getStatusDisplay } from '@/utils/validation';

export default function SearchRequestsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { horizontalPadding } = useResponsive();
  const { isAuthenticated, openAuthModal } = useAuth();

  const [requests, setRequests] = useState<DemandeRechercheItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DemandeRechercheItem | null>(null);
  const [propertyType, setPropertyType] = useState<'parcelle' | 'maison' | 'chambre'>('maison');
  const [transactionType, setTransactionType] = useState<'location' | 'vente'>('location');
  const [commune, setCommune] = useState('Cotonou');
  const [arrondissement, setArrondissement] = useState('');
  const [quartier, setQuartier] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [details, setDetails] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setRequests([]);
      return;
    }
    const res = await demandesRechercheApi.getMyRequests();
    if (res.success && res.data) {
      setRequests(res.data.data || []);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const handleSelectPropertyType = (nextType: 'parcelle' | 'maison' | 'chambre') => {
    setPropertyType(nextType);
    if (nextType === 'parcelle' && transactionType === 'location') {
      setTransactionType('vente');
    }
  };

  const openCreate = () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    setEditing(null);
    setPropertyType('maison');
    setTransactionType('location');
    setCommune('Cotonou');
    setArrondissement('');
    setQuartier('');
    setBudgetMax('');
    setDetails('');
    setFormError(null);
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
    setFormError(null);
    setFormOpen(true);
  };

  const handleSave = async () => {
    setFormError(null);
    if (propertyType === 'parcelle' && transactionType === 'location') {
      setFormError('Une parcelle ne peut pas faire l’objet d’une demande de location.');
      return;
    }
    if (!commune.trim()) {
      setFormError('La commune cible est obligatoire.');
      return;
    }
    const parsedBudget = Number(budgetMax.replace(/\s+/g, ''));
    if (!budgetMax.trim() || Number.isNaN(parsedBudget) || parsedBudget <= 0) {
      setFormError('Veuillez saisir un budget maximum valide supérieur à 0 F CFA.');
      return;
    }

    setSaving(true);
    const payload = {
      property_type: propertyType,
      transaction_type: transactionType,
      target_commune: commune.trim(),
      target_arrondissement: arrondissement.trim() || undefined,
      target_quartier: quartier.trim() || undefined,
      budget_max: parsedBudget,
      criteria_details: details.trim() || undefined,
    };

    const res = editing
      ? await demandesRechercheApi.update(editing.id, payload)
      : await demandesRechercheApi.create(payload);

    setSaving(false);
    if (res.success) {
      setFormOpen(false);
      setFeedback({
        text: editing
          ? 'Votre demande de recherche a été mise à jour.'
          : 'Votre demande de recherche a été publiée ! Nos agents vont vous proposer des biens.',
        type: 'success',
      });
      await load();
    } else {
      setFormError(res.message || "Impossible d'enregistrer la demande.");
    }
  };

  const handleDelete = (item: DemandeRechercheItem) => {
    Alert.alert('Supprimer cette demande ?', `DEM-${String(item.id).padStart(5, '0')}`, [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, supprimer',
        style: 'destructive',
        onPress: async () => {
          const res = await demandesRechercheApi.delete(item.id);
          if (res.success) {
            setFeedback({ text: 'Demande supprimée.', type: 'success' });
            await load();
          } else {
            setFeedback({ text: res.message || 'Suppression refusée.', type: 'error' });
          }
        },
      },
    ]);
  };

  const quartiersSuggestions = (QUARTIERS_BY_COMMUNE[commune] || []).filter((q) => q !== 'Tous');

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Mes Demandes de Recherche"
        subtitle="Trouvez votre bien sur mesure"
        rightAction={
          <Pressable onPress={openCreate} style={[styles.addBtn, { backgroundColor: '#F59E0B' }]}>
            <Text style={styles.addBtnText}>+ Nouvelle</Text>
          </Pressable>
        }
      />

      {!isAuthenticated ? (
        <View style={styles.gateBox}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Connexion requise</Text>
          <Text style={{ color: theme.textSecondary, textAlign: 'center', fontSize: 14 }}>
            Connectez-vous pour enregistrer et suivre vos demandes de recherche immobilière.
          </Text>
          <Pressable
            onPress={() => openAuthModal('login')}
            style={[styles.saveBtn, { backgroundColor: theme.primary, paddingHorizontal: 24 }]}>
            <Text style={styles.saveBtnText}>Se connecter</Text>
          </Pressable>
        </View>
      ) : (
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
              tintColor={theme.primary}
            />
          }
          contentContainerStyle={[
            styles.list,
            { paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + 28 },
          ]}
          ListHeaderComponent={
            feedback ? (
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
            ) : undefined
          }
          renderItem={({ item }) => {
            const st = getStatusDisplay(item.status);
            return (
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                ]}>
                <View style={styles.topRow}>
                  <Text style={[styles.refText, { color: theme.gold }]}>
                    DEM-{String(item.id).padStart(5, '0')}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={{ color: st.text, fontSize: 11, fontWeight: '800' }}>{st.label}</Text>
                  </View>
                </View>
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  {item.property_type.toUpperCase()} ({item.transaction_type}) —{' '}
                  {[item.target_quartier, item.target_commune].filter(Boolean).join(', ')}
                </Text>
                <Text style={[styles.budget, { color: theme.primary }]}>
                  Budget max : {formatFcfa(item.budget_max)}
                </Text>
                {item.criteria_details ? (
                  <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19 }}>
                    {item.criteria_details}
                  </Text>
                ) : null}

                <View style={styles.actions}>
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
                  Aucune demande enregistrée
                </Text>
                <Pressable
                  onPress={openCreate}
                  style={[styles.saveBtn, { backgroundColor: theme.primary, paddingHorizontal: 22 }]}>
                  <Text style={styles.saveBtnText}>Déposer une demande</Text>
                </Pressable>
              </View>
            )
          }
        />
      )}

      <Modal
        visible={formOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFormOpen(false)}>
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
          <ScreenHeader
            title={editing ? 'Modifier la demande' : 'Nouvelle demande de recherche'}
            onBack={() => setFormOpen(false)}
          />
          <ScrollView contentContainerStyle={styles.formScroll}>
            {formError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {formError}</Text>
              </View>
            )}

            <Text style={[styles.label, { color: theme.text }]}>Type de bien *</Text>
            <View style={styles.rowWrap}>
              {(['maison', 'parcelle', 'chambre'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => handleSelectPropertyType(t)}
                  style={[
                    styles.pill,
                    { backgroundColor: propertyType === t ? theme.primary : theme.backgroundElement },
                  ]}>
                  <Text
                    style={{
                      color: propertyType === t ? '#FFFFFF' : theme.text,
                      fontWeight: '700',
                      textTransform: 'capitalize',
                    }}>
                    {t}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, { color: theme.text }]}>Transaction *</Text>
            <View style={styles.rowWrap}>
              {(['location', 'vente'] as const).map((tr) => {
                const disabled = propertyType === 'parcelle' && tr === 'location';
                return (
                  <Pressable
                    key={tr}
                    disabled={disabled}
                    onPress={() => setTransactionType(tr)}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: transactionType === tr ? '#F59E0B' : theme.backgroundElement,
                        opacity: disabled ? 0.4 : 1,
                      },
                    ]}>
                    <Text
                      style={{
                        color: transactionType === tr ? '#0F172A' : theme.text,
                        fontWeight: '800',
                        textTransform: 'capitalize',
                      }}>
                      {tr}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: theme.text }]}>Commune cible *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowWrap}>
              {BENIN_COMMUNES.filter((c) => c !== 'Toutes les communes').map((c) => (
                <Pressable
                  key={c}
                  onPress={() => {
                    setCommune(c);
                    setQuartier('');
                  }}
                  style={[styles.pill, { backgroundColor: commune === c ? theme.navy : theme.backgroundElement }]}>
                  <Text style={{ color: commune === c ? '#FFFFFF' : theme.text, fontSize: 12, fontWeight: '700' }}>
                    {c}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {quartiersSuggestions.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowWrap}>
                {quartiersSuggestions.map((q) => (
                  <Pressable
                    key={q}
                    onPress={() => setQuartier(q)}
                    style={[
                      styles.pill,
                      { backgroundColor: quartier === q ? theme.primaryLight : theme.backgroundElement },
                    ]}>
                    <Text
                      style={{
                        color: quartier === q ? theme.primaryDark : theme.textSecondary,
                        fontSize: 12,
                        fontWeight: '600',
                      }}>
                      {q}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.cardBackground },
              ]}
              placeholder="Arrondissement (optionnel)"
              placeholderTextColor={theme.textSecondary}
              value={arrondissement}
              onChangeText={setArrondissement}
            />
            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.cardBackground },
              ]}
              placeholder="Quartier souhaité (optionnel)"
              placeholderTextColor={theme.textSecondary}
              value={quartier}
              onChangeText={setQuartier}
            />
            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.cardBackground },
              ]}
              placeholder="Budget maximum (F CFA) *"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
              value={budgetMax}
              onChangeText={setBudgetMax}
            />
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.cardBorder,
                  backgroundColor: theme.cardBackground,
                  minHeight: 100,
                  textAlignVertical: 'top',
                },
              ]}
              placeholder="Critères particuliers (nombre de chambres, accès pavé, garage, proximité...)"
              placeholderTextColor={theme.textSecondary}
              multiline
              value={details}
              onChangeText={setDetails}
            />

            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveBtn, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]}>
              <Text style={styles.saveBtnText}>
                {saving ? 'Enregistrement...' : 'Valider la demande'}
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  addBtn: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9 },
  addBtnText: { color: '#0F172A', fontWeight: '800', fontSize: 12 },
  list: { paddingTop: Spacing.three, gap: 12, maxWidth: 860, width: '100%', alignSelf: 'center' },
  feedbackBanner: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 4 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 6 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  refText: { fontSize: 11, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  budget: { fontSize: 16, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  empty: { alignItems: 'center', marginTop: 48, gap: 12 },
  gateBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  formScroll: { padding: Spacing.three, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 12, padding: 12 },
  errorText: { color: '#B91C1C', fontSize: 13, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '800' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  input: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14 },
  saveBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
