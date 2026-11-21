import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { KkiapayCheckoutModal } from '@/components/kkiapay-checkout-modal';
import { BENIN_COMMUNES } from '@/constants/locations';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { proprietesApi } from '@/services/api';
import type { PaymentOperationType } from '@/types/api';

type PickedAsset = {
  uri: string;
  name: string;
  mimeType: string;
  kind: 'image' | 'video';
  file?: File;
};

type PickedDocument = {
  uri: string;
  name: string;
  mimeType: string;
  docType: 'titre_foncier' | 'convention_vente' | 'permis_habiter' | 'attestation_recasement' | 'autre';
  file?: File;
};

async function appendPickedFileToFormData(
  formData: FormData,
  fieldName: string,
  item: { uri: string; name: string; mimeType: string; file?: File }
): Promise<void> {
  if (Platform.OS === 'web') {
    if (item.file) {
      formData.append(fieldName, item.file, item.name);
      return;
    }
    const response = await fetch(item.uri);
    const blob = await response.blob();
    formData.append(fieldName, blob, item.name);
    return;
  }

  formData.append(fieldName, {
    uri: item.uri,
    name: item.name,
    type: item.mimeType,
  } as any);
}

export default function PublishScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, openAuthModal, isAgentMobilier, isAdminStaff } = useAuth();

  const publicationFee = useMemo(() => {
    if (isAdminStaff) return 0;
    if (isAgentMobilier) return 100;
    return 500;
  }, [isAdminStaff, isAgentMobilier]);

  const paymentOperationType: PaymentOperationType = isAgentMobilier
    ? 'publication_agent'
    : 'publication_client';

  const [propertyType, setPropertyType] = useState<'parcelle' | 'maison' | 'chambre'>('maison');
  const [transactionType, setTransactionType] = useState<'vente' | 'location'>('location');
  const [commune, setCommune] = useState('Cotonou');
  const [arrondissement, setArrondissement] = useState('');
  const [quartier, setQuartier] = useState('');
  const [locationDetails, setLocationDetails] = useState('');
  const [accessibilite, setAccessibilite] = useState('Voie pavée accessible');
  const [eauCourant, setEauCourant] = useState('SONEB + SBEE (Compteur personnel)');
  const [surface, setSurface] = useState('');
  const [chambres, setChambres] = useState('2');
  const [avanceMois, setAvanceMois] = useState('3');
  const [prix, setPrix] = useState('');
  const [isNegotiable, setIsNegotiable] = useState(true);
  const [description, setDescription] = useState('');

  const [medias, setMedias] = useState<PickedAsset[]>([]);
  const [documents, setDocuments] = useState<PickedDocument[]>([]);
  const [selectedDocType, setSelectedDocType] =
    useState<PickedDocument['docType']>('titre_foncier');

  const [submitting, setSubmitting] = useState(false);
  const [checkoutVisible, setCheckoutVisible] = useState(false);

  const handleSelectType = (nextType: 'parcelle' | 'maison' | 'chambre') => {
    setPropertyType(nextType);
    if (nextType === 'parcelle' && transactionType === 'location') {
      setTransactionType('vente');
    }
  };

  const pickMedia = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (res.canceled) return;

    const added: PickedAsset[] = res.assets.map((asset, idx) => {
      const isVideo = asset.type === 'video';
      const fallbackName = isVideo ? `video_${Date.now()}_${idx}.mp4` : `photo_${Date.now()}_${idx}.jpg`;
      return {
        uri: asset.uri,
        name: asset.fileName || fallbackName,
        mimeType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
        kind: isVideo ? 'video' : 'image',
        file: (asset as any).file,
      };
    });
    setMedias((prev) => [...prev, ...added]);
  };

  const pickLegalDocument = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const file = res.assets[0];
    setDocuments((prev) => [
      ...prev,
      {
        uri: file.uri,
        name: file.name || `document_${Date.now()}.pdf`,
        mimeType: file.mimeType || 'application/pdf',
        docType: selectedDocType,
        file: (file as any).file,
      },
    ]);
  };

  const validateForm = (): string | null => {
    if (propertyType === 'parcelle' && transactionType === 'location') {
      return 'Une parcelle ne peut pas être mise en location.';
    }
    if (!arrondissement.trim() || !quartier.trim()) {
      return "L'arrondissement et le quartier sont obligatoires.";
    }
    if (!accessibilite.trim() || !eauCourant.trim()) {
      return "L'accessibilité et l'accès eau/électricité sont obligatoires.";
    }
    if (!surface.trim() || Number(surface) < 1) {
      return 'Veuillez indiquer une surface valide en m².';
    }
    if (!prix.trim() || Number(prix) <= 0) {
      return 'Veuillez indiquer un prix valide en F CFA.';
    }
    if (transactionType === 'location' && (!avanceMois.trim() || Number(avanceMois) < 0)) {
      return "Veuillez indiquer le nombre de mois d'avance.";
    }
    if (medias.length === 0) {
      return 'Ajoutez au moins une photo ou vidéo du bien (requis par le backend).';
    }
    if (transactionType === 'vente' && (propertyType === 'parcelle' || propertyType === 'maison') && documents.length === 0) {
      return 'Pour une vente de maison ou parcelle, au moins un document justificatif (titre foncier, convention...) est obligatoire.';
    }
    return null;
  };

  const submitPropertyToBackend = async (kkiapayTxId?: string) => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('type', propertyType);
      formData.append('transaction_type', transactionType);
      formData.append('commune', commune);
      formData.append('arrondissement', arrondissement.trim());
      formData.append('quartier', quartier.trim());
      if (locationDetails.trim()) formData.append('location_details', locationDetails.trim());
      formData.append('accessibilite', accessibilite.trim());
      formData.append('eau_courant', eauCourant.trim());
      formData.append('surface', String(Number(surface)));
      formData.append('nombres_chambres', propertyType === 'parcelle' ? '0' : String(Number(chambres) || 0));
      formData.append('avance_mois', transactionType === 'location' ? String(Number(avanceMois) || 0) : '0');
      formData.append('prix', String(Number(prix)));
      formData.append('is_negotiable', isNegotiable ? '1' : '0');
      if (description.trim()) formData.append('description', description.trim());
      if (kkiapayTxId) formData.append('kkiapay_transaction_id', kkiapayTxId);

      for (const m of medias) {
        const field = m.kind === 'video' ? 'videos[]' : 'photos[]';
        await appendPickedFileToFormData(formData, field, m);
      }

      for (let idx = 0; idx < documents.length; idx++) {
        const doc = documents[idx];
        await appendPickedFileToFormData(formData, `documents[${idx}]`, doc);
        formData.append(`document_types[${idx}]`, doc.docType);
      }

      const res = await proprietesApi.create(formData);
      if (!res.success) {
        const errText = res.errors
          ? Object.values(res.errors).flat().join('\n')
          : res.message || 'Erreur lors de la publication.';
        Alert.alert('Publication refusée', errText);
        return;
      }

      Alert.alert(
        'Annonce soumise !',
        res.message || 'Votre bien a été enregistré et transmis pour modération.',
        [
          { text: 'Voir mes annonces', onPress: () => router.push('/my-properties' as any) },
          { text: 'OK' },
        ]
      );

      setArrondissement('');
      setQuartier('');
      setLocationDetails('');
      setSurface('');
      setPrix('');
      setDescription('');
      setMedias([]);
      setDocuments([]);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishPress = () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    const validationErr = validateForm();
    if (validationErr) {
      Alert.alert('Formulaire incomplet', validationErr);
      return;
    }
    if (publicationFee > 0) {
      setCheckoutVisible(true);
    } else {
      void submitPropertyToBackend();
    }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.authGate}>
          <Text style={[styles.gateTitle, { color: theme.text }]}>Publier un bien sur E-Mobilier</Text>
          <Text style={[styles.gateDesc, { color: theme.textSecondary }]}>
            Connectez-vous en tant que Client (500 F) ou Agent mobilier (100 F) pour déposer une annonce.
          </Text>
          <Pressable onPress={() => openAuthModal('login')} style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
            <Text style={styles.primaryBtnText}>Se connecter</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: BottomTabInset + Spacing.six + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}>
          <Text style={[styles.pageTitle, { color: theme.text }]}>Déposer une annonce</Text>

          {/* Role Fee Banner */}
          <View style={[styles.feeBanner, { backgroundColor: theme.navy }]}>
            <Text style={styles.feeLabel}>
              Tarif de publication ({isAdminStaff ? 'Admin' : isAgentMobilier ? 'Agent mobilier' : 'Client'})
            </Text>
            <Text style={[styles.feeValue, { color: theme.gold }]}>
              {publicationFee === 0 ? 'Gratuit (Dispensé)' : `${publicationFee} F CFA via Kkiapay`}
            </Text>
          </View>

          {/* 1. Type & Opération */}
          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>1. Type de bien & Opération</Text>
            <View style={styles.rowWrap}>
              {(['maison', 'parcelle', 'chambre'] as const).map((t) => {
                const active = propertyType === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => handleSelectType(t)}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: active ? theme.primary : theme.backgroundElement,
                        borderColor: active ? theme.primary : 'transparent',
                      },
                    ]}>
                    <Text style={{ color: active ? '#FFFFFF' : theme.text, fontWeight: '700', textTransform: 'capitalize' }}>
                      {t}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.rowWrap}>
              {(['vente', 'location'] as const).map((tr) => {
                const disabled = propertyType === 'parcelle' && tr === 'location';
                const active = transactionType === tr;
                return (
                  <Pressable
                    key={tr}
                    disabled={disabled}
                    onPress={() => setTransactionType(tr)}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: active ? theme.gold : theme.backgroundElement,
                        opacity: disabled ? 0.4 : 1,
                      },
                    ]}>
                    <Text style={{ color: active ? '#0F172A' : theme.text, fontWeight: '700', textTransform: 'capitalize' }}>
                      {tr}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 2. Localisation */}
          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>2. Localisation</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowWrap}>
              {BENIN_COMMUNES.filter((c) => c !== 'Toutes les communes').map((c) => {
                const active = commune === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCommune(c)}
                    style={[
                      styles.pill,
                      { backgroundColor: active ? theme.navy : theme.backgroundElement },
                    ]}>
                    <Text style={{ color: active ? '#FFFFFF' : theme.text, fontWeight: '600', fontSize: 13 }}>
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
              placeholder="Arrondissement * (ex: 12ème Arrondissement)"
              placeholderTextColor={theme.textSecondary}
              value={arrondissement}
              onChangeText={setArrondissement}
            />
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
              placeholder="Quartier * (ex: Fidjrossè)"
              placeholderTextColor={theme.textSecondary}
              value={quartier}
              onChangeText={setQuartier}
            />
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
              placeholder="Repères d'accès (masqué avant déblocage 50 F)"
              placeholderTextColor={theme.textSecondary}
              value={locationDetails}
              onChangeText={setLocationDetails}
            />
          </View>

          {/* 3. Caractéristiques & Prix */}
          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>3. Caractéristiques & Prix</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
              placeholder="Accessibilité * (ex: Voie pavée, Goudron à 100m)"
              placeholderTextColor={theme.textSecondary}
              value={accessibilite}
              onChangeText={setAccessibilite}
            />
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
              placeholder="Eau & Courant * (ex: SONEB + SBEE)"
              placeholderTextColor={theme.textSecondary}
              value={eauCourant}
              onChangeText={setEauCourant}
            />
            <View style={styles.rowWrap}>
              <TextInput
                style={[styles.input, styles.half, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
                placeholder="Surface (m²) *"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                value={surface}
                onChangeText={setSurface}
              />
              {propertyType !== 'parcelle' && (
                <TextInput
                  style={[styles.input, styles.half, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
                  placeholder="Chambres"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  value={chambres}
                  onChangeText={setChambres}
                />
              )}
            </View>
            <View style={styles.rowWrap}>
              <TextInput
                style={[styles.input, styles.half, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
                placeholder={transactionType === 'location' ? 'Loyer/mois (F) *' : 'Prix (F CFA) *'}
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                value={prix}
                onChangeText={setPrix}
              />
              {transactionType === 'location' && (
                <TextInput
                  style={[styles.input, styles.half, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
                  placeholder="Avance (mois) *"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  value={avanceMois}
                  onChangeText={setAvanceMois}
                />
              )}
            </View>

            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: theme.text }]}>Prix négociable</Text>
              <Switch value={isNegotiable} onValueChange={setIsNegotiable} trackColor={{ true: theme.primary }} />
            </View>

            <TextInput
              style={[styles.textArea, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
              placeholder="Description détaillée du bien..."
              placeholderTextColor={theme.textSecondary}
              multiline
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* 4. Médias */}
          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>4. Photos & Vidéos ({medias.length})</Text>
            <Pressable onPress={pickMedia} style={[styles.uploadBtn, { borderColor: theme.primary }]}>
              <Text style={[styles.uploadBtnText, { color: theme.primary }]}>+ Ajouter des photos / vidéos</Text>
            </Pressable>
            {medias.map((m, idx) => (
              <View key={`${m.uri}-${idx}`} style={styles.fileRow}>
                <Text numberOfLines={1} style={[styles.fileName, { color: theme.text }]}>
                  {m.kind === 'video' ? '🎬' : '🖼️'} {m.name}
                </Text>
                <Pressable onPress={() => setMedias((prev) => prev.filter((_, i) => i !== idx))}>
                  <Text style={styles.removeText}>Retirer</Text>
                </Pressable>
              </View>
            ))}
          </View>

          {/* 5. Documents légaux (requis en vente) */}
          {transactionType === 'vente' && (
            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                5. Documents justificatifs ({documents.length}) *
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowWrap}>
                {(
                  [
                    { key: 'titre_foncier', label: 'Titre Foncier' },
                    { key: 'convention_vente', label: 'Convention' },
                    { key: 'permis_habiter', label: 'Permis Habiter' },
                    { key: 'attestation_recasement', label: 'Recasement' },
                    { key: 'autre', label: 'Autre' },
                  ] as const
                ).map((d) => {
                  const active = selectedDocType === d.key;
                  return (
                    <Pressable
                      key={d.key}
                      onPress={() => setSelectedDocType(d.key)}
                      style={[
                        styles.pill,
                        { backgroundColor: active ? theme.primary : theme.backgroundElement },
                      ]}>
                      <Text style={{ color: active ? '#FFFFFF' : theme.text, fontSize: 12, fontWeight: '600' }}>
                        {d.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Pressable onPress={pickLegalDocument} style={[styles.uploadBtn, { borderColor: theme.gold }]}>
                <Text style={[styles.uploadBtnText, { color: theme.text }]}>+ Joindre un document (PDF/Image)</Text>
              </Pressable>

              {documents.map((doc, idx) => (
                <View key={`${doc.uri}-${idx}`} style={styles.fileRow}>
                  <Text numberOfLines={1} style={[styles.fileName, { color: theme.text }]}>
                    📄 [{doc.docType}] {doc.name}
                  </Text>
                  <Pressable onPress={() => setDocuments((prev) => prev.filter((_, i) => i !== idx))}>
                    <Text style={styles.removeText}>Retirer</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <Pressable
            onPress={handlePublishPress}
            disabled={submitting}
            style={[styles.primaryBtn, { backgroundColor: theme.primary, opacity: submitting ? 0.7 : 1 }]}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {publicationFee > 0
                  ? `Payer ${publicationFee} F & Publier`
                  : 'Publier le bien maintenant'}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <KkiapayCheckoutModal
        visible={checkoutVisible}
        operationType={paymentOperationType}
        title="Frais de publication E-Mobilier"
        description={`Règlement officiel de ${publicationFee} F CFA pour publier votre annonce immobilière.`}
        onClose={() => setCheckoutVisible(false)}
        onSuccess={async ({ transactionId }) => {
          setCheckoutVisible(false);
          await submitPropertyToBackend(transactionId);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.three, gap: Spacing.three },
  pageTitle: { fontSize: 22, fontWeight: '900' },
  feeBanner: { borderRadius: 16, padding: Spacing.three, gap: 4 },
  feeLabel: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  feeValue: { fontSize: 17, fontWeight: '900' },
  card: { borderRadius: 18, borderWidth: 1, padding: Spacing.three, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: 'transparent' },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  half: { flex: 1 },
  textArea: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 88,
    textAlignVertical: 'top',
  },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: 14, fontWeight: '600' },
  uploadBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  uploadBtnText: { fontSize: 13, fontWeight: '800' },
  fileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  fileName: { flex: 1, fontSize: 12, fontWeight: '600' },
  removeText: { color: '#DC2626', fontSize: 12, fontWeight: '700' },
  primaryBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  authGate: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.five, gap: 12 },
  gateTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  gateDesc: { fontSize: 14, textAlign: 'center' },
});
