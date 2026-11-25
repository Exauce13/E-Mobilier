import { ArrowLeft, Building2, Eye, EyeOff, Lock, Phone } from 'lucide-react-native';
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
  const { login } = useAuth();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleLogin = async () => {
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
    try {
      const response = await login(phone.trim(), password);

      if (!response.success) {
        setMessage({
          text: response.message || 'Numéro de téléphone ou mot de passe incorrect.',
          type: 'error',
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
              <ArrowLeft size={20} color={theme.text} strokeWidth={2.2} />
            </Pressable>
          </View>
        )}

        {/* Brand Logo & Name */}
        <View style={styles.brandContainer}>
          <View style={[styles.logoIconCircle, { backgroundColor: theme.primaryLight }]}>
            <Building2 size={24} color={theme.primary} strokeWidth={2.2} />
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
              <Phone size={14} color={theme.primary} strokeWidth={2.2} />
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
              <Lock size={18} color={theme.textSecondary} strokeWidth={2} />
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
              {showPassword ? (
                <Eye size={19} color={theme.textSecondary} strokeWidth={2} />
              ) : (
                <EyeOff size={19} color={theme.textSecondary} strokeWidth={2} />
              )}
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
