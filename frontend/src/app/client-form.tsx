import { router } from 'expo-router';
import { AlertTriangle, Check, CheckCircle2, Sparkles } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
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
import { inquiriesApi } from '@/services/api';
import { localInquiriesStorage } from '@/services/local-store';
import type { PropertyInquiryItem } from '@/types/api';
import { formatFcfa } from '@/types/property';
import {
  isValidEmail,
  isValidPersonName,
  isValidPhone,
  splitFullName,
} from '@/utils/validation';

type ClientNeed =
  | 'Acheter une maison / villa'
  | 'Louer une maison / chambre'
  | 'Acheter une parcelle titrée'
  | 'Faire estimer / vendre mon bien'
  | 'Accompagnement personnalisé';

const NEED_OPTIONS: ClientNeed[] = [
  'Acheter une maison / villa',
  'Louer une maison / chambre',
  'Acheter une parcelle titrée',
  'Faire estimer / vendre mon bien',
  'Accompagnement personnalisé',
];

type FormErrors = Partial<
  Record<'nom' | 'prenom' | 'telephone' | 'email' | 'commune' | 'budget' | 'message' | 'cgu', string>
>;

export default function ClientFormScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { twoColLayout, horizontalPadding } = useResponsive();
  const { user } = useAuth();

  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [need, setNeed] = useState<ClientNeed>('Acheter une maison / villa');
  const [commune, setCommune] = useState('');
  const [quartier, setQuartier] = useState('');
  const [budget, setBudget] = useState('');
  const [message, setMessage] = useState('');
  const [acceptedCgu, setAcceptedCgu] = useState(false);

  const [errors, setErrors] = useState<FormErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<PropertyInquiryItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const split = splitFullName(user.fullName || user.name, user.nom, user.prenom);
    setNom((prev) => prev || split.nom);
    setPrenom((prev) => prev || split.prenom);
    setTelephone((prev) => prev || user.phone || '');
    setEmail((prev) => prev || user.email || '');
  }, [user]);

  const validateForm = (): FormErrors => {
    const next: FormErrors = {};
    if (!isValidPersonName(nom)) {
      next.nom = 'Veuillez indiquer votre nom (minimum 2 lettres).';
    }
    if (!isValidPersonName(prenom)) {
      next.prenom = 'Veuillez indiquer votre prénom (minimum 2 lettres).';
    }
    if (!isValidPhone(telephone, true)) {
      next.telephone = 'Numéro béninois requis (10 chiffres commençant par 01, ex: 0197001122).';
    }
    if (!isValidEmail(email)) {
      next.email = 'Veuillez saisir une adresse e-mail valide.';
    }
    if (!commune.trim() || commune.trim().length < 2) {
      next.commune = 'Veuillez saisir le nom de votre commune (au moins 2 caractères).';
    }
    if (budget.trim()) {
      const numeric = Number(budget.replace(/\s+/g, ''));
      if (Number.isNaN(numeric) || numeric <= 0) {
        next.budget = 'Le budget doit être un montant positif en F CFA.';
      }
    }
    if (message.trim().length < 15) {
      next.message = 'Décrivez votre besoin en au moins 15 caractères pour un suivi efficace.';
    }
    if (!acceptedCgu) {
      next.cgu = "Veuillez accepter les Conditions Générales d'Utilisation.";
    }
    return next;
  };

  const handleSubmit = async () => {
    setGlobalError(null);
    const nextErrors = validateForm();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setGlobalError('Veuillez vérifier les champs en rouge avant de soumettre le formulaire.');
      return;
    }

    setSubmitting(true);
    try {
      const parsedBudget = budget.trim() ? Number(budget.replace(/\s+/g, '')) : null;
      const res = await inquiriesApi.create({
        type: 'formulaire_client',
        nom: nom.trim(),
        prenom: prenom.trim(),
        telephone: telephone.trim(),
        email: email.trim(),
        sujet: need,
        commune: commune.trim(),
        quartier: quartier.trim() || null,
        budget: parsedBudget,
        message: message.trim(),
      });

      if (res.success && res.data) {
        await localInquiriesStorage.add(res.data);
        setSubmittedRecord(res.data);
        return;
      }

      if (res.errors) {
        const mapped: FormErrors = {};
        for (const [k, v] of Object.entries(res.errors)) {
          if (v && v[0]) (mapped as any)[k] = v[0];
        }
        setErrors(mapped);
        setGlobalError(res.message || 'Erreur de validation côté serveur.');
        return;
      }

      setGlobalError(res.message || 'Impossible de soumettre le formulaire pour le moment.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmittedRecord(null);
    setErrors({});
    setGlobalError(null);
    setCommune('');
    setQuartier('');
    setBudget('');
    setMessage('');
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Formulaire Client"
        subtitle="Décrivez votre projet immobilier"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            {
              paddingHorizontal: horizontalPadding,
              paddingBottom: insets.bottom + 40,
            },
          ]}>
          <View style={styles.innerWrap}>
            {submittedRecord ? (
              <View
                style={[
                  styles.successCard,
                  { backgroundColor: theme.cardBackground, borderColor: '#10B981' },
                ]}>
                <View style={styles.successIcon}>
                  <CheckCircle2 size={36} color="#059669" strokeWidth={2.2} />
                </View>
                <Text style={[styles.successTitle, { color: theme.text }]}>
                  Formulaire client enregistré !
                </Text>
                <Text style={[styles.successDesc, { color: theme.textSecondary }]}>
                  Merci {submittedRecord.prenom} {submittedRecord.nom}. Votre dossier #
                  {submittedRecord.id} a bien été transmis à notre équipe E-Mobilier. Un conseiller vous
                  contactera très prochainement.
                </Text>

                <View style={[styles.recapBox, { backgroundColor: theme.backgroundElement }]}>
                  <RecapRow label="Demandeur" value={`${submittedRecord.prenom} ${submittedRecord.nom}`} theme={theme} />
                  <RecapRow label="Téléphone" value={submittedRecord.telephone} theme={theme} />
                  <RecapRow label="E-mail" value={submittedRecord.email} theme={theme} />
                  <RecapRow label="Objet" value={submittedRecord.sujet || need} theme={theme} />
                  <RecapRow
                    label="Localisation"
                    value={[submittedRecord.quartier, submittedRecord.commune].filter(Boolean).join(', ')}
                    theme={theme}
                  />
                  {submittedRecord.budget ? (
                    <RecapRow label="Budget" value={formatFcfa(submittedRecord.budget)} theme={theme} />
                  ) : null}
                </View>

                <View style={styles.successActions}>
                  <Pressable
                    onPress={() => router.push('/client' as any)}
                    style={[styles.primaryBtn, { backgroundColor: theme.primary, flex: 1 }]}>
                    <Text style={styles.primaryBtnText}>Aller à l'Espace Client</Text>
                  </Pressable>
                  <Pressable
                    onPress={resetForm}
                    style={[styles.secondaryBtn, { borderColor: theme.cardBorder, flex: 1 }]}>
                    <Text style={[styles.secondaryBtnText, { color: theme.text }]}>
                      Nouveau formulaire
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                {/* Intro Header Card */}
                <View style={[styles.banner, { backgroundColor: theme.navy }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={13} color="#FDE68A" strokeWidth={2.2} />
                    <Text style={styles.bannerEyebrow}>ACCOMPAGNEMENT PERSONNALISÉ</Text>
                  </View>
                  <Text style={styles.bannerTitle}>Parlez-nous de votre besoin immobilier</Text>
                  <Text style={styles.bannerSub}>
                    Tous vos renseignements sont sécurisés et pris en charge par un conseiller agréé
                    E-Mobilier au Bénin.
                  </Text>
                </View>

                {globalError && (
                  <View style={[styles.errorBanner, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                    <AlertTriangle size={16} color="#B91C1C" strokeWidth={2.2} />
                    <Text style={[styles.errorBannerText, { flex: 1 }]}>{globalError}</Text>
                  </View>
                )}

                {/* Section 1: Coordonnées du client */}
                <View
                  style={[
                    styles.card,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    1. Vos coordonnées personnelles
                  </Text>

                  <View style={twoColLayout ? styles.twoCol : styles.oneCol}>
                    <View style={styles.fieldGroup}>
                      <Text style={[styles.label, { color: theme.text }]}>Nom *</Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            color: theme.text,
                            backgroundColor: theme.backgroundElement,
                            borderColor: errors.nom ? '#DC2626' : theme.cardBorder,
                          },
                        ]}
                        placeholder="Ex: Dossou"
                        placeholderTextColor={theme.textSecondary}
                        value={nom}
                        onChangeText={(v) => {
                          setNom(v);
                          if (errors.nom) setErrors((p) => ({ ...p, nom: undefined }));
                        }}
                      />
                      {errors.nom ? <Text style={styles.fieldError}>{errors.nom}</Text> : null}
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={[styles.label, { color: theme.text }]}>Prénom *</Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            color: theme.text,
                            backgroundColor: theme.backgroundElement,
                            borderColor: errors.prenom ? '#DC2626' : theme.cardBorder,
                          },
                        ]}
                        placeholder="Ex: Mireille"
                        placeholderTextColor={theme.textSecondary}
                        value={prenom}
                        onChangeText={(v) => {
                          setPrenom(v);
                          if (errors.prenom) setErrors((p) => ({ ...p, prenom: undefined }));
                        }}
                      />
                      {errors.prenom ? <Text style={styles.fieldError}>{errors.prenom}</Text> : null}
                    </View>
                  </View>

                  <View style={twoColLayout ? styles.twoCol : styles.oneCol}>
                    <View style={styles.fieldGroup}>
                      <Text style={[styles.label, { color: theme.text }]}>
                        Téléphone (Bénin +229) *
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            color: theme.text,
                            backgroundColor: theme.backgroundElement,
                            borderColor: errors.telephone ? '#DC2626' : theme.cardBorder,
                          },
                        ]}
                        placeholder="Ex: 0197001122"
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="phone-pad"
                        value={telephone}
                        onChangeText={(v) => {
                          setTelephone(v);
                          if (errors.telephone) setErrors((p) => ({ ...p, telephone: undefined }));
                        }}
                      />
                      {errors.telephone ? (
                        <Text style={styles.fieldError}>{errors.telephone}</Text>
                      ) : null}
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={[styles.label, { color: theme.text }]}>Adresse e-mail *</Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            color: theme.text,
                            backgroundColor: theme.backgroundElement,
                            borderColor: errors.email ? '#DC2626' : theme.cardBorder,
                          },
                        ]}
                        placeholder="Ex: mireille.dossou@email.com"
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={(v) => {
                          setEmail(v);
                          if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                        }}
                      />
                      {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
                    </View>
                  </View>
                </View>

                {/* Section 2: Projet immobilier */}
                <View
                  style={[
                    styles.card,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    2. Votre projet immobilier
                  </Text>

                  <Text style={[styles.label, { color: theme.text }]}>Type de besoin *</Text>
                  <View style={styles.chipsWrap}>
                    {NEED_OPTIONS.map((option) => {
                      const active = need === option;
                      return (
                        <Pressable
                          key={option}
                          onPress={() => setNeed(option)}
                          style={[
                            styles.chip,
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
                            {option}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={twoColLayout ? styles.twoCol : styles.oneCol}>
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
                        placeholder="Saisissez votre commune"
                        placeholderTextColor={theme.textSecondary}
                        value={commune}
                        onChangeText={(v) => {
                          setCommune(v);
                          if (errors.commune) setErrors((p) => ({ ...p, commune: undefined }));
                        }}
                      />
                      {errors.commune ? <Text style={styles.fieldError}>{errors.commune}</Text> : null}
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={[styles.label, { color: theme.text }]}>
                        Quartier précis (optionnel)
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
                        placeholder="Ex: Fidjrossè Plage, Cadjehoun..."
                        placeholderTextColor={theme.textSecondary}
                        value={quartier}
                        onChangeText={setQuartier}
                      />
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { color: theme.text }]}>
                      Budget estimatif (F CFA)
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          color: theme.text,
                          backgroundColor: theme.backgroundElement,
                          borderColor: errors.budget ? '#DC2626' : theme.cardBorder,
                        },
                      ]}
                      placeholder="Ex: 250000 ou 25000000"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                      value={budget}
                      onChangeText={(v) => {
                        setBudget(v);
                        if (errors.budget) setErrors((p) => ({ ...p, budget: undefined }));
                      }}
                    />
                    {errors.budget ? <Text style={styles.fieldError}>{errors.budget}</Text> : null}
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { color: theme.text }]}>
                      Détails de votre demande *
                    </Text>
                    <TextInput
                      style={[
                        styles.textArea,
                        {
                          color: theme.text,
                          backgroundColor: theme.backgroundElement,
                          borderColor: errors.message ? '#DC2626' : theme.cardBorder,
                        },
                      ]}
                      placeholder="Indiquez le nombre de chambres souhaité, vos critères d'accessibilité, délais, préférences..."
                      placeholderTextColor={theme.textSecondary}
                      multiline
                      value={message}
                      onChangeText={(v) => {
                        setMessage(v);
                        if (errors.message) setErrors((p) => ({ ...p, message: undefined }));
                      }}
                    />
                    {errors.message ? (
                      <Text style={styles.fieldError}>{errors.message}</Text>
                    ) : null}
                  </View>

                  {/* CGU Acceptance */}
                  <Pressable
                    onPress={() => {
                      setAcceptedCgu((v) => !v);
                      if (errors.cgu) setErrors((p) => ({ ...p, cgu: undefined }));
                    }}
                    style={styles.cguRow}>
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: errors.cgu
                            ? '#DC2626'
                            : acceptedCgu
                            ? theme.primary
                            : theme.cardBorder,
                          backgroundColor: acceptedCgu ? theme.primary : 'transparent',
                        },
                      ]}>
                      {acceptedCgu && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                    </View>
                    <Text style={[styles.cguText, { color: theme.text }]}>
                      J'accepte que mes informations soient traitées conformément aux{' '}
                      <Text
                        onPress={() => router.push('/cgu' as any)}
                        style={{ color: theme.primary, fontWeight: '700', textDecorationLine: 'underline' }}>
                        Conditions Générales d'Utilisation
                      </Text>{' '}
                      d'E-Mobilier.
                    </Text>
                  </Pressable>
                  {errors.cgu ? <Text style={styles.fieldError}>{errors.cgu}</Text> : null}

                  <Pressable
                    onPress={handleSubmit}
                    disabled={submitting}
                    style={[
                      styles.primaryBtn,
                      { backgroundColor: theme.primary, opacity: submitting ? 0.7 : 1 },
                    ]}>
                    {submitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Envoyer mon formulaire client</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RecapRow({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={styles.recapRow}>
      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: theme.text, fontSize: 13, fontWeight: '800', flex: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingTop: Spacing.three },
  innerWrap: { width: '100%', maxWidth: 880, alignSelf: 'center', gap: 16 },
  banner: { borderRadius: 20, padding: 20, gap: 6 },
  bannerEyebrow: { color: '#FDE68A', fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  bannerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  bannerSub: { color: '#CBD5E1', fontSize: 13, lineHeight: 20 },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
  },
  errorBannerText: { color: '#B91C1C', fontSize: 13, fontWeight: '700' },
  card: { borderRadius: 20, borderWidth: 1, padding: 20, gap: 14 },
  cardTitle: { fontSize: 17, fontWeight: '900' },
  twoCol: { flexDirection: 'row', gap: 14 },
  oneCol: { gap: 14 },
  fieldGroup: { flex: 1, gap: 5 },
  label: { fontSize: 13, fontWeight: '700' },
  input: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
  },
  textArea: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  fieldError: { color: '#DC2626', fontSize: 12, fontWeight: '600' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipsScroll: { gap: 8 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  cguRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkMark: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  cguText: { flex: 1, fontSize: 13, lineHeight: 19 },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700' },
  successCard: {
    borderRadius: 22,
    borderWidth: 2,
    padding: 24,
    alignItems: 'center',
    gap: 14,
  },
  successIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  successDesc: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  recapBox: { width: '100%', borderRadius: 14, padding: 14, gap: 8 },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  successActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%', marginTop: 6 },
});
