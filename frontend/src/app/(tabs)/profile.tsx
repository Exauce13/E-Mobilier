import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InstitutionHeader } from '@/components/ui/institution-header';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useThemeMode } from '@/context/theme-context';
import { useTheme } from '@/hooks/use-theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const { isDark, toggleTheme } = useThemeMode();
  const insets = useSafeAreaInsets();
  const {
    user,
    isAuthenticated,
    logout,
    isAdminStaff,
    isSuperAdminPrincipal,
    openAuthModal,
  } = useAuth();

  // Modals (Stitch exact)
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedDocTitle, setSelectedDocTitle] = useState('Titre Foncier n° 14.821 Cotonou');

  // Deposit Form State
  const [newTfNum, setNewTfNum] = useState('');
  const [newCommune, setNewCommune] = useState('Cotonou');
  const [newSection, setNewSection] = useState('');
  const [newLot, setNewLot] = useState('');
  const [pickedDocName, setPickedDocName] = useState<string | null>(null);
  const [depositing, setDepositing] = useState(false);

  // User Role Switcher simulation
  const [activeRoleIndex, setActiveRoleIndex] = useState(
    isAdminStaff ? 3 : isSuperAdminPrincipal ? 3 : 0
  );
  const rolesList = ['Client', 'Agent Foncier', 'Secrétaire Notarial', 'Super Admin'];

  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setPickedDocName(res.assets[0].name);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de sélectionner le fichier.');
    }
  };

  const handleDepositSubmit = () => {
    if (!newTfNum.trim()) {
      Alert.alert('Champ requis', 'Veuillez saisir le numéro du Titre Foncier.');
      return;
    }
    setDepositing(true);
    setTimeout(() => {
      setDepositing(false);
      setDepositModalOpen(false);
      Alert.alert(
        'Titre Déposé',
        `Le titre foncier ${newTfNum} a été transmis à la passerelle ANDF pour indexation cadastrale.`
      );
    }, 1200);
  };

  if (!isAuthenticated || !user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surface }]}>
        <InstitutionHeader />
        <ScrollView
          contentContainerStyle={[
            styles.guestContent,
            { paddingBottom: BottomTabInset + Spacing.six + insets.bottom },
          ]}>
          <View style={[styles.guestAvatar, { backgroundColor: theme.surfaceContainerLow }]}>
            <SymbolView
              name={{ ios: 'person.crop.circle', android: 'person', web: 'person' }}
              size={54}
              tintColor={theme.primaryContainer}
            />
          </View>
          <Text style={[styles.guestTitle, { color: theme.text }]}>Espace Personnel E-Mobilier</Text>
          <Text style={[styles.guestSub, { color: theme.textSecondary }]}>
            Connectez-vous pour accéder à votre Coffre-Fort Foncier scellé ANDF, gérer vos annonces et suivre vos visites.
          </Text>

          <View style={styles.guestBtns}>
            <Pressable
              onPress={() => openAuthModal('login')}
              style={[styles.primaryBtn, { backgroundColor: theme.primaryContainer }]}>
              <Text style={styles.primaryBtnText}>Se connecter</Text>
            </Pressable>
            <Pressable
              onPress={() => openAuthModal('register')}
              style={[styles.secondaryBtn, { borderColor: theme.primaryContainer, backgroundColor: theme.surfaceContainerLowest }]}>
              <Text style={[styles.secondaryBtnText, { color: theme.primaryContainer }]}>Créer un compte</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <InstitutionHeader />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: BottomTabInset + Spacing.six + insets.bottom },
        ]}>
        {/* 1. IDENTITY CARD (STITCH PROFIL DESIGN) */}
        <View
          style={[
            styles.identityCard,
            { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
          ]}>
          <View style={styles.identityTopRow}>
            <Image
              source={{
                uri:
                  user.photo_url ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
              }}
              style={[styles.profileAvatarImg, { borderColor: theme.primaryContainer }]}
            />

            <View style={styles.identityInfoCol}>
              <View style={styles.nameBadgeRow}>
                <Text style={styles.beninFlag}>🇧🇯</Text>
                <Text numberOfLines={1} style={[styles.identityName, { color: theme.text }]}>
                  {user.name}
                </Text>
                <View style={[styles.activePill, { backgroundColor: theme.badgeGreenBg }]}>
                  <Text style={[styles.activePillText, { color: theme.badgeGreenText }]}>Actif</Text>
                </View>
              </View>

              <View style={styles.locationMetaRow}>
                <SymbolView
                  name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }}
                  size={12}
                  tintColor={theme.primaryContainer}
                />
                <Text style={[styles.locationMetaText, { color: theme.textSecondary }]}>
                  Haie Vive, Cotonou (Bénin)
                </Text>
              </View>

              <View style={styles.kycRow}>
                <SymbolView
                  name={{ ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' }}
                  size={13}
                  tintColor={theme.primaryContainer}
                />
                <Text style={[styles.kycText, { color: theme.primaryContainer }]}>
                  KYC Validé ANDF / Notariat
                </Text>
              </View>
            </View>
          </View>

          {/* Legal Identifiers */}
          <View style={[styles.legalIdentifiersBox, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder }]}>
            <View style={styles.idLine}>
              <Text style={[styles.idLabel, { color: theme.textSecondary }]}>N° IFU Bénin :</Text>
              <Text style={[styles.idVal, { color: theme.text }]}>3201 8492 7105</Text>
            </View>
            <View style={styles.idLine}>
              <Text style={[styles.idLabel, { color: theme.textSecondary }]}>Téléphone vérifié :</Text>
              <Text style={[styles.idVal, { color: theme.primaryContainer }]}>
                {user.phone ? `+229 ${user.phone.replace(/^\+229/, '')}` : '+229 01 65 43 21'}
              </Text>
            </View>
          </View>

          {/* RBAC Role Selector Segmented Control (Stitch) */}
          <View style={styles.rbacSection}>
            <Text style={[styles.rbacHeading, { color: theme.textSecondary }]}>
              Rôle / Droits d'accès RBAC :
            </Text>
            <View style={[styles.rbacTabsBar, { backgroundColor: theme.surfaceContainerLow }]}>
              {rolesList.map((r, i) => (
                <Pressable
                  key={r}
                  onPress={() => setActiveRoleIndex(i)}
                  style={[
                    styles.rbacTabBtn,
                    activeRoleIndex === i && {
                      backgroundColor: theme.primaryContainer,
                      shadowColor: '#000',
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      elevation: 2,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.rbacTabBtnText,
                      { color: activeRoleIndex === i ? '#FFFFFF' : theme.textSecondary },
                    ]}>
                    {r}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* 2. COFFRE-FORT FONCIER & ACTES (STITCH) */}
        <View style={styles.vaultSection}>
          <View style={styles.vaultHeaderRow}>
            <View style={styles.vaultTitleCol}>
              <View style={styles.iconTitleRow}>
                <SymbolView
                  name={{ ios: 'lock.square.stack.fill', android: 'shield_with_house', web: 'shield' }}
                  size={18}
                  tintColor={theme.primaryContainer}
                />
                <Text style={[styles.vaultHeadingH1, { color: theme.text }]}>
                  Coffre-Fort Foncier
                </Text>
              </View>
              <Text style={[styles.vaultSub, { color: theme.textSecondary }]}>
                Titres de propriété certifiés et scellés sous registre ANDF
              </Text>
            </View>
          </View>

          {/* Document Cards */}
          <View style={styles.docCardsList}>
            {/* Card 1: Titre Foncier n° 14.821 Cotonou */}
            <View
              style={[
                styles.docCard,
                { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
              ]}>
              <View style={styles.docCardTop}>
                <View style={[styles.docIconCircle, { backgroundColor: theme.badgeGreenBg }]}>
                  <SymbolView
                    name={{ ios: 'doc.plaintext.fill', android: 'verified_user', web: 'verified_user' }}
                    size={16}
                    tintColor={theme.badgeGreenText}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.docCardTitle, { color: theme.text }]}>
                    Titre Foncier n° 14.821 Cotonou
                  </Text>
                  <Text style={[styles.docCardSub, { color: theme.textSecondary }]}>
                    Parcelle Haie Vive, Littoral • 650 m²
                  </Text>
                </View>
                <View style={[styles.docStatusTag, { backgroundColor: theme.badgeGreenBg }]}>
                  <Text style={[styles.docStatusText, { color: theme.badgeGreenText }]}>
                    Vérifié ANDF
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => {
                  setSelectedDocTitle('Titre Foncier n° 14.821 Cotonou');
                  setQrModalOpen(true);
                }}
                style={[
                  styles.seeQrBtn,
                  { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder },
                ]}>
                <SymbolView
                  name={{ ios: 'qrcode', android: 'qr_code_2', web: 'qr_code_2' }}
                  size={14}
                  tintColor={theme.primaryContainer}
                />
                <Text style={[styles.seeQrBtnText, { color: theme.text }]}>
                  Voir Attestation & QR Code Scellé
                </Text>
              </Pressable>
            </View>

            {/* Card 2: Attestation Bornage & Recasement */}
            <View
              style={[
                styles.docCard,
                { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
              ]}>
              <View style={styles.docCardTop}>
                <View style={[styles.docIconCircle, { backgroundColor: theme.badgeGoldBg }]}>
                  <SymbolView
                    name={{ ios: 'map.fill', android: 'layers', web: 'layers' }}
                    size={16}
                    tintColor={theme.badgeGoldText}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.docCardTitle, { color: theme.text }]}>
                    Attestation Bornage & Recasement
                  </Text>
                  <Text style={[styles.docCardSub, { color: theme.textSecondary }]}>
                    Calavi Togbin, Atlantique • 500 m²
                  </Text>
                </View>
                <View style={[styles.docStatusTag, { backgroundColor: theme.badgeGoldBg }]}>
                  <Text style={[styles.docStatusText, { color: theme.badgeGoldText }]}>
                    Validé Notariat
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => {
                  setSelectedDocTitle('Attestation Bornage & Recasement — Calavi Togbin');
                  setQrModalOpen(true);
                }}
                style={[
                  styles.seeQrBtn,
                  { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder },
                ]}>
                <SymbolView
                  name={{ ios: 'qrcode', android: 'qr_code_2', web: 'qr_code_2' }}
                  size={14}
                  tintColor={theme.primaryContainer}
                />
                <Text style={[styles.seeQrBtnText, { color: theme.text }]}>
                  Voir Attestation & QR Code Scellé
                </Text>
              </Pressable>
            </View>

            {/* Card 3: Convention de Vente Notariée */}
            <View
              style={[
                styles.docCard,
                { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
              ]}>
              <View style={styles.docCardTop}>
                <View style={[styles.docIconCircle, { backgroundColor: theme.badgeBlueBg }]}>
                  <SymbolView
                    name={{ ios: 'signature', android: 'history_edu', web: 'history_edu' }}
                    size={16}
                    tintColor={theme.badgeBlueText}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.docCardTitle, { color: theme.text }]}>
                    Convention de Vente Notariée
                  </Text>
                  <Text style={[styles.docCardSub, { color: theme.textSecondary }]}>
                    Ouidah Bande Côtière • 800 m²
                  </Text>
                </View>
                <View style={[styles.docStatusTag, { backgroundColor: theme.badgeBlueBg }]}>
                  <Text style={[styles.docStatusText, { color: theme.badgeBlueText }]}>
                    Enregistré Domaine
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => {
                  setSelectedDocTitle('Convention de Vente Notariée — Ouidah');
                  setQrModalOpen(true);
                }}
                style={[
                  styles.seeQrBtn,
                  { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder },
                ]}>
                <SymbolView
                  name={{ ios: 'qrcode', android: 'qr_code_2', web: 'qr_code_2' }}
                  size={14}
                  tintColor={theme.primaryContainer}
                />
                <Text style={[styles.seeQrBtnText, { color: theme.text }]}>
                  Voir Attestation & QR Code Scellé
                </Text>
              </Pressable>
            </View>
          </View>

          {/* CTA: Déposer un nouveau Titre Foncier */}
          <Pressable
            onPress={() => setDepositModalOpen(true)}
            style={({ pressed }) => [
              styles.depositCtaBtn,
              { backgroundColor: theme.primaryContainer },
              pressed && { opacity: 0.9 },
            ]}>
            <SymbolView
              name={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }}
              size={18}
              tintColor="#FFFFFF"
            />
            <Text style={styles.depositCtaBtnText}>
              Déposer un nouveau Titre Foncier (Indexation ANDF)
            </Text>
          </Pressable>
        </View>

        {/* 3. DEDICATED ADMIN & FINANCE SHORTCUTS */}
        {isAdminStaff && (
          <Pressable
            onPress={() => router.push('/admin' as any)}
            style={[
              styles.navCard,
              { backgroundColor: theme.navy, borderColor: theme.cardBorder },
            ]}>
            <View style={styles.navCardIconBox}>
              <SymbolView
                name={{ ios: 'shield.lefthalf.filled', android: 'policy', web: 'policy' }}
                size={20}
                tintColor="#D4AF37"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navCardTitle}>Console de Modération & Titres</Text>
              <Text style={styles.navCardSub}>
                Responsable Zone Littoral / Atlantique • Audit Foncier
              </Text>
            </View>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={16}
              tintColor="#CBD5E1"
            />
          </Pressable>
        )}

        {isSuperAdminPrincipal && (
          <Pressable
            onPress={() => router.push('/finance' as any)}
            style={[
              styles.navCard,
              { backgroundColor: theme.inverseSurface, borderColor: theme.cardBorder },
            ]}>
            <View style={styles.navCardIconBox}>
              <SymbolView
                name={{ ios: 'lock.fill', android: 'enhanced_encryption', web: 'enhanced_encryption' }}
                size={20}
                tintColor="#FFE088"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.navCardTitle, { color: '#FFE088' }]}>
                Coffre-Fort Trésorerie Niveau 0 • Root
              </Text>
              <Text style={styles.navCardSub}>
                Trésorerie temps réel, Grand Livre HMAC & retraits OTP
              </Text>
            </View>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={16}
              tintColor="#CBD5E1"
            />
          </Pressable>
        )}

        {/* 4. SETTINGS & APP APPEARANCE */}
        <View
          style={[
            styles.settingsMenuCard,
            { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
          ]}>
          <View style={styles.settingRow}>
            <Text style={styles.settingIcon}>{isDark ? '🌙' : '☀️'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: theme.text }]}>
                {isDark ? 'Mode Sombre' : 'Mode Clair'}
              </Text>
              <Text style={[styles.settingSub, { color: theme.textSecondary }]}>
                Apparence de l'application E-Mobilier
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={() => {
                void toggleTheme();
              }}
              trackColor={{ false: '#CBD5E1', true: theme.primaryContainer }}
              thumbColor="#FFFFFF"
            />
          </View>

          <Pressable
            onPress={() => router.push('/my-properties' as any)}
            style={[styles.menuItemRow, { borderTopColor: theme.cardBorder }]}>
            <SymbolView
              name={{ ios: 'building.2', android: 'apartment', web: 'apartment' }}
              size={18}
              tintColor={theme.primaryContainer}
            />
            <Text style={[styles.menuItemText, { color: theme.text }]}>Mes Annonces Publiées</Text>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={14}
              tintColor={theme.outline}
            />
          </Pressable>

          <Pressable
            onPress={() => router.push('/search-requests' as any)}
            style={[styles.menuItemRow, { borderTopColor: theme.cardBorder }]}>
            <SymbolView
              name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
              size={18}
              tintColor={theme.primaryContainer}
            />
            <Text style={[styles.menuItemText, { color: theme.text }]}>Mes Alertes & Recherches</Text>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={14}
              tintColor={theme.outline}
            />
          </Pressable>

          <Pressable
            onPress={() => router.push('/transactions' as any)}
            style={[styles.menuItemRow, { borderTopColor: theme.cardBorder }]}>
            <SymbolView
              name={{ ios: 'creditcard', android: 'receipt_long', web: 'receipt_long' }}
              size={18}
              tintColor={theme.primaryContainer}
            />
            <Text style={[styles.menuItemText, { color: theme.text }]}>Historique des Quittances</Text>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={14}
              tintColor={theme.outline}
            />
          </Pressable>

          <Pressable
            onPress={() => router.push('/cgu' as any)}
            style={[styles.menuItemRow, { borderTopColor: theme.cardBorder }]}>
            <SymbolView
              name={{ ios: 'doc.text', android: 'policy', web: 'policy' }}
              size={18}
              tintColor={theme.primaryContainer}
            />
            <Text style={[styles.menuItemText, { color: theme.text }]}>
              Conditions Générales & Charte Foncier
            </Text>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={14}
              tintColor={theme.outline}
            />
          </Pressable>
        </View>

        {/* Logout Button */}
        <Pressable
          onPress={() => {
            Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter de votre compte ?', [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Déconnexion', style: 'destructive', onPress: () => void logout() },
            ]);
          }}
          style={[styles.logoutBtn, { borderColor: theme.cardBorder, backgroundColor: theme.surfaceContainerLowest }]}>
          <SymbolView
            name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
            size={16}
            tintColor={theme.error}
          />
          <Text style={[styles.logoutBtnText, { color: theme.error }]}>Se déconnecter</Text>
        </Pressable>
      </ScrollView>

      {/* 5. MODAL: DÉPÔT MÉTADONNÉES TITRE FONCIER ANDF (STITCH EXACT) */}
      <Modal visible={depositModalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: theme.surfaceContainerLowest, paddingBottom: insets.bottom + 20 },
            ]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={[styles.depositSheetTitle, { color: theme.text }]}>
                  Dépôt & Indexation ANDF
                </Text>
                <Text style={[styles.depositSheetSub, { color: theme.textSecondary }]}>
                  Enregistrement d'un Titre Foncier au registre E-Mobilier
                </Text>
              </View>
              <Pressable
                onPress={() => setDepositModalOpen(false)}
                style={[styles.modalCloseBtn, { backgroundColor: theme.surfaceContainerLow }]}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={14}
                  tintColor={theme.text}
                />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.depositModalScroll}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Numéro du Titre Foncier :</Text>
              <TextInput
                value={newTfNum}
                onChangeText={setNewTfNum}
                placeholder="Ex: TF n° 19.452 / Littoral"
                placeholderTextColor={theme.outline}
                style={[
                  styles.textInput,
                  { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder, color: theme.text },
                ]}
              />

              <Text style={[styles.inputLabel, { color: theme.text }]}>Commune d'immatriculation :</Text>
              <TextInput
                value={newCommune}
                onChangeText={setNewCommune}
                placeholder="Cotonou / Abomey-Calavi"
                placeholderTextColor={theme.outline}
                style={[
                  styles.textInput,
                  { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder, color: theme.text },
                ]}
              />

              <View style={styles.dualFieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>Section Cadastrale :</Text>
                  <TextInput
                    value={newSection}
                    onChangeText={setNewSection}
                    placeholder="Section A"
                    placeholderTextColor={theme.outline}
                    style={[
                      styles.textInput,
                      { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder, color: theme.text },
                    ]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>Lot / Parcelle :</Text>
                  <TextInput
                    value={newLot}
                    onChangeText={setNewLot}
                    placeholder="Lot 18 • Parcelle 4"
                    placeholderTextColor={theme.outline}
                    style={[
                      styles.textInput,
                      { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder, color: theme.text },
                    ]}
                  />
                </View>
              </View>

              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Scan officiel du Titre Foncier (PDF ou Image) :
              </Text>
              <Pressable
                onPress={handlePickDocument}
                style={[
                  styles.uploadDocBtn,
                  { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder },
                ]}>
                <SymbolView
                  name={{ ios: 'doc.badge.plus', android: 'upload_file', web: 'upload_file' }}
                  size={20}
                  tintColor={theme.primaryContainer}
                />
                <Text style={[styles.uploadDocBtnText, { color: theme.text }]}>
                  {pickedDocName || 'Charger le document numérisé'}
                </Text>
              </Pressable>
            </ScrollView>

            <Pressable
              disabled={depositing}
              onPress={handleDepositSubmit}
              style={({ pressed }) => [
                styles.submitDepositBtn,
                { backgroundColor: theme.primaryContainer },
                (pressed || depositing) && { opacity: 0.9 },
              ]}>
              {depositing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <SymbolView
                    name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }}
                    size={16}
                    tintColor="#FFFFFF"
                  />
                  <Text style={styles.submitDepositBtnText}>Soumettre pour Indexation ANDF</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 6. MODAL: ATTESTATION ANDF & REÇU QR CODE (STITCH EXACT) */}
      <Modal visible={qrModalOpen} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.qrCertificateModal,
              { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.cardBorder },
            ]}>
            <View style={[styles.certHeaderBar, { backgroundColor: theme.navy }]}>
              <View style={styles.certGovBadge}>
                <Text style={styles.certGovText}>RÉPUBLIQUE DU BÉNIN</Text>
                <Text style={styles.certAndfText}>AGENCE NATIONALE DU DOMAINE ET DU FONCIER (ANDF)</Text>
              </View>
              <Pressable onPress={() => setQrModalOpen(false)} style={styles.certCloseBtn}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={14}
                  tintColor="#FFFFFF"
                />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.certScroll}>
              <View style={styles.certGoldStampRow}>
                <View style={[styles.goldSealPill, { borderColor: theme.gold, backgroundColor: theme.goldLight }]}>
                  <Text style={[styles.goldSealPillText, { color: theme.goldDark }]}>
                    REGISTRE CADASTRAL SCELLÉ
                  </Text>
                </View>
              </View>

              <Text style={[styles.certDocTitle, { color: theme.text }]}>
                {selectedDocTitle}
              </Text>

              {/* QR Code Matrix Display */}
              <View style={styles.qrDisplayWrap}>
                <View style={[styles.qrSquareBox, { backgroundColor: '#FFFFFF', borderColor: theme.cardBorder }]}>
                  <SymbolView
                    name={{ ios: 'qrcode', android: 'qr_code_2', web: 'qr_code_2' }}
                    size={110}
                    tintColor={theme.navy}
                  />
                </View>
                <Text style={[styles.qrCheckNotice, { color: theme.textSecondary }]}>
                  ID Immuable : ANDF-BJ-2025-089412
                </Text>
              </View>

              <View
                style={[
                  styles.certMetaCard,
                  { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder },
                ]}>
                <View style={styles.certMetaRow}>
                  <Text style={[styles.certMetaLabel, { color: theme.textSecondary }]}>Propriétaire Titré :</Text>
                  <Text style={[styles.certMetaVal, { color: theme.text }]}>Mme Aïcha Bio</Text>
                </View>
                <View style={styles.certMetaRow}>
                  <Text style={[styles.certMetaLabel, { color: theme.textSecondary }]}>Immatriculation :</Text>
                  <Text style={[styles.certMetaVal, { color: theme.primaryContainer }]}>Livre Foncier Littoral</Text>
                </View>
                <View style={styles.certMetaRow}>
                  <Text style={[styles.certMetaLabel, { color: theme.textSecondary }]}>Statut Notarial :</Text>
                  <Text style={[styles.certMetaVal, { color: theme.badgeGreenText }]}>Purifié & Sans Hypothèque</Text>
                </View>
              </View>
            </ScrollView>

            <Pressable
              onPress={() => setQrModalOpen(false)}
              style={[styles.closeCertBtn, { backgroundColor: theme.primaryContainer }]}>
              <Text style={styles.closeCertBtnText}>Fermer l'Attestation</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  guestContent: {
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  guestAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  guestSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  guestBtns: {
    width: '100%',
    gap: 10,
    marginTop: 12,
  },
  primaryBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  identityCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 12,
  },
  identityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileAvatarImg: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
  },
  identityInfoCol: {
    flex: 1,
    gap: 2,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  beninFlag: {
    fontSize: 14,
  },
  identityName: {
    fontSize: 16,
    fontWeight: '800',
  },
  activePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  locationMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationMetaText: {
    fontSize: 11,
  },
  kycRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  kycText: {
    fontSize: 11,
    fontWeight: '700',
  },
  legalIdentifiersBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  idLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  idLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  idVal: {
    fontSize: 12,
    fontWeight: '700',
  },
  rbacSection: {
    gap: 6,
  },
  rbacHeading: {
    fontSize: 11,
    fontWeight: '700',
  },
  rbacTabsBar: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
  },
  rbacTabBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rbacTabBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  vaultSection: {
    gap: 10,
  },
  vaultHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vaultTitleCol: {
    gap: 2,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vaultHeadingH1: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  vaultSub: {
    fontSize: 11,
  },
  docCardsList: {
    gap: 8,
  },
  docCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  docCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  docIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docCardTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  docCardSub: {
    fontSize: 11,
    marginTop: 1,
  },
  docStatusTag: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  docStatusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  seeQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  seeQrBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  depositCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  depositCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.three,
    borderRadius: 16,
    borderWidth: 1,
  },
  navCardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCardTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  navCardSub: {
    color: '#CBD5E1',
    fontSize: 11,
    marginTop: 2,
  },
  settingsMenuCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.three,
  },
  settingIcon: {
    fontSize: 20,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  settingSub: {
    fontSize: 11,
    marginTop: 1,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  logoutBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.three,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 22,
    padding: Spacing.four,
    gap: 12,
    maxHeight: '85%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  depositSheetTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  depositSheetSub: {
    fontSize: 11,
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositModalScroll: {
    maxHeight: 340,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  textInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 13,
  },
  dualFieldRow: {
    flexDirection: 'row',
    gap: 10,
  },
  uploadDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  uploadDocBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  submitDepositBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 8,
  },
  submitDepositBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  qrCertificateModal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
  },
  certHeaderBar: {
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  certGovBadge: {
    gap: 2,
  },
  certGovText: {
    color: '#D4AF37',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  certAndfText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  certCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  certScroll: {
    padding: Spacing.three,
  },
  certGoldStampRow: {
    alignItems: 'center',
    marginVertical: 4,
  },
  goldSealPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  goldSealPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  certDocTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginVertical: 6,
  },
  qrDisplayWrap: {
    alignItems: 'center',
    gap: 6,
    marginVertical: 10,
  },
  qrSquareBox: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  qrCheckNotice: {
    fontSize: 11,
    fontWeight: '600',
  },
  certMetaCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 6,
    marginTop: 6,
  },
  certMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  certMetaLabel: {
    fontSize: 11,
  },
  certMetaVal: {
    fontSize: 11,
    fontWeight: '700',
  },
  closeCertBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    margin: Spacing.three,
    borderRadius: 10,
  },
  closeCertBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
