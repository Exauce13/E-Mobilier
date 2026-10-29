import { SymbolView } from 'expo-symbols';
import React, { useState } from 'react';
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

import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';

export type UserRole = 'client_proprietaire' | 'agent_immobilier';

interface RegisterViewProps {
  onNavigateToLogin?: () => void;
  onSuccessRegister?: (userData: {
    fullName: string;
    phone: string;
    email?: string;
    role: UserRole;
  }) => void;
  onBack?: () => void;
}

export function RegisterView({
  onNavigateToLogin,
  onSuccessRegister,
  onBack,
}: RegisterViewProps) {
  const theme = useTheme();
  const { register } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('client_proprietaire');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleRegister = async () => {
    setMessage(null);
    if (!fullName.trim()) {
      setMessage({ text: 'Veuillez renseigner votre nom complet.', type: 'error' });
      return;
    }
    if (!phone.trim()) {
      setMessage({ text: 'Veuillez saisir votre numéro de téléphone (MTN ou Moov).', type: 'error' });
      return;
    }
    if (!password.trim() || password.length < 6) {
      setMessage({ text: 'Le mot de passe doit comporter au moins 6 caractères.', type: 'error' });
      return;
    }
    if (!acceptedTerms) {
      setMessage({ text: 'Veuillez accepter les conditions d’utilisation pour continuer.', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const response = await register({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        password: password,
        role: selectedRole,
        acceptedTerms: true,
      });

      if (!response.success) {
        setMessage({
          text: response.message || 'Une erreur est survenue lors de l’inscription.',
          type: 'error',
        });
        return;
      }

      setMessage({
        text: response.message || 'Compte créé avec succès ! Bienvenue dans la communauté E-Mobilier.',
        type: 'success',
      });

      if (onSuccessRegister) {
        onSuccessRegister({
          fullName,
          phone,
          email: email.trim() || undefined,
          role: selectedRole,
        });
      }
    } catch {
      setMessage({
        text: 'Erreur de communication avec le serveur backend.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        
        {/* Top Header with Back Arrow */}
        <View style={styles.topBar}>
          <Pressable
            onPress={onBack || onNavigateToLogin}
            style={({ pressed }) => [
              styles.backButton,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={10}>
            <SymbolView
              name={{ ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' }}
              size={20}
              tintColor={theme.text}
            />
          </Pressable>
        </View>

        {/* Title & Subtitle */}
        <View style={styles.titleSection}>
          <Text style={[styles.mainTitle, { color: theme.text }]}>Créer un compte</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Rejoignez E-Mobilier pour trouver ou publier des biens au Bénin.
          </Text>
        </View>

        {/* Feedback message banner */}
        {message && (
          <View
            style={[
              styles.feedbackBanner,
              {
                backgroundColor: message.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                borderColor: message.type === 'success' ? '#A7F3D0' : '#FECACA',
              },
            ]}>
            <Text
              style={[
                styles.feedbackText,
                { color: message.type === 'success' ? '#047857' : '#B91C1C' },
              ]}>
              {message.text}
            </Text>
          </View>
        )}

        {/* Form Inputs */}
        <View style={styles.formContainer}>
          {/* Nom complet */}
          <Text style={[styles.fieldLabel, { color: theme.text }]}>Nom complet</Text>
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}>
            <View style={styles.inputIcon}>
              <SymbolView
                name={{ ios: 'person.fill', android: 'person', web: 'person' }}
                size={19}
                tintColor={theme.textSecondary}
              />
            </View>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Nom complet"
              placeholderTextColor={theme.textSecondary}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          {/* Numéro de téléphone */}
          <Text style={[styles.fieldLabel, { color: theme.text }]}>Numéro de téléphone</Text>
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}>
            <View style={[styles.prefixBadge, { backgroundColor: theme.tagBackground }]}>
              <Text style={styles.flag}>🇧🇯</Text>
              <Text style={[styles.prefix, { color: theme.text }]}>+229</Text>
            </View>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Numéro de téléphone (MTN / Moov)"
              placeholderTextColor={theme.textSecondary}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          {/* Adresse e-mail (Optionnel) */}
          <Text style={[styles.fieldLabel, { color: theme.text }]}>Adresse e-mail (Optionnel)</Text>
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}>
            <View style={styles.inputIcon}>
              <SymbolView
                name={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
                size={18}
                tintColor={theme.textSecondary}
              />
            </View>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Adresse e-mail (Optionnel)"
              placeholderTextColor={theme.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Mot de passe */}
          <Text style={[styles.fieldLabel, { color: theme.text }]}>Mot de passe</Text>
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}>
            <View style={styles.inputIcon}>
              <SymbolView
                name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                size={19}
                tintColor={theme.textSecondary}
              />
            </View>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Mot de passe"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeBtn}
              hitSlop={10}>
              <SymbolView
                name={{
                  ios: showPassword ? 'eye.fill' : 'eye.slash.fill',
                  android: showPassword ? 'visibility' : 'visibility_off',
                  web: showPassword ? 'visibility' : 'visibility_off',
                }}
                size={20}
                tintColor={theme.textSecondary}
              />
            </Pressable>
          </View>

          {/* Role Selection Segmented Choices */}
          <View style={styles.roleSection}>
            <Text style={[styles.roleSectionTitle, { color: theme.text }]}>Je suis :</Text>
            <View style={styles.segmentedContainer}>
              {/* Option 1: Client / Propriétaire */}
              <Pressable
                onPress={() => setSelectedRole('client_proprietaire')}
                style={({ pressed }) => [
                  styles.segmentOption,
                  selectedRole === 'client_proprietaire'
                    ? [
                        styles.segmentOptionSelected,
                        {
                          borderColor: theme.primary,
                          backgroundColor: theme.primaryLight,
                        },
                      ]
                    : [
                        styles.segmentOptionUnselected,
                        {
                          borderColor: theme.cardBorder,
                          backgroundColor: theme.cardBackground,
                        },
                      ],
                  pressed && { opacity: 0.85 },
                ]}>
                {selectedRole === 'client_proprietaire' && (
                  <View style={[styles.checkBadge, { backgroundColor: theme.primary }]}>
                    <SymbolView
                      name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                      size={12}
                      tintColor="#FFFFFF"
                    />
                  </View>
                )}
                <Text
                  style={[
                    styles.segmentText,
                    selectedRole === 'client_proprietaire'
                      ? { color: theme.primaryDark, fontWeight: '700' }
                      : { color: theme.textSecondary, fontWeight: '500' },
                  ]}>
                  Client / Propriétaire
                </Text>
              </Pressable>

              {/* Option 2: Agent Immobilier */}
              <Pressable
                onPress={() => setSelectedRole('agent_immobilier')}
                style={({ pressed }) => [
                  styles.segmentOption,
                  selectedRole === 'agent_immobilier'
                    ? [
                        styles.segmentOptionSelected,
                        {
                          borderColor: theme.primary,
                          backgroundColor: theme.primaryLight,
                        },
                      ]
                    : [
                        styles.segmentOptionUnselected,
                        {
                          borderColor: theme.cardBorder,
                          backgroundColor: theme.cardBackground,
                        },
                      ],
                  pressed && { opacity: 0.85 },
                ]}>
                {selectedRole === 'agent_immobilier' && (
                  <View style={[styles.checkBadge, { backgroundColor: theme.primary }]}>
                    <SymbolView
                      name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                      size={12}
                      tintColor="#FFFFFF"
                    />
                  </View>
                )}
                <Text
                  style={[
                    styles.segmentText,
                    selectedRole === 'agent_immobilier'
                      ? { color: theme.primaryDark, fontWeight: '700' }
                      : { color: theme.textSecondary, fontWeight: '500' },
                  ]}>
                  Agent Immobilier
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Terms and conditions Checkbox */}
          <Pressable
            onPress={() => setAcceptedTerms(!acceptedTerms)}
            style={styles.termsRow}>
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: acceptedTerms ? theme.primary : theme.cardBorder,
                  backgroundColor: acceptedTerms ? theme.primary : theme.cardBackground,
                },
              ]}>
              {acceptedTerms && (
                <SymbolView
                  name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                  size={14}
                  tintColor="#FFFFFF"
                />
              )}
            </View>
            <Text style={[styles.termsText, { color: theme.text }]}>
              J'accepte les{' '}
              <Text style={[styles.termsLink, { color: theme.primary }]}>
                conditions d'utilisation
              </Text>
            </Text>
          </Pressable>

          {/* Submit Button */}
          <Pressable
            onPress={handleRegister}
            disabled={loading}
            style={({ pressed }) => [
              styles.submitButton,
              { backgroundColor: theme.primary },
              pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
            ]}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>S'inscrire</Text>
            )}
          </Pressable>
        </View>

        {/* Footer Switch Link */}
        <View style={styles.footerRow}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            Déjà inscrit ?{' '}
          </Text>
          <Pressable onPress={onNavigateToLogin}>
            <Text style={[styles.footerLink, { color: theme.primary }]}>Se connecter</Text>
          </Pressable>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleSection: {
    marginBottom: Spacing.four,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: Spacing.one,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  feedbackBanner: {
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: Spacing.three,
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.one,
    marginTop: Spacing.two,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    height: 52,
    marginBottom: Spacing.two,
  },
  inputIcon: {
    marginRight: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
  },
  prefixBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginRight: Spacing.two,
    gap: 4,
  },
  flag: {
    fontSize: 16,
  },
  prefix: {
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleSection: {
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
  },
  roleSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.two,
  },
  segmentedContainer: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  segmentOption: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
  },
  segmentOptionSelected: {
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 1,
  },
  segmentOptionUnselected: {},
  checkBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 13,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
    marginBottom: Spacing.four,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  termsText: {
    fontSize: 13,
    flex: 1,
  },
  termsLink: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  submitButton: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.five,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});
