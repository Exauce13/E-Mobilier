import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Bell, Camera, CreditCard, LogOut, ShieldCheck, Trash2, User } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { authApi } from '@/services/api';
import { confirmDialog, showMessage } from '@/utils/dialog';

export default function UserProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { horizontalPadding } = useResponsive();
  const { user, isAuthenticated, isAgentMobilier, openAuthModal, refreshProfile, logout } = useAuth();

  const [name, setName] = useState(user?.nom || '');
  const [prenom, setPrenom] = useState(user?.prenom || '');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.nom || '');
      setPrenom(user.prenom || '');
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (name.trim().length < 2 || prenom.trim().length < 2) {
      showMessage('Validation', 'Le nom et le prénom doivent contenir au moins 2 caractères.');
      return;
    }
    setSaving(true);
    const res = await authApi.updateProfil({ name: name.trim(), prenom: prenom.trim() });
    setSaving(false);
    if (res.success) {
      await refreshProfile();
      showMessage('Profil mis à jour', res.message || 'Vos informations ont été enregistrées.');
    } else {
      showMessage('Erreur', res.message || 'Impossible de mettre à jour votre profil.');
    }
  };

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      const fileName = asset.fileName || `avatar_${Date.now()}.jpg`;
      const mimeType = asset.mimeType || 'image/jpeg';

      if (Platform.OS === 'web') {
        const resp = await fetch(asset.uri);
        const blob = await resp.blob();
        formData.append('photo', blob, fileName);
      } else {
        formData.append('photo', {
          uri: asset.uri,
          name: fileName,
          type: mimeType,
        } as any);
      }

      const res = await authApi.uploadPhotoProfil(formData);
      if (res.success) {
        await refreshProfile();
        showMessage('Photo mise à jour', res.message || 'Votre photo de profil a été enregistrée.');
      } else {
        showMessage('Erreur', res.message || "Impossible d'envoyer cette image.");
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async () => {
    const ok = await confirmDialog(
      'Supprimer la photo ?',
      'Voulez-vous retirer votre photo de profil actuelle ?',
      'Supprimer'
    );
    if (!ok) return;
    setUploadingPhoto(true);
    const res = await authApi.deletePhotoProfil();
    setUploadingPhoto(false);
    if (res.success) {
      await refreshProfile();
      showMessage('Photo supprimée', res.message || 'Photo de profil retirée.');
    } else {
      showMessage('Erreur', res.message || 'Impossible de supprimer la photo.');
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
        <ScreenHeader title="Mon Profil" subtitle="Compte E-Mobilier" />
        <View style={styles.center}>
          <User size={34} color={theme.primary} strokeWidth={2.2} />
          <Text style={[styles.title, { color: theme.text }]}>Connectez-vous à votre compte</Text>
          <Pressable
            onPress={() => openAuthModal('login')}
            style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
            <Text style={styles.primaryBtnText}>Se connecter</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const initials = (user.name || 'EM')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Mon Profil" subtitle={user.roles?.join(' • ') || 'Compte actif'} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + 36 },
        ]}>
        <View style={styles.innerWrap}>
          {/* Avatar Card */}
          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.avatarRow}>
              {user.photo_url ? (
                <Image source={{ uri: user.photo_url }} style={styles.avatarImg} contentFit="cover" />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: theme.primary }]}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.title, { color: theme.text }]}>{user.name}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{user.phone}</Text>
                {user.email ? (
                  <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{user.email}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.btnRow}>
              <Pressable
                onPress={() => void handlePickPhoto()}
                disabled={uploadingPhoto}
                style={[styles.secondaryBtn, { borderColor: theme.primary, backgroundColor: theme.primaryLight }]}>
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <>
                    <Camera size={15} color={theme.primary} strokeWidth={2.2} />
                    <Text style={{ color: theme.primaryDark, fontWeight: '800', fontSize: 13 }}>
                      Changer la photo
                    </Text>
                  </>
                )}
              </Pressable>

              {user.photo_url ? (
                <Pressable
                  onPress={() => void handleDeletePhoto()}
                  disabled={uploadingPhoto}
                  style={[styles.secondaryBtn, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
                  <Trash2 size={15} color="#DC2626" strokeWidth={2.2} />
                  <Text style={{ color: '#DC2626', fontWeight: '800', fontSize: 13 }}>Retirer</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Identity Edit Form */}
          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Informations personnelles</Text>

            <View style={{ gap: 6 }}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Prénom</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
                value={prenom}
                onChangeText={setPrenom}
                placeholder="Votre prénom"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Nom</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
                value={name}
                onChangeText={setName}
                placeholder="Votre nom"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <Pressable
              onPress={() => void handleSaveProfile()}
              disabled={saving}
              style={[styles.primaryBtn, { backgroundColor: theme.primary, opacity: saving ? 0.65 : 1 }]}>
              <Text style={styles.primaryBtnText}>
                {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </Text>
            </Pressable>
          </View>

          {/* Account Shortcuts */}
          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Raccourcis compte</Text>

            {!isAgentMobilier && (
              <Pressable
                onPress={() => router.push('/transactions' as any)}
                style={[styles.linkRow, { borderBottomColor: theme.cardBorder }]}>
                <CreditCard size={17} color={theme.primary} strokeWidth={2.2} />
                <Text style={[styles.linkLabel, { color: theme.text }]}>Paiements &amp; Quittances officielles</Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => router.push('/notifications' as any)}
              style={[styles.linkRow, { borderBottomColor: theme.cardBorder }]}>
              <Bell size={17} color={theme.primary} strokeWidth={2.2} />
              <Text style={[styles.linkLabel, { color: theme.text }]}>Notifications & Alertes</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/cgu' as any)}
              style={[styles.linkRow, { borderBottomColor: 'transparent' }]}>
              <ShieldCheck size={17} color={theme.primary} strokeWidth={2.2} />
              <Text style={[styles.linkLabel, { color: theme.text }]}>Conditions Générales (CGU)</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => void logout()}
            style={[styles.logoutBtn, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
            <LogOut size={16} color="#DC2626" strokeWidth={2.2} />
            <Text style={{ color: '#DC2626', fontWeight: '800', fontSize: 14 }}>Se déconnecter</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  scroll: { paddingTop: Spacing.three },
  innerWrap: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: 14 },
  card: { borderRadius: 18, borderWidth: 1, padding: Spacing.four, gap: 12 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarImg: { width: 70, height: 70, borderRadius: 35 },
  avatarFallback: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  title: { fontSize: 18, fontWeight: '900' },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  label: { fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14 },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryBtn: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  linkLabel: { fontSize: 14, fontWeight: '700' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
  },
});
