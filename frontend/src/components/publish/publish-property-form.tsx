import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import {
  AlertTriangle,
  Building2,
  Camera,
  CheckCircle2,
  FileCheck2,
  FileText,
  Film,
  Home,
  KeyRound,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  Video,
} from 'lucide-react-native';
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
import { QUARTIERS_BY_COMMUNE } from '@/constants/locations';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { usePlatformConfig } from '@/context/platform-config-context';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { proprietesApi } from '@/services/api';
import type { PaymentOperationType } from '@/types/api';

const MAX_PHOTO_SIZE_BYTES = 12 * 1024 * 1024; // 12 Mo
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50 Mo
const MAX_DOC_SIZE_BYTES = 12 * 1024 * 1024; // 12 Mo
const MAX_PHOTOS_COUNT = 15;
const MAX_VIDEOS_COUNT = 5;
const MAX_DOCS_COUNT = 10;

const ALLOWED_IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp'];
const ALLOWED_VIDEO_EXT = ['mp4', 'mov', 'avi', 'webm', 'mkv'];
const ALLOWED_DOC_EXT = ['pdf', 'jpg', 'jpeg', 'png'];

type PickedAsset = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  kind: 'image' | 'video';
};

export type SaleDocumentCategory =
  | 'titre_foncier'
  | 'convention_vente'
  | 'attestation_recasement'
  | 'permis_habiter'
  | 'plan_cadastral'
  | 'autre';

type PickedDocument = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  docType: SaleDocumentCategory;
  isImage: boolean;
};

type PublishFieldErrors = Partial<
  Record<
    | 'transaction'
    | 'commune'
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

const SALE_DOCUMENT_OPTIONS: { key: SaleDocumentCategory; label: string }[] = [
  { key: 'titre_foncier', label: 'Titre foncier' },
  { key: 'convention_vente', label: 'Convention de vente' },
  { key: 'attestation_recasement', label: 'Attestation de recasement' },
  { key: 'permis_habiter', label: "Permis d'habiter" },
  { key: 'plan_cadastral', label: 'Plan cadastral' },
  { key: 'autre', label: 'Autres documents justificatifs' },
];

