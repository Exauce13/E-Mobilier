import { Calendar, Home, Mail, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { usePlatformConfig } from '@/context/platform-config-context';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { inquiriesApi } from '@/services/api';
import { localInquiriesStorage } from '@/services/local-store';
import type { InquiryActionType, InquiryMeetingMode, PropertyInquiryItem } from '@/types/api';
import {
  formatLocalFutureDate,
  isFutureDateString,
  isValidEmail,
  isValidPersonName,
  isValidPhone,
  splitFullName,
} from '@/utils/validation';

export type PropertyActionTab = 'demande_visite' | 'rendez_vous' | 'contact';

interface PropertyActionModalProps {
  visible: boolean;
  initialAction?: PropertyActionTab;
  propertyId?: number | null;
  propertyTitle: string;
  propertyLocation?: string;
  recipientLabel?: string;
  onClose: () => void;
  onSuccess?: (inquiry: PropertyInquiryItem) => void;
  onRequestPaidVisit?: (scheduledDate: string) => void;
}

type FieldErrors = Partial<
  Record<'nom' | 'prenom' | 'telephone' | 'email' | 'scheduled_date' | 'message', string>
>;

const ACTION_TABS: Array<{ key: PropertyActionTab; label: string }> = [
  { key: 'demande_visite', label: 'Demande de visite' },
  { key: 'rendez_vous', label: 'Prendre RDV' },
  { key: 'contact', label: 'Contacter' },
];

const MEETING_MODES: Array<{ key: InquiryMeetingMode; label: string }> = [
  { key: 'sur_place', label: 'Sur place' },
  { key: 'appel', label: 'Appel téléphonique' },
  { key: 'agence', label: 'En agence' },
];

export function PropertyActionModal({
  visible,
  initialAction = 'demande_visite',
  propertyId,
  propertyTitle,
  propertyLocation,
  recipientLabel = 'le propriétaire / agent',
  onClose,
  onSuccess,
  onRequestPaidVisit,
}: PropertyActionModalProps) {
  const theme = useTheme();
  const { twoColLayout } = useResponsive();
  const { user, isAuthenticated } = useAuth();
  const { tarifs } = usePlatformConfig();

  const [actionType, setActionType] = useState<PropertyActionTab>(initialAction);
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [scheduledDate, setScheduledDate] = useState(() => formatLocalFutureDate(1, 10));
  const [meetingMode, setMeetingMode] = useState<InquiryMeetingMode>('sur_place');
  const [sujet, setSujet] = useState('');
  const [message, setMessage] = useState('');

  const [errors, setErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setActionType(initialAction);
    setErrors({});
    setGlobalError(null);
    setSuccessMsg(null);

    if (user) {
      const split = splitFullName(user.fullName || user.name, user.nom, user.prenom);
      setNom(split.nom);
      setPrenom(split.prenom);
      setTelephone(user.phone || '');
      setEmail(user.email || '');
    }
    setScheduledDate(formatLocalFutureDate(1, 10));
  }, [visible, initialAction, user]);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!isValidPersonName(nom)) {
      next.nom = 'Veuillez saisir un nom valide (min. 2 lettres).';
    }
    if (!isValidPersonName(prenom)) {
      next.prenom = 'Veuillez saisir un prénom valide (min. 2 lettres).';
    }
    if (!isValidPhone(telephone)) {
      next.telephone = 'Numéro invalide (ex: 0197001122 ou +2290197001122).';
    }
    if (!isValidEmail(email)) {
      next.email = 'Adresse e-mail invalide (ex: nom@exemple.com).';
    }
    if (actionType !== 'contact' && !isFutureDateString(scheduledDate)) {
      next.scheduled_date = 'Saisissez une date future valide (AAAA-MM-JJ HH:MM:SS).';
    }
    if (actionType === 'contact' && message.trim().length < 10) {
      next.message = 'Veuillez rédiger un message d\'au moins 10 caractères.';
    }
    return next;
  };

  const handleSubmit = async () => {
    setGlobalError(null);
    setSuccessMsg(null);
    const fieldErrors = validate();
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      setGlobalError('Veuillez corriger les champs signalés ci-dessous.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        property_id: propertyId ?? null,
        type: actionType as InquiryActionType,
        nom: nom.trim(),
        prenom: prenom.trim(),
        telephone: telephone.trim(),
        email: email.trim(),
        scheduled_date: actionType !== 'contact' ? scheduledDate.trim() : null,
        meeting_mode: actionType === 'rendez_vous' ? meetingMode : actionType === 'demande_visite' ? 'sur_place' : null,
        sujet: sujet.trim() || `${ACTION_TABS.find((t) => t.key === actionType)?.label} — ${propertyTitle}`,
        message: message.trim() || null,
      };

      const res = await inquiriesApi.create(payload);

      if (res.success && res.data) {
        await localInquiriesStorage.add(res.data);
        setSuccessMsg(
          res.message ||
            'Votre demande et vos coordonnées ont été enregistrées avec succès.'
        );
        onSuccess?.(res.data);
        return;
      }

      if (res.errors) {
        const mapped: FieldErrors = {};
        for (const [k, v] of Object.entries(res.errors)) {
          if (v && v[0]) (mapped as any)[k] = v[0];
        }
        setErrors(mapped);
        setGlobalError(res.message || 'Certains champs sont invalides.');
        return;
      }

      // Fallback local sauvegarde si bien de démonstration sans ID backend
      if (!propertyId) {
        const localItem: PropertyInquiryItem = {
          id: Date.now(),
          property_id: null,
          type: actionType,
          nom: nom.trim(),
          prenom: prenom.trim(),
          telephone: telephone.trim(),
          email: email.trim(),
          scheduled_date: actionType !== 'contact' ? scheduledDate.trim() : null,
          meeting_mode: actionType === 'rendez_vous' ? meetingMode : null,
          sujet: payload.sujet,
          message: payload.message,
          status: 'nouveau',
          created_at: new Date().toISOString(),
        };
        await localInquiriesStorage.add(localItem);
        setSuccessMsg('Votre demande a bien été enregistrée. Notre équipe vous recontactera.');
        onSuccess?.(localItem);
        return;
      }

      setGlobalError(res.message || "Impossible d'envoyer votre demande pour le moment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}>
        <View
          style={[
            styles.dialog,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.cardBorder,
            },
          ]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.cardBorder }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
                Actions sur ce bien
              </Text>
              <Text style={[styles.headerSub, { color: theme.textSecondary }]} numberOfLines={1}>
                {propertyTitle}
                {propertyLocation ? ` • ${propertyLocation}` : ''}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.backgroundElement }]}
              hitSlop={8}>
              <X size={18} color={theme.text} strokeWidth={2.2} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* Action switcher tabs */}
            <View style={styles.tabsRow}>
              {ACTION_TABS.map((tab) => {
                const active = actionType === tab.key;
                const iconColor = active ? '#FFFFFF' : theme.primary;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => {
                      setActionType(tab.key);
                      setErrors({});
                      setGlobalError(null);
                      setSuccessMsg(null);
                    }}
                    style={[
                      styles.tabPill,
                      {
                        backgroundColor: active ? theme.primary : theme.backgroundElement,
                        borderColor: active ? theme.primary : theme.cardBorder,
                      },
                    ]}>
                    {tab.key === 'demande_visite' ? (
                      <Home size={14} color={iconColor} strokeWidth={2.2} />
                    ) : tab.key === 'rendez_vous' ? (
                      <Calendar size={14} color={iconColor} strokeWidth={2.2} />
                    ) : (
                      <Mail size={14} color={iconColor} strokeWidth={2.2} />
                    )}
                    <Text
                      style={{
                        color: active ? '#FFFFFF' : theme.text,
                        fontSize: 12,
                        fontWeight: '700',
                      }}>
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {successMsg ? (
              <View style={styles.successBox}>
                <Text style={styles.successTitle}>Demande enregistrée avec succès</Text>
                <Text style={styles.successText}>{successMsg}</Text>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryText}>
                    Demandeur : {prenom} {nom} • {telephone} • {email}
                  </Text>
                </View>

                {actionType === 'demande_visite' && onRequestPaidVisit && isAuthenticated && propertyId ? (
                  <Pressable
                    onPress={() => {
                      onClose();
                      onRequestPaidVisit(scheduledDate);
                    }}
                    style={[styles.goldBtn, { backgroundColor: theme.gold }]}>
                    <Text style={styles.goldBtnText}>
                      {tarifs
                        ? `Confirmer en visite terrain prioritaire (${tarifs.visite} F CFA)`
                        : 'Confirmer en visite terrain prioritaire'}
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={onClose}
                  style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
                  <Text style={styles.primaryBtnText}>Fermer</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {globalError && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{globalError}</Text>
                  </View>
                )}

                <Text style={[styles.sectionHeading, { color: theme.text }]}>
                  Vos coordonnées (obligatoires)
                </Text>

                {/* Nom & Prénom */}
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
                      placeholder="Ex: Hounsou"
                      placeholderTextColor={theme.textSecondary}
                      value={nom}
                      onChangeText={(v) => {
                        setNom(v);
                        if (errors.nom) setErrors((prev) => ({ ...prev, nom: undefined }));
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
                      placeholder="Ex: Aline"
                      placeholderTextColor={theme.textSecondary}
                      value={prenom}
                      onChangeText={(v) => {
                        setPrenom(v);
                        if (errors.prenom) setErrors((prev) => ({ ...prev, prenom: undefined }));
                      }}
                    />
                    {errors.prenom ? <Text style={styles.fieldError}>{errors.prenom}</Text> : null}
                  </View>
                </View>

                {/* Téléphone & E-mail */}
                <View style={twoColLayout ? styles.twoCol : styles.oneCol}>
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { color: theme.text }]}>Téléphone *</Text>
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
                        if (errors.telephone) setErrors((prev) => ({ ...prev, telephone: undefined }));
                      }}
                    />
                    {errors.telephone ? <Text style={styles.fieldError}>{errors.telephone}</Text> : null}
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
                      placeholder="Ex: nom@exemple.com"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={(v) => {
                        setEmail(v);
                        if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                      }}
                    />
                    {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
                  </View>
                </View>

                {/* Date & heure pour visite / RDV */}
                {actionType !== 'contact' && (
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { color: theme.text }]}>
                      Date et heure souhaitées *
                    </Text>
                    <View style={styles.presetsRow}>
                      {[
                        { label: 'Demain 10h', days: 1, hour: 10 },
                        { label: 'Demain 15h', days: 1, hour: 15 },
                        { label: 'Dans 2j 10h', days: 2, hour: 10 },
                        { label: 'Dans 3j 16h', days: 3, hour: 16 },
                      ].map((slot) => {
                        const val = formatLocalFutureDate(slot.days, slot.hour);
                        const active = scheduledDate === val;
                        return (
                          <Pressable
                            key={slot.label}
                            onPress={() => {
                              setScheduledDate(val);
                              setErrors((prev) => ({ ...prev, scheduled_date: undefined }));
                            }}
                            style={[
                              styles.presetChip,
                              {
                                backgroundColor: active ? theme.primaryLight : theme.backgroundElement,
                                borderColor: active ? theme.primary : theme.cardBorder,
                              },
                            ]}>
                            <Text
                              style={{
                                color: active ? theme.primaryDark : theme.text,
                                fontSize: 12,
                                fontWeight: '700',
                              }}>
                              {slot.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          color: theme.text,
                          backgroundColor: theme.backgroundElement,
                          borderColor: errors.scheduled_date ? '#DC2626' : theme.cardBorder,
                        },
                      ]}
                      value={scheduledDate}
                      onChangeText={(v) => {
                        setScheduledDate(v);
                        if (errors.scheduled_date) {
                          setErrors((prev) => ({ ...prev, scheduled_date: undefined }));
                        }
                      }}
                      placeholder="AAAA-MM-JJ HH:MM:SS"
                      placeholderTextColor={theme.textSecondary}
                    />
                    {errors.scheduled_date ? (
                      <Text style={styles.fieldError}>{errors.scheduled_date}</Text>
                    ) : null}
                  </View>
                )}

                {/* Mode de RDV */}
                {actionType === 'rendez_vous' && (
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { color: theme.text }]}>Mode de rendez-vous</Text>
                    <View style={styles.presetsRow}>
                      {MEETING_MODES.map((m) => {
                        const active = meetingMode === m.key;
                        return (
                          <Pressable
                            key={m.key}
                            onPress={() => setMeetingMode(m.key)}
                            style={[
                              styles.presetChip,
                              {
                                backgroundColor: active ? theme.navy : theme.backgroundElement,
                                borderColor: active ? theme.navy : theme.cardBorder,
                              },
                            ]}>
                            <Text
                              style={{
                                color: active ? '#FFFFFF' : theme.text,
                                fontSize: 12,
                                fontWeight: '700',
                              }}>
                              {m.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Objet pour contact */}
                {actionType === 'contact' && (
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { color: theme.text }]}>Objet du message</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          color: theme.text,
                          backgroundColor: theme.backgroundElement,
                          borderColor: theme.cardBorder,
                        },
                      ]}
                      placeholder={`Contacter ${recipientLabel}`}
                      placeholderTextColor={theme.textSecondary}
                      value={sujet}
                      onChangeText={setSujet}
                    />
                  </View>
                )}

                {/* Message / notes */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.text }]}>
                    {actionType === 'contact' ? 'Votre message *' : 'Précisions / questions (optionnel)'}
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
                    placeholder={
                      actionType === 'contact'
                        ? `Bonjour, je suis intéressé(e) par ce bien et souhaiterais obtenir plus d'informations...`
                        : 'Indiquez vos disponibilités ou questions particulières...'
                    }
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    value={message}
                    onChangeText={(v) => {
                      setMessage(v);
                      if (errors.message) setErrors((prev) => ({ ...prev, message: undefined }));
                    }}
                  />
                  {errors.message ? <Text style={styles.fieldError}>{errors.message}</Text> : null}
                </View>

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
                    <Text style={styles.primaryBtnText}>
                      {actionType === 'demande_visite'
                        ? 'Enregistrer la demande de visite'
                        : actionType === 'rendez_vous'
                        ? 'Confirmer la prise de rendez-vous'
                        : `Envoyer le message à ${recipientLabel}`}
                    </Text>
                  )}
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.three,
  },
  dialog: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '90%',
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  headerSub: { fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: Spacing.four,
    gap: 12,
  },
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 12,
  },
  oneCol: {
    gap: 12,
  },
  fieldGroup: {
    flex: 1,
    gap: 5,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
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
    minHeight: 88,
    textAlignVertical: 'top',
  },
  fieldError: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorBannerText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '600',
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  goldBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    width: '100%',
  },
  goldBtnText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  successBox: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.four,
    gap: 12,
  },
  successTitle: {
    color: '#065F46',
    fontSize: 17,
    fontWeight: '900',
  },
  successText: {
    color: '#047857',
    fontSize: 14,
    lineHeight: 20,
  },
  summaryChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
  },
  summaryText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
});
