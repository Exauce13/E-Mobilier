import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

import { KkiapayCheckoutModal } from '@/components/kkiapay-checkout-modal';
import { BENIN_COMMUNES, QUARTIERS_BY_COMMUNE } from '@/constants/locations';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { proprietesApi } from '@/services/api';
import type { PaymentOperationType } from '@/types/api';

type PickedAsset = {
  uri: string;
  name: string;
  mimeType: string;
  kind: 'image' | 'video';
};

type PickedDocument = {
  uri: string;
  name: string;
  mimeType: string;
  docType: 'titre_foncier' | 'convention_vente' | 'permis_habiter' | 'attestation_recasement' | 'autre';
};

type PublishFieldErrors = Partial<
  Record<
    | 'transaction'
    | 'arrondissement'
    | 'quartier'
    | 'accessibilite'
    | 'eauCourant'
    | 'surface'
    | 'prix'
    | 'avanceMois'
    | 'medias'
    | 'documents',
    string
  >
>;

interface PublishPropertyFormProps {
  mode: 'client' | 'agent';
  bottomPadding?: number;
}

async function appendFileToFormData(
  formData: FormData,
  field: string,
  file: { uri: string; name: string; mimeType: string }
) {
  if (Platform.OS === 'web') {
    const response = await fetch(file.uri);
    const blob = await response.blob();
    formData.append(field, blob, file.name);
  } else {
    formData.append(field, {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as any);
  }
}

export function PublishPropertyForm({ mode, bottomPadding = 40 }: PublishPropertyFormProps) {
  const theme = useTheme();
  const { twoColLayout, horizontalPadding } = useResponsive();
  const { isAuthenticated, openAuthModal, isAgentMobilier, isAdminStaff } = useAuth();

  const isAgentView = mode === 'agent';

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
  const [agentMandateRef, setAgentMandateRef] = useState('');
  const [description, setDescription] = useState('');

  const [medias, setMedias] = useState<PickedAsset[]>([]);
  const [documents, setDocuments] = useState<PickedDocument[]>([]);
  const [selectedDocType, setSelectedDocType] =
    useState<PickedDocument['docType']>('titre_foncier');

  const [errors, setErrors] = useState<PublishFieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ message: string; propertyId?: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutVisible, setCheckoutVisible] = useState(false);

  const quartiersSuggestions = (QUARTIERS_BY_COMMUNE[commune] || []).filter((q) => q !== 'Tous');

  const handleSelectType = (nextType: 'parcelle' | 'maison' | 'chambre') => {
    setPropertyType(nextType);
    if (nextType === 'parcelle' && transactionType === 'location') {
      setTransactionType('vente');
    }
    setErrors((prev) => ({ ...prev, transaction: undefined }));
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
      const fallbackName = isVideo
        ? `video_${Date.now()}_${idx}.mp4`
        : `photo_${Date.now()}_${idx}.jpg`;
      return {
        uri: asset.uri,
        name: asset.fileName || fallbackName,
        mimeType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
        kind: isVideo ? 'video' : 'image',
      };
    });
    setMedias((prev) => [...prev, ...added]);
    setErrors((prev) => ({ ...prev, medias: undefined }));
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
      },
    ]);
    setErrors((prev) => ({ ...prev, documents: undefined }));
  };

  const validateForm = (): PublishFieldErrors => {
    const next: PublishFieldErrors = {};
    if (propertyType === 'parcelle' && transactionType === 'location') {
      next.transaction = 'Une parcelle ne peut pas être mise en location.';
    }
    if (!arrondissement.trim()) {
      next.arrondissement = "L'arrondissement est obligatoire.";
    }
    if (!quartier.trim()) {
      next.quartier = 'Le quartier est obligatoire.';
    }
    if (!accessibilite.trim()) {
      next.accessibilite = "L'accessibilité du bien est obligatoire.";
    }
    if (!eauCourant.trim()) {
      next.eauCourant = "L'accès eau/électricité est obligatoire.";
    }
    if (!surface.trim() || Number(surface) < 1) {
      next.surface = 'Indiquez une surface valide (> 0 m²).';
    }
    if (!prix.trim() || Number(prix) <= 0) {
      next.prix = 'Indiquez un prix valide en F CFA.';
    }
    if (transactionType === 'location' && (!avanceMois.trim() || Number(avanceMois) < 0)) {
      next.avanceMois = "Indiquez le nombre de mois d'avance.";
    }
    if (medias.length === 0) {
      next.medias = 'Ajoutez au moins une photo ou vidéo du bien.';
    }
    if (
      transactionType === 'vente' &&
      (propertyType === 'parcelle' || propertyType === 'maison') &&
      documents.length === 0
    ) {
      next.documents =
        'Un document justificatif (titre foncier, convention...) est obligatoire pour une vente.';
    }
    return next;
  };

  const submitPropertyToBackend = async (kkiapayTxId?: string) => {
    setSubmitting(true);
    setGlobalError(null);
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
      formData.append(
        'nombres_chambres',
        propertyType === 'parcelle' ? '0' : String(Number(chambres) || 0)
      );
      formData.append(
        'avance_mois',
        transactionType === 'location' ? String(Number(avanceMois) || 0) : '0'
      );
      formData.append('prix', String(Number(prix)));
      formData.append('is_negotiable', isNegotiable ? '1' : '0');

      const finalDescription =
        isAgentView && agentMandateRef.trim()
          ? `[Réf. Mandat Agent : ${agentMandateRef.trim()}]\n${description.trim()}`.trim()
          : description.trim();
      if (finalDescription) formData.append('description', finalDescription);
      if (kkiapayTxId) formData.append('kkiapay_transaction_id', kkiapayTxId);

      for (const m of medias) {
        const field = m.kind === 'video' ? 'videos[]' : 'photos[]';
        await appendFileToFormData(formData, field, m);
      }

      for (let idx = 0; idx < documents.length; idx++) {
        const doc = documents[idx];
        await appendFileToFormData(formData, `documents[${idx}]`, doc);
        formData.append(`document_types[${idx}]`, doc.docType);
      }

      const res = await proprietesApi.create(formData);
      if (!res.success) {
        const errText = res.errors
          ? Object.values(res.errors).flat().join('\n')
          : res.message || 'Erreur lors de la publication.';
        setGlobalError(errText);
        return;
      }

      setSuccessInfo({
        message:
          res.message || 'Votre annonce a été publiée et transmise pour modération E-Mobilier.',
        propertyId: res.data?.id ?? res.data?.propriete?.id,
      });

      setArrondissement('');
      setQuartier('');
      setLocationDetails('');
      setSurface('');
      setPrix('');
      setAgentMandateRef('');
      setDescription('');
      setMedias([]);
      setDocuments([]);
      setErrors({});
    } catch (e: any) {
      setGlobalError(e?.message || 'Erreur réseau lors de l’envoi des fichiers.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishPress = () => {
    setGlobalError(null);
    setSuccessInfo(null);
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    const nextErrors = validateForm();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setGlobalError('Veuillez corriger les champs signalés en rouge.');
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
      <View style={[styles.authGateWrap, { paddingHorizontal: horizontalPadding }]}>
        <View
          style={[
            styles.authGateCard,
            { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
          ]}>
          <Text style={{ fontSize: 36 }}>{isAgentView ? '🏢' : '🏠'}</Text>
          <Text style={[styles.gateTitle, { color: theme.text }]}>
            {isAgentView
              ? 'Publication d’annonce — Agent Immobilier'
              : 'Publication d’annonce — Client / Propriétaire'}
          </Text>
          <Text style={[styles.gateDesc, { color: theme.textSecondary }]}>
            {isAgentView
              ? 'Connectez-vous avec votre compte Agent Immobilier pour publier au tarif préférentiel de 100 F CFA et suivre vos prospects.'
              : 'Connectez-vous à votre compte Client pour déposer votre maison, chambre ou parcelle (500 F CFA) avec contrôle des titres.'}
          </Text>
          <View style={styles.gateBtns}>
            <Pressable
              onPress={() => openAuthModal('login')}
              style={[styles.primaryBtn, { backgroundColor: theme.primary, flex: 1 }]}>
              <Text style={styles.primaryBtnText}>Se connecter</Text>
            </Pressable>
            <Pressable
              onPress={() => openAuthModal('register')}
              style={[styles.secondaryBtn, { borderColor: theme.primary, flex: 1 }]}>
              <Text style={[styles.secondaryBtnText, { color: theme.primary }]}>Créer un compte</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingHorizontal: horizontalPadding, paddingBottom: bottomPadding },
        ]}>
        <View style={styles.innerWrap}>
          {/* Mode & Fee Banner */}
          <View style={[styles.feeBanner, { backgroundColor: theme.navy }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.feeEyebrow}>
                {isAgentView
                  ? '✦ PUBLICATION PROFESSIONNELLE AGENT'
                  : '✦ PUBLICATION PARTICULIER / CLIENT'}
              </Text>
              <Text style={styles.feeTitle}>
                {isAgentView
                  ? 'Déposer un bien dans votre portefeuille Agent'
                  : 'Mettre mon bien en vente ou en location'}
              </Text>
              <Text style={styles.feeSub}>
                Tarif appliqué à votre profil ({isAdminStaff ? 'Admin' : isAgentMobilier ? 'Agent mobilier' : 'Client'}) :{' '}
                <Text style={{ color: '#FDE68A', fontWeight: '900' }}>
                  {publicationFee === 0 ? 'Gratuit' : `${publicationFee} F CFA via Kkiapay`}
                </Text>
              </Text>
            </View>
            <Pressable
              onPress={() => router.push((isAgentView ? '/agent' : '/my-properties') as any)}
              style={styles.bannerLinkBtn}>
              <Text style={styles.bannerLinkText}>
                {isAgentView ? 'Mon Tableau Agent' : 'Mes Annonces'}
              </Text>
            </Pressable>
          </View>

          {successInfo && (
            <View style={styles.successBox}>
              <Text style={styles.successTitle}>Annonce publiée avec succès !</Text>
              <Text style={styles.successText}>{successInfo.message}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <Pressable
                  onPress={() => router.push((isAgentView ? '/agent' : '/my-properties') as any)}
                  style={[styles.primaryBtn, { backgroundColor: theme.primary, paddingHorizontal: 18 }]}>
                  <Text style={styles.primaryBtnText}>
                    {isAgentView ? 'Voir dans mon Tableau Agent' : 'Voir mes annonces'}
                  </Text>
                </Pressable>
                {successInfo.propertyId ? (
                  <Pressable
                    onPress={() => router.push(`/property/${successInfo.propertyId}` as any)}
                    style={[styles.secondaryBtn, { borderColor: '#047857', paddingHorizontal: 16 }]}>
                    <Text style={{ color: '#047857', fontWeight: '800', fontSize: 13 }}>
                      Ouvrir la fiche
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}

          {globalError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>⚠️ {globalError}</Text>
            </View>
          )}

          {/* 1. Type & Transaction */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
            ]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              1. Catégorie & Type d’opération
            </Text>

            <View style={twoColLayout ? styles.twoCol : styles.oneCol}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Type de bien *</Text>
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
                            borderColor: active ? theme.primary : theme.cardBorder,
                          },
                        ]}>
                        <Text
                          style={{
                            color: active ? '#FFFFFF' : theme.text,
                            fontWeight: '700',
                            textTransform: 'capitalize',
                          }}>
                          {t}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Opération *</Text>
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
                            backgroundColor: active ? '#F59E0B' : theme.backgroundElement,
                            borderColor: active ? '#F59E0B' : theme.cardBorder,
                            opacity: disabled ? 0.4 : 1,
                          },
                        ]}>
                        <Text
                          style={{
                            color: active ? '#0F172A' : theme.text,
                            fontWeight: '800',
                            textTransform: 'capitalize',
                          }}>
                          {tr}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {errors.transaction ? (
                  <Text style={styles.fieldError}>{errors.transaction}</Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* 2. Localisation */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
            ]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>2. Localisation du bien</Text>

            <Text style={[styles.label, { color: theme.text }]}>Commune *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowWrap}>
              {BENIN_COMMUNES.filter((c) => c !== 'Toutes les communes').map((c) => {
                const active = commune === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => {
                      setCommune(c);
                      setQuartier('');
                    }}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: active ? theme.navy : theme.backgroundElement,
                        borderColor: active ? theme.navy : theme.cardBorder,
                      },
                    ]}>
                    <Text style={{ color: active ? '#FFFFFF' : theme.text, fontWeight: '700', fontSize: 12 }}>
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {quartiersSuggestions.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowWrap}>
                {quartiersSuggestions.map((q) => {
                  const active = quartier === q;
                  return (
                    <Pressable
                      key={q}
                      onPress={() => {
                        setQuartier(q);
                        if (errors.quartier) setErrors((p) => ({ ...p, quartier: undefined }));
                      }}
                      style={[
                        styles.pill,
                        {
                          backgroundColor: active ? theme.primaryLight : theme.backgroundElement,
                          borderColor: active ? theme.primary : theme.cardBorder,
                        },
                      ]}>
                      <Text
                        style={{
                          color: active ? theme.primaryDark : theme.textSecondary,
                          fontSize: 12,
                          fontWeight: '600',
                        }}>
                        {q}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <View style={twoColLayout ? styles.twoCol : styles.oneCol}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Arrondissement *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      backgroundColor: theme.backgroundElement,
                      borderColor: errors.arrondissement ? '#DC2626' : theme.cardBorder,
                    },
                  ]}
                  placeholder="Ex: 12ème Arrondissement"
                  placeholderTextColor={theme.textSecondary}
                  value={arrondissement}
                  onChangeText={(v) => {
                    setArrondissement(v);
                    if (errors.arrondissement) setErrors((p) => ({ ...p, arrondissement: undefined }));
                  }}
                />
                {errors.arrondissement ? (
                  <Text style={styles.fieldError}>{errors.arrondissement}</Text>
                ) : null}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Quartier *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      backgroundColor: theme.backgroundElement,
                      borderColor: errors.quartier ? '#DC2626' : theme.cardBorder,
                    },
                  ]}
                  placeholder="Ex: Fidjrossè"
                  placeholderTextColor={theme.textSecondary}
                  value={quartier}
                  onChangeText={(v) => {
                    setQuartier(v);
                    if (errors.quartier) setErrors((p) => ({ ...p, quartier: undefined }));
                  }}
                />
                {errors.quartier ? <Text style={styles.fieldError}>{errors.quartier}</Text> : null}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>
                Repères précis (protégés avant déblocage 50 F)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.cardBorder,
                  },
                ]}
                placeholder="Ex: 2ème rue à droite après la pharmacie..."
                placeholderTextColor={theme.textSecondary}
                value={locationDetails}
                onChangeText={setLocationDetails}
              />
            </View>
          </View>

          {/* 3. Caractéristiques & Prix */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
            ]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              3. Caractéristiques & Tarification
            </Text>

            <View style={twoColLayout ? styles.twoCol : styles.oneCol}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Accessibilité *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      backgroundColor: theme.backgroundElement,
                      borderColor: errors.accessibilite ? '#DC2626' : theme.cardBorder,
                    },
                  ]}
                  placeholder="Ex: Voie pavée, Goudron à 100m"
                  placeholderTextColor={theme.textSecondary}
                  value={accessibilite}
                  onChangeText={(v) => {
                    setAccessibilite(v);
                    if (errors.accessibilite) setErrors((p) => ({ ...p, accessibilite: undefined }));
                  }}
                />
                {errors.accessibilite ? (
                  <Text style={styles.fieldError}>{errors.accessibilite}</Text>
                ) : null}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Eau & Électricité *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      backgroundColor: theme.backgroundElement,
                      borderColor: errors.eauCourant ? '#DC2626' : theme.cardBorder,
                    },
                  ]}
                  placeholder="Ex: SONEB + SBEE (Compteur personnel)"
                  placeholderTextColor={theme.textSecondary}
                  value={eauCourant}
                  onChangeText={(v) => {
                    setEauCourant(v);
                    if (errors.eauCourant) setErrors((p) => ({ ...p, eauCourant: undefined }));
                  }}
                />
                {errors.eauCourant ? (
                  <Text style={styles.fieldError}>{errors.eauCourant}</Text>
                ) : null}
              </View>
            </View>

            <View style={twoColLayout ? styles.twoCol : styles.oneCol}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Surface (m²) *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      backgroundColor: theme.backgroundElement,
                      borderColor: errors.surface ? '#DC2626' : theme.cardBorder,
                    },
                  ]}
                  placeholder="Ex: 300"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  value={surface}
                  onChangeText={(v) => {
                    setSurface(v);
                    if (errors.surface) setErrors((p) => ({ ...p, surface: undefined }));
                  }}
                />
                {errors.surface ? <Text style={styles.fieldError}>{errors.surface}</Text> : null}
              </View>

              {propertyType !== 'parcelle' && (
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.text }]}>Nombre de chambres</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: theme.text,
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                    placeholder="Ex: 3"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    value={chambres}
                    onChangeText={setChambres}
                  />
                </View>
              )}
            </View>

            <View style={twoColLayout ? styles.twoCol : styles.oneCol}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>
                  {transactionType === 'location' ? 'Loyer mensuel (F CFA) *' : 'Prix de vente (F CFA) *'}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      backgroundColor: theme.backgroundElement,
                      borderColor: errors.prix ? '#DC2626' : theme.cardBorder,
                    },
                  ]}
                  placeholder={transactionType === 'location' ? 'Ex: 150000' : 'Ex: 35000000'}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  value={prix}
                  onChangeText={(v) => {
                    setPrix(v);
                    if (errors.prix) setErrors((p) => ({ ...p, prix: undefined }));
                  }}
                />
                {errors.prix ? <Text style={styles.fieldError}>{errors.prix}</Text> : null}
              </View>

              {transactionType === 'location' && (
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.text }]}>Avance (mois) *</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: theme.text,
                        backgroundColor: theme.backgroundElement,
                        borderColor: errors.avanceMois ? '#DC2626' : theme.cardBorder,
                      },
                    ]}
                    placeholder="Ex: 3"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    value={avanceMois}
                    onChangeText={(v) => {
                      setAvanceMois(v);
                      if (errors.avanceMois) setErrors((p) => ({ ...p, avanceMois: undefined }));
                    }}
                  />
                  {errors.avanceMois ? (
                    <Text style={styles.fieldError}>{errors.avanceMois}</Text>
                  ) : null}
                </View>
              )}
            </View>

            {isAgentView && (
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>
                  Référence mandat / dossier agence (optionnel)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                  placeholder="Ex: MANDAT-COT-2026-014"
                  placeholderTextColor={theme.textSecondary}
                  value={agentMandateRef}
                  onChangeText={setAgentMandateRef}
                />
              </View>
            )}

            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: theme.text }]}>Prix négociable</Text>
              <Switch
                value={isNegotiable}
                onValueChange={setIsNegotiable}
                trackColor={{ false: '#CBD5E1', true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Description complète</Text>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    color: theme.text,
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.cardBorder,
                  },
                ]}
                placeholder="Décrivez les points forts : garage, cour, sanitaire, sécurité, proximité écoles/marché..."
                placeholderTextColor={theme.textSecondary}
                multiline
                value={description}
                onChangeText={setDescription}
              />
            </View>
          </View>

          {/* 4. Médias */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.cardBackground,
                borderColor: errors.medias ? '#DC2626' : theme.cardBorder,
              },
            ]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              4. Photos & Vidéos ({medias.length}) *
            </Text>
            <Pressable onPress={pickMedia} style={[styles.uploadBtn, { borderColor: theme.primary }]}>
              <Text style={[styles.uploadBtnText, { color: theme.primary }]}>
                + Sélectionner des photos ou vidéos
              </Text>
            </Pressable>
            {errors.medias ? <Text style={styles.fieldError}>{errors.medias}</Text> : null}

            {medias.length > 0 && (
              <View style={styles.previewGrid}>
                {medias.map((m, idx) => (
                  <View
                    key={`${m.uri}-${idx}`}
                    style={[styles.previewCard, { borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}>
                    {m.kind === 'image' ? (
                      <Image source={{ uri: m.uri }} style={styles.previewThumb} contentFit="cover" />
                    ) : (
                      <View style={[styles.previewThumb, { alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ fontSize: 26 }}>🎬</Text>
                      </View>
                    )}
                    <Text numberOfLines={1} style={[styles.previewName, { color: theme.text }]}>
                      {m.name}
                    </Text>
                    <Pressable onPress={() => setMedias((prev) => prev.filter((_, i) => i !== idx))}>
                      <Text style={styles.removeText}>Retirer</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* 5. Documents justificatifs (vente) */}
          {transactionType === 'vente' && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: errors.documents ? '#DC2626' : theme.cardBorder,
                },
              ]}>
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
                        {
                          backgroundColor: active ? theme.primary : theme.backgroundElement,
                          borderColor: active ? theme.primary : theme.cardBorder,
                        },
                      ]}>
                      <Text style={{ color: active ? '#FFFFFF' : theme.text, fontSize: 12, fontWeight: '700' }}>
                        {d.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Pressable onPress={pickLegalDocument} style={[styles.uploadBtn, { borderColor: '#F59E0B' }]}>
                <Text style={[styles.uploadBtnText, { color: theme.text }]}>
                  + Joindre un document (PDF ou Image — max 12 Mo)
                </Text>
              </Pressable>
              {errors.documents ? <Text style={styles.fieldError}>{errors.documents}</Text> : null}

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

          {/* Submit Button */}
          <Pressable
            onPress={handlePublishPress}
            disabled={submitting}
            style={[
              styles.primaryBtn,
              { backgroundColor: theme.primary, opacity: submitting ? 0.7 : 1 },
            ]}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {publicationFee > 0
                  ? `Payer ${publicationFee} F CFA & Publier`
                  : 'Publier le bien maintenant'}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: Spacing.three },
  innerWrap: { width: '100%', maxWidth: 900, alignSelf: 'center', gap: 16 },
  feeBanner: {
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  feeEyebrow: { color: '#FDE68A', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  feeTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  feeSub: { color: '#CBD5E1', fontSize: 13 },
  bannerLinkBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 11,
  },
  bannerLinkText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
  },
  errorBannerText: { color: '#B91C1C', fontSize: 13, fontWeight: '700' },
  successBox: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 18,
    gap: 10,
  },
  successTitle: { color: '#065F46', fontSize: 17, fontWeight: '900' },
  successText: { color: '#047857', fontSize: 14, lineHeight: 20 },
  card: { borderRadius: 20, borderWidth: 1, padding: 18, gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '900' },
  twoCol: { flexDirection: 'row', gap: 14 },
  oneCol: { gap: 12 },
  fieldGroup: { flex: 1, gap: 5 },
  label: { fontSize: 13, fontWeight: '700' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  input: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
  },
  textArea: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  fieldError: { color: '#DC2626', fontSize: 12, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: 14, fontWeight: '700' },
  uploadBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  uploadBtnText: { fontSize: 13, fontWeight: '800' },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  previewCard: {
    width: 116,
    borderRadius: 12,
    borderWidth: 1,
    padding: 6,
    gap: 4,
    alignItems: 'center',
  },
  previewThumb: { width: '100%', height: 74, borderRadius: 8 },
  previewName: { fontSize: 11, fontWeight: '600' },
  fileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  fileName: { flex: 1, fontSize: 13, fontWeight: '600' },
  removeText: { color: '#DC2626', fontSize: 12, fontWeight: '800' },
  primaryBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700' },
  authGateWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 32 },
  authGateCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 22,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  gateTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  gateDesc: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  gateBtns: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 8 },
});
