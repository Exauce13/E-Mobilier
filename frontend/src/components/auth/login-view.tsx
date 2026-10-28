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
}: LoginViewProps) {
  const theme = useTheme();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleLogin = () => {
    setMessage(null);
    if (!phone.trim()) {
      setMessage({ text: 'Veuillez saisir votre numéro de téléphone béninois.', type: 'error' });
      return;
    }
    if (!password.trim()) {
      setMessage({ text: 'Veuillez entrer votre mot de passe.', type: 'error' });
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setMessage({ text: 'Connexion réussie ! Bienvenue sur E-Mobilier.', type: 'success' });
      if (onSuccessLogin) {
        onSuccessLogin(phone);
      }
    }, 700);
  };

  const handleSendOtp = () => {
    setMessage(null);
    if (!phone.trim()) {
      setMessage({ text: 'Veuillez saisir votre numéro pour recevoir le code OTP.', type: 'error' });
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setOtpSent(true);
      setMessage({
        text: `Code OTP envoyé par SMS au +229 ${phone}. (Code démo : 2290)`,
        type: 'success',
      });
    }, 600);
  };

  const handleVerifyOtp = () => {
    if (otpCode.trim() !== '2290' && otpCode.trim().length < 4) {
      setMessage({ text: 'Code OTP invalide. Utilisez le code démo 2290.', type: 'error' });
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setMessage({ text: 'Vérification réussie ! Connecté par OTP.', type: 'success' });
      if (onSuccessLogin) {
        onSuccessLogin(phone);
      }
    }, 600);
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
              name={{ ios: 'house.lodge.fill', android: 'home', web: 'home' }}
              size={28}
              tintColor={theme.primary}
            />
          </View>
          <Text style={[styles.brandTitle, { color: theme.primaryDark }]}>E-Mobilier</Text>
        </View>

        {/* Heading & Sub-headline */}
        <View style={styles.headerBlock}>
          <Text style={[styles.screenTitle, { color: theme.text }]}>Se connecter</Text>
          <Text style={[styles.screenSubtitle, { color: theme.textSecondary }]}>
            Ravis de vous revoir !
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

        {/* Form Inputs */}
        <View style={styles.formSection}>
          {/* Phone Field */}
          <Text style={[styles.inputLabel, { color: theme.text }]}>Numéro de téléphone</Text>
          <View
            style={[
              styles.inputRow,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}>
            <View style={[styles.prefixBadge, { backgroundColor: theme.tagBackground }]}>
              <Text style={styles.flagEmoji}>🇧🇯</Text>
              <Text style={[styles.prefixText, { color: theme.text }]}>+229</Text>
            </View>
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Numéro de téléphone (MTN / Moov)"
              placeholderTextColor={theme.textSecondary}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoCapitalize="none"
            />
          </View>

          {!otpMode ? (
            <>
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

              {/* Forgot Password Link */}
              <View style={styles.forgotPasswordContainer}>
                <Pressable
                  onPress={() =>
                    setMessage({
                      text: 'Un lien de réinitialisation sera envoyé par SMS.',
                      type: 'success',
                    })
                  }>
                  <Text style={[styles.forgotPasswordText, { color: theme.primary }]}>
                    Mot de passe oublié ?
                  </Text>
                </Pressable>
              </View>

              {/* Primary Submit Button */}
              <Pressable
                onPress={handleLogin}
                disabled={loading}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.primary },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
                ]}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Se connecter</Text>
                )}
              </Pressable>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: theme.cardBorder }]} />
                <Text style={[styles.dividerText, { color: theme.textSecondary }]}>ou</Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.cardBorder }]} />
              </View>

              {/* Secondary Button: OTP SMS */}
              <Pressable
                onPress={() => {
                  setOtpMode(true);
                  setMessage(null);
                }}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  {
                    borderColor: theme.primary,
                    backgroundColor: theme.primaryLight,
                  },
                  pressed && { opacity: 0.8 },
                ]}>
                <SymbolView
                  name={{ ios: 'message.fill', android: 'sms', web: 'sms' }}
                  size={18}
                  tintColor={theme.primary}
                />
                <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>
                  Se connecter par OTP SMS
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              {/* OTP Code Input */}
              {otpSent && (
                <>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>Code de sécurité OTP</Text>
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
                        name={{ ios: 'key.fill', android: 'vpn_key', web: 'vpn_key' }}
                        size={20}
                        tintColor={theme.primary}
                      />
                    </View>
                    <TextInput
                      style={[styles.textInput, { color: theme.text, letterSpacing: 4 }]}
                      placeholder="Code à 4 chiffres (ex: 2290)"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={otpCode}
                      onChangeText={setOtpCode}
                    />
                  </View>
                </>
              )}

              {/* OTP Submit Button */}
              <Pressable
                onPress={otpSent ? handleVerifyOtp : handleSendOtp}
                disabled={loading}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.primary },
                  pressed && { opacity: 0.9 },
                ]}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {otpSent ? 'Valider le code OTP' : 'Envoyer le code SMS'}
                  </Text>
                )}
              </Pressable>

              {/* Back to password mode */}
              <Pressable
                onPress={() => {
                  setOtpMode(false);
                  setOtpSent(false);
                  setMessage(null);
                }}
                style={styles.switchModeButton}>
                <Text style={[styles.switchModeText, { color: theme.textSecondary }]}>
                  ← Revenir à la connexion par mot de passe
                </Text>
              </Pressable>
            </>
          )}
        </View>

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
