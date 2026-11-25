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

interface LoginViewProps {
  onNavigateToRegister?: () => void;
  onSuccessLogin?: (phone: string) => void;
  onBack?: () => void;
}

export function LoginView({
  onNavigateToRegister,
  onSuccessLogin,
  onBack,
}: LoginViewProps): React.JSX.Element {
  const theme = useTheme();
  const { login, verifyTwoFactorOtp, resendTwoFactorOtp } = useAuth();

  const [loginMode, setLoginMode] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const isEmailInput = loginMode === 'email' || phone.includes('@');

  // États pour la double authentification par OTP (2FA Admin)
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [destinationMasked, setDestinationMasked] = useState('');
  const [testOtpCode, setTestOtpCode] = useState<string | undefined>();
  const [adminRole, setAdminRole] = useState<string | undefined>();
  const [resending, setResending] = useState(false);

  const handleLogin = async () => {
    setMessage(null);
    if (!phone.trim()) {
      setMessage({
        text: isEmailInput
          ? 'Veuillez saisir votre adresse e-mail.'
          : 'Veuillez saisir votre numéro de téléphone béninois ou votre e-mail.',
        type: 'error',
      });
      return;
    }
    if (!password.trim()) {
      setMessage({ text: 'Veuillez entrer votre mot de passe.', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const response = await login(phone.trim(), password);

      if (!response.success) {
        setMessage({
          text: response.message || 'Identifiant ou mot de passe incorrect.',
          type: 'error',
        });
        return;
      }

      // Si le compte administrateur exige une double authentification OTP
      if (response.requiresTwoFactor) {
        setTwoFactorToken(response.twoFactorToken || '');
        setDestinationMasked(response.destinationMasquee || '');
        setTestOtpCode(response.testOtpCode);
        setAdminRole(response.role);
        setStep('otp');
        setMessage({
          text: response.message || 'Double authentification requise. Saisissez le code OTP reçu.',
          type: 'success',
        });
        return;
      }

      setMessage({ text: response.message || 'Connexion réussie ! Bienvenue sur E-Mobilier.', type: 'success' });
      if (onSuccessLogin) {
        onSuccessLogin(phone);
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

  const handleVerifyOtp = async () => {
    setMessage(null);
    const cleanedOtp = otpCode.trim();
    if (!cleanedOtp || cleanedOtp.length !== 6) {
      setMessage({ text: 'Veuillez saisir le code OTP à 6 chiffres.', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const response = await verifyTwoFactorOtp(twoFactorToken, cleanedOtp);

      if (!response.success) {
        setMessage({
          text: response.message || 'Code OTP incorrect ou expiré.',
          type: 'error',
        });
        return;
      }

      setMessage({ text: response.message || 'Double authentification réussie !', type: 'success' });
      if (onSuccessLogin) {
        onSuccessLogin(phone);
      }
    } catch {
      setMessage({
        text: 'Erreur lors de la validation du code OTP.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!twoFactorToken || resending) return;
    setResending(true);
    setMessage(null);
    try {
      const response = await resendTwoFactorOtp(twoFactorToken);
      if (response.success) {
        if (response.twoFactorToken) setTwoFactorToken(response.twoFactorToken);
        if (response.testOtpCode) setTestOtpCode(response.testOtpCode);
        setMessage({
          text: response.message || 'Un nouveau code OTP a été envoyé.',
          type: 'success',
        });
      } else {
        setMessage({
          text: response.message || 'Impossible de renvoyer le code OTP.',
          type: 'error',
        });
      }
    } catch {
      setMessage({ text: 'Erreur réseau lors du renvoi du code.', type: 'error' });
    } finally {
      setResending(false);
    }
  };

  const handleBackToCredentials = () => {
    setStep('credentials');
    setOtpCode('');
    setMessage(null);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        
        {/* Optional Back Button */}
        {onBack && (
          <View style={styles.topBar}>
            <Pressable
              onPress={onBack}
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
        )}

        {/* Brand Logo & Name */}
        <View style={styles.brandContainer}>
          <View style={[styles.logoIconCircle, { backgroundColor: theme.primaryLight }]}>
            <SymbolView
              name={step === 'otp' ? { ios: 'shield.lefthalf.filled.badge.checkmark', android: 'verified_user', web: 'verified_user' } : { ios: 'house.lodge.fill', android: 'home', web: 'home' }}
              size={28}
              tintColor={theme.primary}
            />
          </View>
          <Text style={[styles.brandTitle, { color: theme.primaryDark }]}>
            {step === 'otp' ? 'Sécurité Admin' : 'E-Mobilier'}
          </Text>
        </View>

        {/* Heading & Sub-headline */}
        <View style={styles.headerBlock}>
          <Text style={[styles.screenTitle, { color: theme.text }]}>
            {step === 'otp' ? 'Double Authentification' : 'Se connecter'}
          </Text>
          <Text style={[styles.screenSubtitle, { color: theme.textSecondary }]}>
            {step === 'otp'
              ? (adminRole ? `${adminRole} • Code OTP à 6 chiffres` : 'Vérification de sécurité administrateur requise')
              : 'Ravis de vous revoir !'}
          </Text>
        </View>

        {/* Notification / Feedback Banner */}
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

        {/* STEP 2 : OTP Verification Screen for Admin Roles */}
        {step === 'otp' ? (
          <View style={styles.formSection}>
            <View
              style={[
                styles.otpInfoBox,
                { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
              ]}>
              <SymbolView
                name={{ ios: 'lock.shield.fill', android: 'security', web: 'security' }}
                size={22}
                tintColor={theme.primary}
              />
              <Text style={[styles.otpInfoText, { color: theme.text }]}>
                Un code de vérification à 6 chiffres a été expédié à destination de{' '}
                <Text style={{ fontWeight: '700', color: theme.primaryDark }}>
                  {destinationMasked || 'votre contact officiel'}
                </Text>
                . Valable pendant 5 minutes.
              </Text>
            </View>

            {/* Test OTP Helper Banner (en environnement local/test) */}
            {testOtpCode && (
              <Pressable
                onPress={() => setOtpCode(testOtpCode)}
                style={[styles.testOtpBadge, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                <Text style={styles.testOtpText}>
                  🧪 Code de test détecté : <Text style={{ fontWeight: '800' }}>{testOtpCode}</Text> (cliquer pour insérer)
                </Text>
              </Pressable>
            )}

            <Text style={[styles.inputLabel, { color: theme.text, marginTop: Spacing.two }]}>
              Code de sécurité OTP
            </Text>
            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                  justifyContent: 'center',
                },
              ]}>
              <View style={styles.iconPrefix}>
                <SymbolView
                  name={{ ios: 'key.fill', android: 'vpn_key', web: 'vpn_key' }}
                  size={20}
                  tintColor={theme.textSecondary}
                />
              </View>
              <TextInput
                style={[styles.otpInput, { color: theme.text }]}
                placeholder="000000"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                maxLength={6}
                value={otpCode}
                onChangeText={setOtpCode}
                autoFocus
                autoCapitalize="none"
              />
            </View>

            {/* Submit OTP Button */}
            <Pressable
              onPress={handleVerifyOtp}
              disabled={loading}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.primary, marginTop: Spacing.three },
                pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
              ]}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Valider et continuer</Text>
              )}
            </Pressable>

            {/* Resend OTP Button */}
            <Pressable
              onPress={handleResendOtp}
              disabled={resending || loading}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: theme.cardBorder, marginTop: Spacing.two },
                pressed && { opacity: 0.7 },
              ]}>
              {resending ? (
                <ActivityIndicator color={theme.primary} size="small" />
              ) : (
                <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>
                  Renvoyer un nouveau code
                </Text>
              )}
            </Pressable>

            {/* Back to credentials */}
            <Pressable
              onPress={handleBackToCredentials}
              disabled={loading}
              style={styles.switchModeButton}>
              <Text style={[styles.switchModeText, { color: theme.textSecondary }]}>
                ← Revenir à la saisie du mot de passe
              </Text>
            </Pressable>
          </View>
        ) : (
          /* STEP 1 : Normal Credentials (Phone or Email & Password) */
          <View style={styles.formSection}>
            {/* Mode Switcher: Téléphone / E-mail */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: theme.tagBackground,
                borderRadius: 12,
                padding: 4,
                gap: 4,
                marginBottom: Spacing.two,
              }}>
              <Pressable
                onPress={() => {
                  setLoginMode('phone');
                  if (phone.includes('@')) setPhone('');
                }}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 9,
                  alignItems: 'center',
                  backgroundColor: !isEmailInput ? theme.cardBackground : 'transparent',
                }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: !isEmailInput ? theme.primary : theme.textSecondary,
                  }}>
                  Téléphone (+229)
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setLoginMode('email')}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 9,
                  alignItems: 'center',
                  backgroundColor: isEmailInput ? theme.cardBackground : 'transparent',
                }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: isEmailInput ? theme.primary : theme.textSecondary,
                  }}>
                  Adresse E-mail
                </Text>
              </Pressable>
            </View>

            {/* Identifier Field */}
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              {isEmailInput ? 'Adresse e-mail' : 'Numéro de téléphone'}
            </Text>
            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}>
              {isEmailInput ? (
                <View style={styles.iconPrefix}>
                  <SymbolView
                    name={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
                    size={20}
                    tintColor={theme.textSecondary}
                  />
                </View>
              ) : (
                <View style={[styles.prefixBadge, { backgroundColor: theme.tagBackground }]}>
                  <Text style={styles.flagEmoji}>🇧🇯</Text>
                  <Text style={[styles.prefixText, { color: theme.text }]}>+229</Text>
                </View>
              )}
              <TextInput
                style={[styles.textInput, { color: theme.text }]}
                placeholder={isEmailInput ? 'exemple@e-mobilier.bj' : '0197001122 (MTN / Moov)'}
                placeholderTextColor={theme.textSecondary}
                keyboardType={isEmailInput ? 'email-address' : 'phone-pad'}
                value={phone}
                onChangeText={(val) => {
                  setPhone(val);
                  if (val.includes('@') && loginMode !== 'email') {
                    setLoginMode('email');
                  }
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password Field */}
            <Text style={[styles.inputLabel, { color: theme.text }]}>Mot de passe</Text>
            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}>
              <View style={styles.iconPrefix}>
                <SymbolView
                  name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                  size={20}
                  tintColor={theme.textSecondary}
                />
              </View>
              <TextInput
                style={[styles.textInput, { color: theme.text }]}
                placeholder="Mot de passe"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
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

            {/* Primary Submit Button */}
            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.primary, marginTop: Spacing.two },
                pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
              ]}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Se connecter</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Bottom Switch Link */}
        <View style={styles.footerRow}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            Pas encore de compte ?{' '}
          </Text>
          <Pressable onPress={onNavigateToRegister}>
            <Text style={[styles.footerLink, { color: theme.primary }]}>S'inscrire</Text>
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
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  logoIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: Spacing.one,
  },
  screenSubtitle: {
    fontSize: 15,
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
  formSection: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.one,
    marginTop: Spacing.two,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    height: 52,
    marginBottom: Spacing.two,
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
  flagEmoji: {
    fontSize: 16,
  },
  prefixText: {
    fontSize: 14,
    fontWeight: '700',
  },
  iconPrefix: {
    marginRight: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  eyeButton: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: Spacing.four,
    marginTop: 2,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '600',
  },
  primaryButton: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    marginTop: Spacing.two,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.four,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: Spacing.three,
    fontSize: 13,
    fontWeight: '500',
  },
  secondaryButton: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  switchModeButton: {
    marginTop: Spacing.three,
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  switchModeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  otpInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: Spacing.two,
  },
  otpInfoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  testOtpBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: Spacing.two,
  },
  testOtpText: {
    fontSize: 12,
    color: '#92400E',
    textAlign: 'center',
  },
  otpInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 10,
    textAlign: 'center',
    height: '100%',
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