function getFileExtension(name: string, mimeType?: string): string {
  const dotIdx = name.lastIndexOf('.');
  if (dotIdx !== -1 && dotIdx < name.length - 1) {
    return name.slice(dotIdx + 1).toLowerCase();
  }
  if (mimeType) {
    const parts = mimeType.split('/');
    if (parts[1]) return parts[1].toLowerCase().replace('quicktime', 'mov');
  }
  return '';
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getDocumentLabel(docType: SaleDocumentCategory): string {
  return SALE_DOCUMENT_OPTIONS.find((d) => d.key === docType)?.label ?? 'Document justificatif';
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
  const { isSmallMobile, twoColLayout, horizontalPadding, getGridItemWidth } = useResponsive();
  const { isAuthenticated, openAuthModal, isAgentMobilier, isAdminStaff } = useAuth();
  const { tarifs } = usePlatformConfig();

  const isAgentView = mode === 'agent';

  const publicationFee = useMemo(() => {
    if (isAdminStaff) return 0;
    if (isAgentMobilier) return tarifs?.post_agent ?? null;
    return tarifs?.post_client ?? null;
  }, [isAdminStaff, isAgentMobilier, tarifs]);

  const paymentOperationType: PaymentOperationType = isAgentMobilier
    ? 'publication_agent'
    : 'publication_client';

  const [propertyType, setPropertyType] = useState<'parcelle' | 'maison' | 'chambre'>('maison');
  const [transactionType, setTransactionType] = useState<'location' | 'vente'>('location');
  const [commune, setCommune] = useState('');
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
    useState<SaleDocumentCategory>('titre_foncier');

  const [errors, setErrors] = useState<PublishFieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ message: string; propertyId?: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutVisible, setCheckoutVisible] = useState(false);

  const isSurfaceHidden = propertyType === 'chambre' && transactionType === 'location';
  const matchedCommuneKey = Object.keys(QUARTIERS_BY_COMMUNE).find(
    (k) => k.toLowerCase() === commune.trim().toLowerCase()
  );
  const quartiersSuggestions = matchedCommuneKey
    ? (QUARTIERS_BY_COMMUNE[matchedCommuneKey] || []).filter((q) => q !== 'Tous')
    : [];

  const photosCount = medias.filter((m) => m.kind === 'image').length;
  const videosCount = medias.filter((m) => m.kind === 'video').length;

  const handleSelectType = (nextType: 'parcelle' | 'maison' | 'chambre') => {
    setPropertyType(nextType);
    if (nextType === 'parcelle' && transactionType === 'location') {
      setTransactionType('vente');
    }
    if (nextType === 'chambre' && transactionType === 'location') {
      setSurface('');
      setErrors((prev) => ({ ...prev, transaction: undefined, surface: undefined }));
    } else {
      setErrors((prev) => ({ ...prev, transaction: undefined }));
    }
  };

  const pickAssets = async (kind: 'image' | 'video') => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === 'image' ? ['images'] : ['videos'],
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (res.canceled) return;

    const rejectedReasons: string[] = [];
    const validAdded: PickedAsset[] = [];

    let currentPhotos = photosCount;
    let currentVideos = videosCount;

    for (let idx = 0; idx < res.assets.length; idx++) {
      const asset = res.assets[idx];
      const isVideo = kind === 'video' || asset.type === 'video';
      const fallbackName = isVideo
        ? `video_${Date.now()}_${idx}.mp4`
        : `photo_${Date.now()}_${idx}.jpg`;
      const name = asset.fileName || fallbackName;
      const mimeType = asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg');
      const ext = getFileExtension(name, mimeType);
      const size = asset.fileSize;

      if (isVideo) {
        if (currentVideos >= MAX_VIDEOS_COUNT) {
          rejectedReasons.push(`Limite atteinte : maximum ${MAX_VIDEOS_COUNT} vidéos.`);
          continue;
        }
        if (ext && !ALLOWED_VIDEO_EXT.includes(ext)) {
          rejectedReasons.push(`"${name}" : format vidéo non supporté (MP4, MOV, AVI, WEBM, MKV).`);
          continue;
        }
        if (size && size > MAX_VIDEO_SIZE_BYTES) {
          rejectedReasons.push(`"${name}" dépasse la taille maximale autorisée (50 Mo).`);
          continue;
        }
        currentVideos++;
      } else {
        if (currentPhotos >= MAX_PHOTOS_COUNT) {
          rejectedReasons.push(`Limite atteinte : maximum ${MAX_PHOTOS_COUNT} photos.`);
          continue;
        }
        if (ext && !ALLOWED_IMAGE_EXT.includes(ext)) {
          rejectedReasons.push(`"${name}" : format image non supporté (JPG, JPEG, PNG, WEBP).`);
          continue;
        }
        if (size && size > MAX_PHOTO_SIZE_BYTES) {
          rejectedReasons.push(`"${name}" dépasse la taille maximale autorisée (12 Mo).`);
          continue;
        }
        currentPhotos++;
      }

      validAdded.push({
        uri: asset.uri,
        name,
        mimeType,
        size,
        kind: isVideo ? 'video' : 'image',
      });
    }

    if (validAdded.length > 0) {
      setMedias((prev) => [...prev, ...validAdded]);
    }
    if (rejectedReasons.length > 0) {
      setErrors((prev) => ({ ...prev, medias: rejectedReasons[0] }));
    } else {
      setErrors((prev) => ({ ...prev, medias: undefined }));
    }
  };

  const pickLegalDocument = async () => {
    if (documents.length >= MAX_DOCS_COUNT) {
      setErrors((prev) => ({
        ...prev,
        documents: `Limite atteinte : maximum ${MAX_DOCS_COUNT} documents justificatifs.`,
      }));
      return;
    }

    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.length) return;

    const rejectedReasons: string[] = [];
    const validDocs: PickedDocument[] = [];
    let currentCount = documents.length;

    for (let idx = 0; idx < res.assets.length; idx++) {
      const file = res.assets[idx];
      if (currentCount >= MAX_DOCS_COUNT) {
        rejectedReasons.push(`Limite atteinte : maximum ${MAX_DOCS_COUNT} documents.`);
        break;
      }

      const name = file.name || `document_${Date.now()}_${idx}.pdf`;
      const mimeType = file.mimeType || 'application/pdf';
      const ext = getFileExtension(name, mimeType);
      const size = file.size;

      if (ext && !ALLOWED_DOC_EXT.includes(ext)) {
        rejectedReasons.push(`"${name}" : format non accepté (PDF, JPG, JPEG, PNG uniquement).`);
        continue;
      }
      if (size && size > MAX_DOC_SIZE_BYTES) {
        rejectedReasons.push(`"${name}" dépasse 12 Mo (${formatFileSize(size)}).`);
        continue;
      }

      validDocs.push({
        uri: file.uri,
        name,
        mimeType,
        size,
        docType: selectedDocType,
        isImage: mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png'].includes(ext),
      });
      currentCount++;
    }

    if (validDocs.length > 0) {
      setDocuments((prev) => [...prev, ...validDocs]);
    }
    if (rejectedReasons.length > 0) {
      setErrors((prev) => ({ ...prev, documents: rejectedReasons[0] }));
    } else {
      setErrors((prev) => ({ ...prev, documents: undefined }));
    }
  };

  const validateForm = (): PublishFieldErrors => {
    const next: PublishFieldErrors = {};
    if (propertyType === 'parcelle' && transactionType === 'location') {
      next.transaction = 'Une parcelle ne peut pas être mise en location. Sélectionnez « Vendre ».';
    }
    if (!commune.trim() || commune.trim().length < 2) {
      next.commune = 'La commune est obligatoire (au moins 2 caractères).';
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
    if (!isSurfaceHidden && (!surface.trim() || Number(surface) < 1)) {
      next.surface = 'Indiquez une surface valide (> 0 m²).';
    }
    if (!prix.trim() || Number(prix) <= 0) {
      next.prix = 'Indiquez un prix valide en F CFA.';
    }
    if (transactionType === 'location' && (!avanceMois.trim() || Number(avanceMois) < 0)) {
      next.avanceMois = "Indiquez le nombre de mois d'avance.";
    }
    if (medias.length === 0) {
      next.medias = 'Ajoutez au moins une photo ou une vidéo du bien.';
    }
    if (
      transactionType === 'vente' &&
      (propertyType === 'parcelle' || propertyType === 'maison') &&
      documents.length === 0
    ) {
      next.documents =
        "Pour vendre une maison ou une parcelle, ajoutez au moins un document justificatif (Titre foncier, Permis d'habiter, Plan cadastral ou autre).";
    }
    return next;
  };

  const submitPropertyToBackend = async (kkiapayTxId?: string, paymentReference?: string) => {
    setSubmitting(true);
    setGlobalError(null);
    try {
      const formData = new FormData();
      formData.append('type', propertyType);
      formData.append('transaction_type', transactionType);
      formData.append('commune', commune.trim());
      formData.append('arrondissement', arrondissement.trim());
      formData.append('quartier', quartier.trim());
      if (locationDetails.trim()) formData.append('location_details', locationDetails.trim());
      formData.append('accessibilite', accessibilite.trim());
      formData.append('eau_courant', eauCourant.trim());
      if (!isSurfaceHidden && surface.trim()) {
        formData.append('surface', String(Number(surface)));
      }
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
      if (paymentReference) formData.append('payment_reference', paymentReference);

      for (const m of medias) {
        const field = m.kind === 'video' ? 'videos[]' : 'photos[]';
        await appendFileToFormData(formData, field, m);
      }

      if (transactionType === 'vente') {
        for (let idx = 0; idx < documents.length; idx++) {
          const doc = documents[idx];
          await appendFileToFormData(formData, `documents[${idx}]`, doc);
          formData.append(`document_types[${idx}]`, doc.docType);
        }
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
    if (publicationFee === null || publicationFee > 0) {
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
          <View style={[styles.gateIconBox, { backgroundColor: theme.primaryLight }]}>
            {isAgentView ? (
              <Building2 size={32} color={theme.primary} strokeWidth={2} />
            ) : (
              <Home size={32} color={theme.primary} strokeWidth={2} />
            )}
          </View>
          <Text style={[styles.gateTitle, { color: theme.text }]}>
            Publier une annonce immobilière
          </Text>
          <Text style={[styles.gateDesc, { color: theme.textSecondary }]}>
            Connectez-vous pour publier un bien à louer ou à vendre, ajouter vos photos, vidéos et
            documents justificatifs en toute sécurité.
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
              <Text style={[styles.secondaryBtnText, { color: theme.primary }]}>
                Créer un compte
              </Text>
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
          {/* Fee Banner */}
          <View style={[styles.feeBanner, { backgroundColor: theme.navy }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.eyebrowRow}>
                <Sparkles size={13} color="#FDE68A" strokeWidth={2.2} />
                <Text style={styles.feeEyebrow}>PUBLICATION CERTIFIÉE E-MOBILIER</Text>
              </View>
              <Text style={styles.feeTitle}>Mettre un bien à louer ou à vendre</Text>
              <Text style={styles.feeSub}>
                Tarif appliqué ({isAdminStaff ? 'Admin' : isAgentMobilier ? 'Agent mobilier' : 'Client'}) :{' '}
                <Text style={{ color: '#FDE68A', fontWeight: '900' }}>
                  {publicationFee === 0
                    ? 'Gratuit'
                    : publicationFee !== null
                    ? `${publicationFee} F CFA via Kkiapay`
                    : 'Tarif officiel via Kkiapay'}
                </Text>
              </Text>
            </View>
            <Pressable
              onPress={() =>
                router.push((isAgentMobilier && !isAdminStaff ? '/agent-space' : '/client?tab=annonces') as any)
              }
              style={styles.bannerLinkBtn}>
              <Text style={styles.bannerLinkText}>Mes annonces</Text>
            </Pressable>
          </View>

          {successInfo && (
            <View style={styles.successBox}>
              <View style={styles.inlineIconTitle}>
                <CheckCircle2 size={20} color="#065F46" strokeWidth={2.2} />
                <Text style={styles.successTitle}>Annonce publiée avec succès</Text>
              </View>
              <Text style={styles.successText}>{successInfo.message}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <Pressable
                  onPress={() =>
                    router.push((isAgentMobilier && !isAdminStaff ? '/agent-space' : '/client?tab=annonces') as any)
                  }
                  style={[styles.primaryBtn, { backgroundColor: theme.primary, paddingHorizontal: 18 }]}>
                  <Text style={styles.primaryBtnText}>Voir mes annonces</Text>
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
              <AlertTriangle size={17} color="#B91C1C" strokeWidth={2.2} />
              <Text style={styles.errorBannerText}>{globalError}</Text>
            </View>
          )}

          {/* 1. Type de bien & Type de transaction (UNIQUEMENT Louer / Vendre) */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
            ]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              1. Catégorie & Type de transaction
            </Text>

            <View style={twoColLayout ? styles.twoCol : styles.oneCol}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Type de transaction *</Text>
                <View style={styles.txCardsRow}>
                  <Pressable
                    disabled={propertyType === 'parcelle'}
                    onPress={() => {
                      setTransactionType('location');
                      if (propertyType === 'chambre') {
                        setSurface('');
                        setErrors((prev) => ({ ...prev, surface: undefined }));
                      }
                    }}
                    style={[
                      styles.txChoiceCard,
                      {
                        backgroundColor:
                          transactionType === 'location'
                            ? theme.primaryLight
                            : theme.backgroundElement,
                        borderColor:
                          transactionType === 'location' ? theme.primary : theme.cardBorder,
                        opacity: propertyType === 'parcelle' ? 0.45 : 1,
                      },
                    ]}>
                    <KeyRound
                      size={18}
                      color={transactionType === 'location' ? theme.primary : theme.textSecondary}
                      strokeWidth={2.2}
                    />
                    <Text
                      style={{
                        color:
                          transactionType === 'location' ? theme.primaryDark : theme.text,
                        fontWeight: '800',
                        fontSize: 14,
                      }}>
                      Louer
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setTransactionType('vente')}
                    style={[
                      styles.txChoiceCard,
                      {
                        backgroundColor:
                          transactionType === 'vente' ? '#FEF3C7' : theme.backgroundElement,
                        borderColor:
                          transactionType === 'vente' ? '#D97706' : theme.cardBorder,
                      },
                    ]}>
                    <Tag
                      size={18}
                      color={transactionType === 'vente' ? '#B45309' : theme.textSecondary}
                      strokeWidth={2.2}
                    />
                    <Text
                      style={{
                        color: transactionType === 'vente' ? '#92400E' : theme.text,
                        fontWeight: '800',
                        fontSize: 14,
                      }}>
                      Vendre
                    </Text>
                  </Pressable>
                </View>
                {errors.transaction ? (
                  <Text style={styles.fieldError}>{errors.transaction}</Text>
                ) : null}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Catégorie du bien *</Text>
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
            </View>
          </View>

          {/* 2. Localisation */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
            ]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>2. Localisation du bien</Text>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Commune *</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    backgroundColor: theme.backgroundElement,
                    borderColor: errors.commune ? '#DC2626' : theme.cardBorder,
                  },
                ]}
                placeholder="Saisissez la commune (ex: Cotonou, Abomey-Calavi, Parakou, Bohicon...)"
                placeholderTextColor={theme.textSecondary}
                value={commune}
                onChangeText={(v) => {
                  setCommune(v);
                  if (errors.commune) setErrors((p) => ({ ...p, commune: undefined }));
                }}
              />
              {errors.commune ? <Text style={styles.fieldError}>{errors.commune}</Text> : null}
            </View>

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
                {tarifs
                  ? `Repères précis (protégés avant déblocage ${tarifs.deblocage_coordonnees} F)`
                  : 'Repères précis (protégés avant déblocage)'}
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
              {!isSurfaceHidden && (
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
              )}

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
                  {transactionType === 'location'
                    ? 'Loyer mensuel (F CFA) *'
                    : 'Prix de vente (F CFA) *'}
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

          {/* 4. Médias (Photos & Vidéos multiples — disponible pour Louer ET Vendre) */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.cardBackground,
                borderColor: errors.medias ? '#DC2626' : theme.cardBorder,
              },
            ]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                4. Photos & Vidéos du bien ({medias.length}) *
              </Text>
              <Text style={[styles.helperHint, { color: theme.textSecondary }]}>
                {photosCount}/{MAX_PHOTOS_COUNT} photos • {videosCount}/{MAX_VIDEOS_COUNT} vidéos
              </Text>
            </View>
            <Text style={[styles.helperText, { color: theme.textSecondary }]}>
              Formats acceptés : Photos JPG, PNG, WEBP (max 12 Mo) • Vidéos MP4, MOV, AVI, WEBM,
              MKV (max 50 Mo). Disponible pour la location et la vente.
            </Text>

            <View style={twoColLayout ? styles.twoCol : styles.oneCol}>
              <Pressable
                onPress={() => pickAssets('image')}
                style={[
                  styles.uploadDropBtn,
                  { borderColor: theme.primary, backgroundColor: theme.primaryLight },
                ]}>
                <Camera size={20} color={theme.primary} strokeWidth={2.2} />
                <Text style={[styles.uploadBtnText, { color: theme.primaryDark }]}>
                  Ajouter des photos (multiples)
                </Text>
              </Pressable>

              <Pressable
                onPress={() => pickAssets('video')}
                style={[
                  styles.uploadDropBtn,
                  { borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement },
                ]}>
                <Video size={20} color={theme.text} strokeWidth={2.2} />
                <Text style={[styles.uploadBtnText, { color: theme.text }]}>
                  Ajouter des vidéos (multiples)
                </Text>
              </Pressable>
            </View>

            {errors.medias ? <Text style={styles.fieldError}>{errors.medias}</Text> : null}

            {medias.length > 0 && (
              <View style={styles.previewGrid}>
                {medias.map((m, idx) => (
                  <View
                    key={`${m.uri}-${idx}`}
                    style={[
                      styles.previewCard,
                      {
                        width: getGridItemWidth(isSmallMobile ? 2 : twoColLayout ? 4 : 3, 10),
                        borderColor: theme.cardBorder,
                        backgroundColor: theme.backgroundElement,
                      },
                    ]}>
                    {m.kind === 'image' ? (
                      <Image source={{ uri: m.uri }} style={styles.previewThumb} contentFit="cover" />
                    ) : (
                      <View
                        style={[
                          styles.previewThumb,
                          styles.videoThumbPlaceholder,
                          { backgroundColor: theme.navy },
                        ]}>
                        <Film size={24} color="#FDE68A" strokeWidth={2} />
                        <Text style={styles.videoTag}>VIDÉO</Text>
                      </View>
                    )}
                    <Text numberOfLines={1} style={[styles.previewName, { color: theme.text }]}>
                      {m.name}
                    </Text>
                    {m.size ? (
                      <Text style={[styles.previewSize, { color: theme.textSecondary }]}>
                        {formatFileSize(m.size)}
                      </Text>
                    ) : null}
                    <Pressable
                      onPress={() => setMedias((prev) => prev.filter((_, i) => i !== idx))}
                      style={styles.removeBtnRow}>
                      <Trash2 size={13} color="#DC2626" strokeWidth={2.2} />
                      <Text style={styles.removeText}>Retirer</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* 5. Documents justificatifs spécifiques à la VENTE (affichage dynamique) */}
          {transactionType === 'vente' && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: errors.documents ? '#DC2626' : '#F59E0B',
                },
              ]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.inlineIconTitle}>
                  <FileCheck2 size={18} color="#B45309" strokeWidth={2.2} />
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    5. Documents liés à la vente ({documents.length}) *
                  </Text>
                </View>
                <Text style={[styles.helperHint, { color: theme.textSecondary }]}>
                  Max {MAX_DOCS_COUNT} fichiers
                </Text>
              </View>

              <Text style={[styles.helperText, { color: theme.textSecondary }]}>
                Sélectionnez le type de pièce puis ajoutez vos justificatifs (PDF, JPG, PNG — max
                12 Mo par document).
              </Text>

              <View style={styles.rowWrap}>
                {SALE_DOCUMENT_OPTIONS.map((d) => {
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
                      <Text
                        style={{
                          color: active ? '#FFFFFF' : theme.text,
                          fontSize: 12,
                          fontWeight: '700',
                        }}>
                        {d.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={pickLegalDocument}
                style={[styles.uploadDropBtn, { borderColor: '#D97706', backgroundColor: '#FFFBEB' }]}>
                <Upload size={18} color="#B45309" strokeWidth={2.2} />
                <Text style={[styles.uploadBtnText, { color: '#92400E' }]}>
                  Joindre « {getDocumentLabel(selectedDocType)} » (PDF ou Image)
                </Text>
              </Pressable>

              {errors.documents ? <Text style={styles.fieldError}>{errors.documents}</Text> : null}

              {documents.length > 0 && (
                <View style={{ gap: 8 }}>
                  {documents.map((doc, idx) => (
                    <View
                      key={`${doc.uri}-${idx}`}
                      style={[
                        styles.docPreviewRow,
                        { backgroundColor: theme.backgroundElement, borderColor: theme.cardBorder },
                      ]}>
                      {doc.isImage ? (
                        <Image source={{ uri: doc.uri }} style={styles.docThumb} contentFit="cover" />
                      ) : (
                        <View style={[styles.docIconBox, { backgroundColor: theme.primaryLight }]}>
                          <FileText size={18} color={theme.primary} strokeWidth={2} />
                        </View>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={[styles.fileName, { color: theme.text }]}>
                          {doc.name}
                        </Text>
                        <Text style={[styles.docMeta, { color: theme.textSecondary }]}>
                          {getDocumentLabel(doc.docType)}
                          {doc.size ? ` • ${formatFileSize(doc.size)}` : ''}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => setDocuments((prev) => prev.filter((_, i) => i !== idx))}
                        style={styles.removeBtnRow}
                        hitSlop={6}>
                        <Trash2 size={14} color="#DC2626" strokeWidth={2.2} />
                        <Text style={styles.removeText}>Retirer</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
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
                {publicationFee === 0
                  ? 'Publier le bien maintenant'
                  : publicationFee !== null
                  ? `Payer ${publicationFee} F CFA & Publier`
                  : 'Payer via Kkiapay & Publier'}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <KkiapayCheckoutModal
        visible={checkoutVisible}
        operationType={paymentOperationType}
        title="Frais de publication E-Mobilier"
        description={
          publicationFee !== null
            ? `Règlement officiel de ${publicationFee} F CFA pour publier votre annonce immobilière.`
            : 'Règlement officiel pour publier votre annonce immobilière.'
        }
        onClose={() => setCheckoutVisible(false)}
        onSuccess={async ({ transactionId, internalReference }) => {
          setCheckoutVisible(false);
          await submitPropertyToBackend(transactionId, internalReference);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: Spacing.three },
  innerWrap: { width: '100%', maxWidth: 900, alignSelf: 'center', gap: 16 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorBannerText: { color: '#B91C1C', fontSize: 13, fontWeight: '700', flex: 1 },
  successBox: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 18,
    gap: 10,
  },
  inlineIconTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  successTitle: { color: '#065F46', fontSize: 17, fontWeight: '900' },
  successText: { color: '#047857', fontSize: 14, lineHeight: 20 },
  card: { borderRadius: 20, borderWidth: 1, padding: 18, gap: 12 },
  cardHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '900' },
  helperHint: { fontSize: 12, fontWeight: '700' },
  helperText: { fontSize: 12, lineHeight: 18 },
  twoCol: { flexDirection: 'row', gap: 14 },
  oneCol: { gap: 12 },
  fieldGroup: { flex: 1, gap: 5 },
  label: { fontSize: 13, fontWeight: '700' },
  txCardsRow: { flexDirection: 'row', gap: 10 },
  txChoiceCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
  },
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
  uploadDropBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 14,
  },
  uploadBtnText: { fontSize: 13, fontWeight: '800' },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  previewCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 6,
    gap: 4,
    alignItems: 'center',
  },
  previewThumb: { width: '100%', aspectRatio: 4 / 3, borderRadius: 8 },
  videoThumbPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  videoTag: { color: '#FDE68A', fontSize: 10, fontWeight: '800' },
  previewName: { fontSize: 11, fontWeight: '600', width: '100%', textAlign: 'center' },
  previewSize: { fontSize: 10, fontWeight: '600' },
  docPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  docThumb: { width: 42, height: 42, borderRadius: 8 },
  docIconBox: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: { fontSize: 13, fontWeight: '700' },
  docMeta: { fontSize: 11, marginTop: 2 },
  removeBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
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
  gateIconBox: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  gateTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  gateDesc: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  gateBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%', marginTop: 8 },
});
