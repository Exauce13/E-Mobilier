import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KkiapayCheckoutModal } from '@/components/kkiapay-checkout-modal';
import { InstitutionHeader } from '@/components/ui/institution-header';
import { BENIN_COMMUNES } from '@/constants/locations';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { proprietesApi } from '@/services/api';
import type { PaymentOperationType } from '@/types/api';
import { formatFcfa } from '@/types/property';

type PickedAsset = {
  uri: string;
  name: string;
  mimeType: string;
};

type DeclarantProfile = 'proprietaire' | 'agent_agree';
type LegalDocType = 'titre_foncier' | 'convention_notariee' | 'attestation_recasement';

export default function PublishScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, openAuthModal, isAgentMobilier, isAdminStaff } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Paramètres & Titre
  const [declarantProfile, setDeclarantProfile] = useState<DeclarantProfile>(
    isAgentMobilier ? 'agent_agree' : 'proprietaire'
  );
  const [propertyType, setPropertyType] = useState<'parcelle' | 'maison' | 'appartement'>('parcelle');
  const [transactionType, setTransactionType] = useState<'vente' | 'location'>('vente');
  const [legalDocType, setLegalDocType] = useState<LegalDocType>('titre_foncier');
  const [tfNumber, setTfNumber] = useState('');

  // Step 2: Informations du Foncier & Médias
  const [title, setTitle] = useState('');
  const [commune, setCommune] = useState('Abomey-Calavi');
  const [quartier, setQuartier] = useState('Zoundja');
  const [surface, setSurface] = useState('');
  const [prix, setPrix] = useState('');
  const [chambres, setChambres] = useState('0');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<PickedAsset[]>([]);
  const [documentFile, setDocumentFile] = useState<PickedAsset | null>(null);

  // Step 3: Charte & Paiement
  const [charteAccepted, setCharteAccepted] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [createdPropertyId, setCreatedPropertyId] = useState<number | null>(null);

  const publicationFee = useMemo(() => {
    if (isAdminStaff) return 0;
    if (declarantProfile === 'agent_agree') return 100;
    return 500;
  }, [isAdminStaff, declarantProfile]);

  const paymentOperationType: PaymentOperationType =
    declarantProfile === 'agent_agree' ? 'publication_agent' : 'publication_client';

  const handlePickImages = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 5,
        quality: 0.8,
      });

      if (!res.canceled && res.assets) {
        const picked = res.assets.map((a, i) => ({
          uri: a.uri,
          name: a.fileName || `photo_${Date.now()}_${i}.jpg`,
          mimeType: a.mimeType || 'image/jpeg',
        }));
        setPhotos((prev) => [...prev, ...picked].slice(0, 8));
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de sélectionner des images.');
    }
  };

  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const f = res.assets[0];
        setDocumentFile({
          uri: f.uri,
          name: f.name,
          mimeType: f.mimeType || 'application/pdf',
        });
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de charger le document.');
    }
  };

  const handleNextStep = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (!title.trim()) {
        Alert.alert('Champ requis', "Veuillez renseigner un titre pour l'annonce.");
        return;
      }
      if (!prix || Number(prix) <= 0) {
        Alert.alert('Champ requis', 'Veuillez saisir un prix valide en FCFA.');
        return;
      }
      setStep(3);
    }
  };

  const handleFinalSubmit = async () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    if (!charteAccepted) {
      Alert.alert('Charte requise', 'Veuillez accepter la charte de conformité foncière.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('titre', title.trim() || 'Bien foncier vérifié');
      formData.append('type', propertyType === 'parcelle' ? 'parcelle' : propertyType === 'maison' ? 'maison' : 'chambre');
      formData.append('transaction_type', transactionType);
      formData.append('commune', commune);
      formData.append('quartier', quartier || 'Centre');
      formData.append('prix', String(Number(prix.replace(/\s+/g, '')) || 1000000));
      formData.append('surface', String(Number(surface) || 500));
      formData.append('description', description.trim() || 'Bien foncier régularisé au cadastre national.');

      if (propertyType !== 'parcelle' && Number(chambres) > 0) {
        formData.append('nombres_chambres', chambres);
      }

      photos.forEach((p, idx) => {
        formData.append(`medias[${idx}]`, {
          uri: p.uri,
          name: p.name,
          type: p.mimeType,
        } as any);
      });

      if (documentFile) {
        formData.append('documents[0][file]', {
          uri: documentFile.uri,
          name: documentFile.name,
          type: documentFile.mimeType,
        } as any);
        formData.append('documents[0][type]', legalDocType);
      }

      const res = await proprietesApi.store(formData);
      if (res.success && res.data) {
        setCreatedPropertyId(Number(res.data.id));
        if (publicationFee > 0) {
          setCheckoutVisible(true);
        } else {
          Alert.alert(
            'Publication soumise',
            'Votre annonce est désormais en cours de validation par nos modérateurs fonciers.',
            [{ text: 'Voir le catalogue', onPress: () => router.replace('/' as any) }]
          );
        }
      } else {
        Alert.alert('Erreur', res.message || 'Impossible de créer la propriété.');
      }
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Erreur lors de la soumission.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <InstitutionHeader title="Publier Un Bien" showBack={step > 1} onBack={() => setStep((s) => (s - 1) as any)} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: BottomTabInset + Spacing.six + insets.bottom }]}>
        {/* STEPPER HEADER (STITCH) */}
        <View style={styles.stepperContainer}>
          <View style={styles.stepperTopRow}>
            <Text style={[styles.stepCurrentText, { color: theme.primaryContainer }]}>
              Étape {step} sur 3
            </Text>
            <Text style={[styles.stepTitleSub, { color: theme.textSecondary }]}>
              {step === 1
                ? '1. Paramètres & Titre'
                : step === 2
                ? '2. Géolocalisation & Documents'
                : '3. Validation Notariale'}
            </Text>
          </View>

          {/* Progress bar */}
          <View style={[styles.progressTrack, { backgroundColor: theme.surfaceContainerLow }]}>
            <View
              style={[
                styles.progressBar,
                {
                  backgroundColor: theme.primaryContainer,
                  width: step === 1 ? '33%' : step === 2 ? '66%' : '100%',
                },
              ]}
            />
          </View>
        </View>

        {/* STEP 1: PARAMÈTRES & TITRE */}
        {step === 1 && (
          <View style={styles.stepSection}>
            {/* Profil déclarant */}
            <View style={styles.fieldset}>
              <Text style={[styles.fieldsetHeading, { color: theme.text }]}>
                Profil déclarant
              </Text>
              <View style={styles.toggleRow}>
                <Pressable
                  onPress={() => setDeclarantProfile('proprietaire')}
                  style={[
                    styles.profileCard,
                    {
                      borderColor:
                        declarantProfile === 'proprietaire' ? theme.primaryContainer : theme.cardBorder,
                      backgroundColor:
                        declarantProfile === 'proprietaire' ? theme.badgeGreenBg : theme.surfaceContainerLowest,
                    },
                  ]}>
                  <SymbolView
                    name={{ ios: 'person.fill', android: 'person', web: 'person' }}
                    size={16}
                    tintColor={declarantProfile === 'proprietaire' ? theme.badgeGreenText : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.profileCardText,
                      { color: declarantProfile === 'proprietaire' ? theme.badgeGreenText : theme.text },
                    ]}>
                    Propriétaire (Client)
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setDeclarantProfile('agent_agree')}
                  style={[
                    styles.profileCard,
                    {
                      borderColor:
                        declarantProfile === 'agent_agree' ? theme.secondary : theme.cardBorder,
                      backgroundColor:
                        declarantProfile === 'agent_agree' ? theme.secondaryContainer : theme.surfaceContainerLowest,
                    },
                  ]}>
                  <SymbolView
                    name={{ ios: 'person.badge.shield.checkmark.fill', android: 'real_estate_agent', web: 'real_estate_agent' }}
                    size={16}
                    tintColor={declarantProfile === 'agent_agree' ? theme.navy : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.profileCardText,
                      { color: declarantProfile === 'agent_agree' ? theme.navy : theme.text },
                    ]}>
                    Agent Agréé BJ
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Nature du Patrimoine */}
            <View style={styles.fieldset}>
              <Text style={[styles.fieldsetHeading, { color: theme.text }]}>
                Nature du Patrimoine
              </Text>

              {/* Type de bien */}
              <View style={styles.selectorRow}>
                {[
                  { id: 'parcelle', label: 'Parcelle / Terrain', icon: 'landscape' },
                  { id: 'maison', label: 'Maison / Villa', icon: 'cottage' },
                  { id: 'appartement', label: 'Appartement', icon: 'apartment' },
                ].map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => setPropertyType(item.id as any)}
                    style={[
                      styles.naturePill,
                      {
                        backgroundColor:
                          propertyType === item.id ? theme.primaryContainer : theme.surfaceContainerLowest,
                        borderColor:
                          propertyType === item.id ? theme.primaryContainer : theme.cardBorder,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.naturePillText,
                        { color: propertyType === item.id ? '#FFFFFF' : theme.text },
                      ]}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Operation type: Vente vs Location */}
              <View style={[styles.opSelectorBar, { backgroundColor: theme.surfaceContainerLow }]}>
                <Pressable
                  onPress={() => setTransactionType('vente')}
                  style={[
                    styles.opTabBtn,
                    transactionType === 'vente' && { backgroundColor: theme.primaryContainer },
                  ]}>
                  <Text
                    style={[
                      styles.opTabText,
                      { color: transactionType === 'vente' ? '#FFFFFF' : theme.textSecondary },
                    ]}>
                    À Vendre (Vente Notariée)
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setTransactionType('location')}
                  style={[
                    styles.opTabBtn,
                    transactionType === 'location' && { backgroundColor: theme.navy },
                  ]}>
                  <Text
                    style={[
                      styles.opTabText,
                      { color: transactionType === 'location' ? '#FFFFFF' : theme.textSecondary },
                    ]}>
                    À Louer (Bail Sécurisé)
                  </Text>
                </Pressable>
              </View>

              {/* Titre de propriété */}
              <Text style={[styles.fieldSubLabel, { color: theme.textSecondary }]}>
                Titre de propriété juridique
              </Text>
              <View style={styles.docTypeCol}>
                {[
                  { id: 'titre_foncier', label: 'Titre Foncier (TF) • Vérifié ANDF' },
                  { id: 'convention_notariee', label: 'Convention Notariée Enregistrée' },
                  { id: 'attestation_recasement', label: 'Attestation de Recasement & Bornage' },
                ].map((doc) => (
                  <Pressable
                    key={doc.id}
                    onPress={() => setLegalDocType(doc.id as any)}
                    style={[
                      styles.docTypeRadio,
                      {
                        borderColor: legalDocType === doc.id ? theme.primaryContainer : theme.cardBorder,
                        backgroundColor:
                          legalDocType === doc.id ? theme.badgeGreenBg : theme.surfaceContainerLowest,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.docTypeText,
                        { color: legalDocType === doc.id ? theme.badgeGreenText : theme.text },
                      ]}>
                      {doc.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* N° Titre Foncier */}
              <Text style={[styles.fieldSubLabel, { color: theme.textSecondary }]}>
                Numéro du Titre Foncier / Référence ANDF
              </Text>
              <TextInput
                value={tfNumber}
                onChangeText={setTfNumber}
                placeholder="Ex: TF n° 14.821 / Littoral"
                placeholderTextColor={theme.outline}
                style={[
                  styles.textInputBox,
                  { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder, color: theme.text },
                ]}
              />
            </View>

            <Pressable
              onPress={handleNextStep}
              style={[styles.nextCtaBtn, { backgroundColor: theme.primaryContainer }]}>
              <Text style={styles.nextCtaBtnText}>Étape suivante : Géolocalisation</Text>
              <SymbolView
                name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
                size={16}
                tintColor="#FFFFFF"
              />
            </Pressable>
          </View>
        )}

        {/* STEP 2: GÉOLOCALISATION & MÉDIAS */}
        {step === 2 && (
          <View style={styles.stepSection}>
            <View style={styles.fieldset}>
              <Text style={[styles.fieldsetHeading, { color: theme.text }]}>
                Informations du Foncier
              </Text>

              {/* Title */}
              <Text style={[styles.fieldSubLabel, { color: theme.textSecondary }]}>Titre de l'annonce</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Ex: Belle Parcelle 500m² avec Titre Foncier Global n°4821"
                placeholderTextColor={theme.outline}
                style={[
                  styles.textInputBox,
                  { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder, color: theme.text },
                ]}
              />

              {/* Commune */}
              <Text style={[styles.fieldSubLabel, { color: theme.textSecondary }]}>Commune</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.communePillsRow}>
                {BENIN_COMMUNES.slice(0, 6).map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCommune(c)}
                    style={[
                      styles.naturePill,
                      {
                        backgroundColor: commune === c ? theme.primaryContainer : theme.surfaceContainerLowest,
                        borderColor: commune === c ? theme.primaryContainer : theme.cardBorder,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.naturePillText,
                        { color: commune === c ? '#FFFFFF' : theme.text },
                      ]}>
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Quartier / Zone */}
              <Text style={[styles.fieldSubLabel, { color: theme.textSecondary }]}>Quartier / Zone</Text>
              <TextInput
                value={quartier}
                onChangeText={setQuartier}
                placeholder="Ex: Zoundja, Togbin, Haie Vive..."
                placeholderTextColor={theme.outline}
                style={[
                  styles.textInputBox,
                  { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder, color: theme.text },
                ]}
              />

              {/* Surface & Prix */}
              <View style={styles.dualInputsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldSubLabel, { color: theme.textSecondary }]}>Superficie (m²)</Text>
                  <TextInput
                    value={surface}
                    onChangeText={setSurface}
                    placeholder="500"
                    placeholderTextColor={theme.outline}
                    keyboardType="numeric"
                    style={[
                      styles.textInputBox,
                      { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder, color: theme.text },
                    ]}
                  />
                </View>

                <View style={{ flex: 1.5 }}>
                  <Text style={[styles.fieldSubLabel, { color: theme.textSecondary }]}>Prix demandé (FCFA)</Text>
                  <TextInput
                    value={prix}
                    onChangeText={setPrix}
                    placeholder="18 500 000"
                    placeholderTextColor={theme.outline}
                    keyboardType="numeric"
                    style={[
                      styles.textInputBox,
                      { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder, color: theme.text },
                    ]}
                  />
                </View>
              </View>
            </View>

            {/* Médias & Justificatifs */}
            <View style={styles.fieldset}>
              <Text style={[styles.fieldsetHeading, { color: theme.text }]}>
                Médias & Justificatifs
              </Text>

              {/* Photo Upload */}
              <Text style={[styles.fieldSubLabel, { color: theme.textSecondary }]}>
                Photos du bien ({photos.length} sélectionnée{photos.length > 1 ? 's' : ''})
              </Text>
              <Pressable
                onPress={handlePickImages}
                style={[
                  styles.uploadBox,
                  { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
                ]}>
                <SymbolView
                  name={{ ios: 'photo.on.rectangle.angled', android: 'add_a_photo', web: 'add_a_photo' }}
                  size={24}
                  tintColor={theme.primaryContainer}
                />
                <Text style={[styles.uploadText, { color: theme.text }]}>
                  Ajouter des photos (Min. 3 recommandées)
                </Text>
              </Pressable>

              {/* Document Notarié Upload */}
              <Text style={[styles.fieldSubLabel, { color: theme.textSecondary }]}>
                Titre Foncier / Justificatif notarié (PDF ou photo)
              </Text>
              <Pressable
                onPress={handlePickDocument}
                style={[
                  styles.uploadBox,
                  {
                    backgroundColor: documentFile ? theme.badgeGreenBg : theme.surfaceContainerLowest,
                    borderColor: documentFile ? theme.primaryContainer : theme.cardBorder,
                  },
                ]}>
                <SymbolView
                  name={{ ios: 'doc.badge.plus', android: 'post_add', web: 'post_add' }}
                  size={24}
                  tintColor={documentFile ? theme.badgeGreenText : theme.primaryContainer}
                />
                <Text
                  style={[
                    styles.uploadText,
                    { color: documentFile ? theme.badgeGreenText : theme.text },
                  ]}>
                  {documentFile ? documentFile.name : 'Sélectionner le Titre Foncier (Crypté)'}
                </Text>
              </Pressable>
              <Text style={[styles.docSecurityNotice, { color: theme.textSecondary }]}>
                🔒 Le titre sera chiffré et audité uniquement par l'ANDF et les secrétaires notariaux.
              </Text>
            </View>

            <Pressable
              onPress={handleNextStep}
              style={[styles.nextCtaBtn, { backgroundColor: theme.primaryContainer }]}>
              <Text style={styles.nextCtaBtnText}>Étape suivante : Validation Notariale</Text>
              <SymbolView
                name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
                size={16}
                tintColor="#FFFFFF"
              />
            </Pressable>
          </View>
        )}

        {/* STEP 3: VALIDATION NOTARIALE & DÉPÔT */}
        {step === 3 && (
          <View style={styles.stepSection}>
            {/* Bordereau de Dépôt */}
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
              ]}>
              <Text style={[styles.summaryCardHeader, { color: theme.text }]}>
                Bordereau de Dépôt • BJ-REG-2025
              </Text>

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                  Frais de publication cadastrale
                </Text>
                <Text style={[styles.summaryVal, { color: theme.text }]}>
                  {formatFcfa(publicationFee)}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                  Vérification d'authenticité ANDF
                </Text>
                <Text style={[styles.summaryVal, { color: theme.badgeGreenText }]}>
                  Inclus (0 FCFA)
                </Text>
              </View>

              <View style={[styles.totalRow, { borderTopColor: theme.cardBorder }]}>
                <Text style={[styles.totalLabel, { color: theme.text }]}>Total à régler</Text>
                <Text style={[styles.totalPrice, { color: theme.primaryContainer }]}>
                  {formatFcfa(publicationFee)}
                </Text>
              </View>
            </View>

            {/* Charte Anti-Contournement */}
            <Pressable
              onPress={() => setCharteAccepted(!charteAccepted)}
              style={[
                styles.charteCard,
                { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder },
              ]}>
              <View
                style={[
                  styles.checkboxBox,
                  {
                    borderColor: charteAccepted ? theme.primaryContainer : theme.outline,
                    backgroundColor: charteAccepted ? theme.primaryContainer : 'transparent',
                  },
                ]}>
                {charteAccepted && (
                  <SymbolView
                    name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                    size={11}
                    tintColor="#FFFFFF"
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.charteTitle, { color: theme.text }]}>
                  Charte Foncier Bénin & Anti-Contournement
                </Text>
                <Text style={[styles.charteDesc, { color: theme.textSecondary }]}>
                  Je certifie sur l'honneur l'exactitude des informations et l'absence de tout litige foncier
                  en cours auprès du Tribunal ou de l'ANDF.
                </Text>
              </View>
            </Pressable>

            {/* Submit & Pay CTA */}
            <Pressable
              disabled={submitting}
              onPress={handleFinalSubmit}
              style={({ pressed }) => [
                styles.finalSubmitBtn,
                { backgroundColor: theme.primaryContainer },
                (pressed || submitting) && { opacity: 0.9 },
              ]}>
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <SymbolView
                    name={{ ios: 'creditcard.fill', android: 'payments', web: 'payments' }}
                    size={18}
                    tintColor="#FFFFFF"
                  />
                  <Text style={styles.finalSubmitBtnText}>
                    Payer via Kkiapay (Momo / Moov / Celtiis)
                  </Text>
                </>
              )}
            </Pressable>

            <View style={styles.securityTagRow}>
              <SymbolView
                name={{ ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' }}
                size={12}
                tintColor={theme.primaryContainer}
              />
              <Text style={[styles.securityTagText, { color: theme.textSecondary }]}>
                Conforme ARCEP Bénin • Séquestre Kkiapay sécurisé
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Kkiapay Modal */}
      {createdPropertyId && (
        <KkiapayCheckoutModal
          visible={checkoutVisible}
          onClose={() => setCheckoutVisible(false)}
          operationType={paymentOperationType}
          entityId={createdPropertyId}
          amount={publicationFee}
          title="Frais de Publication Cadastrale"
          description={`Publication et indexation notariée pour : ${title}`}
          onSuccess={() => {
            setCheckoutVisible(false);
            Alert.alert(
              'Paiement Validé',
              'Votre annonce a été soumise avec succès et est transmise à la modération notariée.',
              [{ text: 'Voir le catalogue', onPress: () => router.replace('/' as any) }]
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.four,
  },
  stepperContainer: {
    gap: 8,
  },
  stepperTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepCurrentText: {
    fontSize: 12,
    fontWeight: '800',
  },
  stepTitleSub: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  stepSection: {
    gap: Spacing.four,
  },
  fieldset: {
    gap: 10,
  },
  fieldsetHeading: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  profileCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  profileCardText: {
    fontSize: 12,
    fontWeight: '700',
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  naturePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  naturePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  opSelectorBar: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
    marginTop: 4,
  },
  opTabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  fieldSubLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  docTypeCol: {
    gap: 6,
  },
  docTypeRadio: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  docTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textInputBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 13,
  },
  communePillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dualInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  uploadBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  uploadText: {
    fontSize: 12,
    fontWeight: '700',
  },
  docSecurityNotice: {
    fontSize: 11,
    lineHeight: 15,
  },
  nextCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  nextCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
    gap: 10,
  },
  summaryCardHeader: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 12,
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  charteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  charteTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  charteDesc: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  finalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  finalSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  securityTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  securityTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
