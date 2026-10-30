import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useState } from 'react';
import {
  Alert,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { BENIN_COMMUNES } from '@/data/mock-properties';
import { useTheme } from '@/hooks/use-theme';

export default function PublishScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, openLogin } = useAuth();

  // Form State
  const [propertyType, setPropertyType] = useState<'maison' | 'parcelle' | 'chambre'>('maison');
  const [transactionType, setTransactionType] = useState<'vente' | 'location'>('vente');
  const [commune, setCommune] = useState('Cotonou');
  const [arrondissement, setArrondissement] = useState('');
  const [quartier, setQuartier] = useState('');
  const [locationDetails, setLocationDetails] = useState('');
  const [surface, setSurface] = useState('');
  const [nombresChambres, setNombresChambres] = useState('3');
  const [avanceMois, setAvanceMois] = useState('3');
  const [prix, setPrix] = useState('');
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [hasTitreFoncier, setHasTitreFoncier] = useState(true);
  const [accessibilite, setAccessibilite] = useState('Pavé');
  const [eauCourant, setEauCourant] = useState('SBEE & SONEB');
  const [description, setDescription] = useState('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Access check
  const isAgent = isAuthenticated && user?.role === 'agent_immobilier';

  const handleSubmit = () => {
    // Basic validation
    if (!arrondissement.trim() || !quartier.trim() || !prix.trim() || !surface.trim()) {
      if (Platform.OS === 'web') {
        alert('Veuillez remplir les champs obligatoires (Commune, Arrondissement, Quartier, Superficie, Prix)');
      } else {
        Alert.alert('Champs obligatoires', 'Veuillez remplir la commune, l\'arrondissement, le quartier, la superficie et le prix.');
      }
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setPublishSuccess(true);
    }, 1000);
  };

  const handleReset = () => {
    setArrondissement('');
    setQuartier('');
    setLocationDetails('');
    setSurface('');
    setPrix('');
    setDescription('');
    setPublishSuccess(false);
  };

  if (!isAuthenticated || !isAgent) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.restrictedContainer}>
          <View style={[styles.lockIconBox, { backgroundColor: theme.badgeGoldBg }]}>
            <SymbolView
              name={{ ios: 'lock.shield.fill', android: 'lock', web: 'lock' }}
              size={48}
              tintColor={theme.gold}
            />
          </View>
          <Text style={[styles.restrictedTitle, { color: theme.text }]}>
            Espace Agent Immobilier
          </Text>
          <Text style={[styles.restrictedSubtitle, { color: theme.textSecondary }]}>
            La publication d'annonces immobilières est exclusivement réservée aux agents agréés et vérifiés par E-Mobilier Bénin.
          </Text>

          {!isAuthenticated ? (
            <Pressable
              onPress={openLogin}
              style={[styles.primaryActionBtn, { backgroundColor: theme.primary }]}>
              <Text style={styles.primaryActionText}>Se connecter en tant qu'Agent</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push('/profile' as any)}
              style={[styles.primaryActionBtn, { backgroundColor: theme.primary }]}>
              <Text style={styles.primaryActionText}>Consulter mon profil</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: BottomTabInset + Spacing.six + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerBadgeRow}>
              <Text style={[styles.pageTitle, { color: theme.text }]}>Publier un Bien</Text>
              <View style={styles.flagBadge}>
                <Text style={styles.flagText}>🏢 AGENT CERTIFIÉ</Text>
              </View>
            </View>
            <Text style={[styles.pageSubtitle, { color: theme.textSecondary }]}>
              Créez une nouvelle annonce immobilière selon les standards de l'ANDF et du marché béninois.
            </Text>
          </View>

          {publishSuccess ? (
            <View style={[styles.successBox, { backgroundColor: theme.badgeGreenBg, borderColor: theme.badgeGreenText }]}>
              <SymbolView
                name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                size={44}
                tintColor={theme.badgeGreenText}
              />
              <Text style={[styles.successTitle, { color: theme.badgeGreenText }]}>
                Annonce publiée avec succès !
              </Text>
              <Text style={[styles.successText, { color: theme.textSecondary }]}>
                Votre bien immobilier à {quartier} ({commune}) a été soumis et sera visible sur le catalogue public après validation de conformité.
              </Text>
              <View style={styles.successActions}>
                <Pressable
                  onPress={handleReset}
                  style={[styles.successBtn, { backgroundColor: theme.primary }]}>
                  <Text style={styles.successBtnText}>Publier un autre bien</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/' as any)}
                  style={[styles.successSecondaryBtn, { borderColor: theme.cardBorder }]}>
                  <Text style={[styles.successSecondaryText, { color: theme.text }]}>Voir le catalogue</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.formContainer}>
              {/* 1. TYPE DE BIEN & TRANSACTION */}
              <View style={[styles.formCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>1. Nature du bien & Transaction</Text>

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Type de propriété :</Text>
                <View style={styles.chipsRow}>
                  {(
                    [
                      { key: 'maison', label: '🏡 Maison / Villa' },
                      { key: 'parcelle', label: '📐 Parcelle / Terrain' },
                      { key: 'chambre', label: '🛏️ Chambre / Appartement' },
                    ] as const
                  ).map((item) => {
                    const isSelected = propertyType === item.key;
                    return (
                      <Pressable
                        key={item.key}
                        onPress={() => setPropertyType(item.key)}
                        style={[
                          styles.chipOption,
                          {
                            backgroundColor: isSelected ? theme.primary : theme.backgroundElement,
                            borderColor: isSelected ? theme.primary : 'transparent',
                          },
                        ]}>
                        <Text
                          style={[
                            styles.chipOptionText,
                            { color: isSelected ? '#FFFFFF' : theme.text, fontWeight: isSelected ? '700' : '500' },
                          ]}>
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: Spacing.three }]}>
                  Type d'opération :
                </Text>
                <View style={styles.chipsRow}>
                  {(
                    [
                      { key: 'vente', label: '🏷️ Vente définitive' },
                      { key: 'location', label: '🔑 Location' },
                    ] as const
                  ).map((item) => {
                    const isSelected = transactionType === item.key;
                    return (
                      <Pressable
                        key={item.key}
                        onPress={() => setTransactionType(item.key)}
                        style={[
                          styles.chipOption,
                          {
                            backgroundColor: isSelected ? theme.gold : theme.backgroundElement,
                            borderColor: isSelected ? theme.gold : 'transparent',
                          },
                        ]}>
                        <Text
                          style={[
                            styles.chipOptionText,
                            { color: isSelected ? '#FFFFFF' : theme.text, fontWeight: isSelected ? '700' : '500' },
                          ]}>
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 2. LOCALISATION BÉNINOISE */}
              <View style={[styles.formCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>2. Localisation au Bénin</Text>

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Commune * :</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.communesScroll}>
                  {BENIN_COMMUNES.filter((c) => c !== 'Toutes les communes').map((c) => {
                    const isSelected = commune === c;
                    return (
                      <Pressable
                        key={c}
                        onPress={() => setCommune(c)}
                        style={[
                          styles.communePill,
                          {
                            backgroundColor: isSelected ? theme.navyLight : theme.backgroundElement,
                            borderColor: isSelected ? theme.gold : theme.cardBorder,
                          },
                        ]}>
                        <Text
                          style={[
                            styles.communePillText,
                            { color: isSelected ? '#FFFFFF' : theme.text, fontWeight: isSelected ? '700' : '500' },
                          ]}>
                          {c}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <View style={styles.gridRow}>
                  <View style={styles.gridCol}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Arrondissement * :</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
                      placeholder="ex: 12ème Arr., Godomey..."
                      placeholderTextColor={theme.textSecondary}
                      value={arrondissement}
                      onChangeText={setArrondissement}
                    />
                  </View>
                  <View style={styles.gridCol}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Quartier * :</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
                      placeholder="ex: Fidjrossè, Haie Vive..."
                      placeholderTextColor={theme.textSecondary}
                      value={quartier}
                      onChangeText={setQuartier}
                    />
                  </View>
                </View>

                <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: Spacing.two }]}>
                  Précisions / Repères d'accès :
                </Text>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
                  placeholder="ex: Proche pharmacie de l'aéroport, 2ème rue pavée..."
                  placeholderTextColor={theme.textSecondary}
                  value={locationDetails}
                  onChangeText={setLocationDetails}
                />
              </View>

              {/* 3. CARACTÉRISTIQUES DU BIEN */}
              <View style={[styles.formCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>3. Caractéristiques & Commodités</Text>

                <View style={styles.gridRow}>
                  <View style={styles.gridCol}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Superficie (m²) * :</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
                      placeholder="ex: 500"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                      value={surface}
                      onChangeText={setSurface}
                    />
                  </View>
                  {propertyType !== 'parcelle' && (
                    <View style={styles.gridCol}>
                      <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Chambres :</Text>
                      <TextInput
                        style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
                        placeholder="ex: 3"
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="numeric"
                        value={nombresChambres}
                        onChangeText={setNombresChambres}
                      />
                    </View>
                  )}
                </View>

                <View style={styles.gridRow}>
                  <View style={styles.gridCol}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Accessibilité :</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
                      placeholder="Goudronné, Pavé, Piste..."
                      placeholderTextColor={theme.textSecondary}
                      value={accessibilite}
                      onChangeText={setAccessibilite}
                    />
                  </View>
                  <View style={styles.gridCol}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Eau / Énergie :</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
                      placeholder="SBEE, Forage, Décompteur..."
                      placeholderTextColor={theme.textSecondary}
                      value={eauCourant}
                      onChangeText={setEauCourant}
                    />
                  </View>
                </View>

                {/* Switch Titre Foncier */}
                <View style={[styles.toggleRow, { borderTopColor: theme.cardBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toggleTitle, { color: theme.text }]}>Titre Foncier (TF) Disponible</Text>
                    <Text style={[styles.toggleSubtitle, { color: theme.textSecondary }]}>
                      Certifié auprès de l'Agence Nationale du Domaine et du Foncier (ANDF)
                    </Text>
                  </View>
                  <Switch
                    value={hasTitreFoncier}
                    onValueChange={setHasTitreFoncier}
                    trackColor={{ false: theme.cardBorder, true: theme.primary }}
                    thumbColor={hasTitreFoncier ? '#FFFFFF' : '#f4f3f4'}
                  />
                </View>
              </View>

              {/* 4. TARIFICATION EN FCFA */}
              <View style={[styles.formCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>4. Prix & Conditions (FCFA)</Text>

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  {transactionType === 'vente' ? 'Prix de Vente (F CFA) * :' : 'Loyer Mensuel (F CFA) * :'}
                </Text>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
                  placeholder={transactionType === 'vente' ? 'ex: 25000000' : 'ex: 150000'}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  value={prix}
                  onChangeText={setPrix}
                />

                {transactionType === 'location' && (
                  <View style={{ marginTop: Spacing.two }}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Avance exigée (en mois) :</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement }]}
                      placeholder="ex: 3"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                      value={avanceMois}
                      onChangeText={setAvanceMois}
                    />
                  </View>
                )}

                {/* Switch Négociable */}
                <View style={[styles.toggleRow, { borderTopColor: theme.cardBorder, marginTop: Spacing.two }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toggleTitle, { color: theme.text }]}>Prix Négociable</Text>
                    <Text style={[styles.toggleSubtitle, { color: theme.textSecondary }]}>
                      Indique aux acheteurs/locataires que le tarif est discutable
                    </Text>
                  </View>
                  <Switch
                    value={isNegotiable}
                    onValueChange={setIsNegotiable}
                    trackColor={{ false: theme.cardBorder, true: theme.gold }}
                    thumbColor={isNegotiable ? '#FFFFFF' : '#f4f3f4'}
                  />
                </View>
              </View>

              {/* 5. DESCRIPTION */}
              <View style={[styles.formCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>5. Description du bien</Text>
                <TextInput
                  style={[
                    styles.textArea,
                    {
                      color: theme.text,
                      borderColor: theme.cardBorder,
                      backgroundColor: theme.backgroundElement,
                    },
                  ]}
                  placeholder="Décrivez les atouts de votre propriété (sécurité, environnement, finitions haut de gamme, voisinage...)"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  numberOfLines={4}
                  value={description}
                  onChangeText={setDescription}
                />
              </View>

              {/* SUBMIT BUTTON */}
              <Pressable
                onPress={handleSubmit}
                disabled={isSubmitting}
                style={[
                  styles.submitBtn,
                  { backgroundColor: theme.primary },
                  isSubmitting && { opacity: 0.6 },
                ]}>
                <Text style={styles.submitBtnText}>
                  {isSubmitting ? 'Publication en cours...' : 'Publier le bien sur E-Mobilier 🇧🇯'}
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  header: {
    marginBottom: Spacing.four,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  flagBadge: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  flagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  pageSubtitle: {
    fontSize: 13,
    lineHeight: 19,
  },

  /* RESTRICTED ACCESS */
  restrictedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },
  lockIconBox: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.four,
  },
  restrictedTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  restrictedSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.five,
  },
  primaryActionBtn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  /* FORM CARDS */
  formContainer: {
    gap: Spacing.four,
  },
  formCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.three,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 14,
  },
  textArea: {
    minHeight: 90,
    borderRadius: 10,
    borderWidth: 1,
    padding: Spacing.three,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipOptionText: {
    fontSize: 13,
  },
  communesScroll: {
    gap: 8,
    marginBottom: Spacing.three,
  },
  communePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  communePillText: {
    fontSize: 13,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Spacing.two,
  },
  gridCol: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
    marginTop: Spacing.three,
    borderTopWidth: 1,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  toggleSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },

  /* SUBMIT BUTTON */
  submitBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  /* SUCCESS STATE */
  successBox: {
    padding: Spacing.five,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginVertical: Spacing.four,
  },
  successTitle: {
    fontSize: 19,
    fontWeight: '800',
    marginTop: Spacing.three,
    marginBottom: 8,
    textAlign: 'center',
  },
  successText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: Spacing.five,
  },
  successActions: {
    width: '100%',
    gap: 10,
  },
  successBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  successSecondaryBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
