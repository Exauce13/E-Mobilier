import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { MOCK_PROPERTIES } from '@/data/mock-properties';
import { useTheme } from '@/hooks/use-theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LandingShowcaseProps {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
}

export function LandingShowcase({ onOpenLogin, onOpenRegister }: LandingShowcaseProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<any>(null);

  // Formulaire de contact public
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSuccess, setContactSuccess] = useState(false);

  const handleSendContact = () => {
    if (!contactName.trim() || !contactPhone.trim() || !contactMessage.trim()) {
      return;
    }
    setContactSuccess(true);
    setTimeout(() => {
      setContactName('');
      setContactPhone('');
      setContactMessage('');
      setContactSuccess(false);
    }, 4000);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header Navigation */}
      <View
        style={[
          styles.topHeader,
          {
            paddingTop: Math.max(insets.top, 16),
            backgroundColor: theme.navy,
            borderBottomColor: 'rgba(255, 255, 255, 0.08)',
          },
        ]}>
        <View style={styles.brandRow}>
          <View style={styles.logoIcon}>
            <SymbolView
              name={{ ios: 'building.2.crop.circle.fill', android: 'apartment', web: 'apartment' }}
              size={26}
              tintColor="#D4AF37"
            />
          </View>
          <View>
            <View style={styles.brandTitleRow}>
              <Text style={styles.brandTitle}>E-Mobilier</Text>
              <View style={styles.flagBadge}>
                <Text style={styles.flagText}>🇧🇯 BÉNIN</Text>
              </View>
            </View>
            <Text style={styles.brandSubtitle}>L'Immobilier de Confiance</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            onPress={onOpenLogin}
            style={({ pressed }) => [styles.loginHeaderBtn, pressed && { opacity: 0.75 }]}
            hitSlop={8}>
            <Text style={styles.loginHeaderText}>Connexion</Text>
          </Pressable>

          <Pressable
            onPress={onOpenRegister}
            style={({ pressed }) => [styles.registerHeaderBtn, pressed && { opacity: 0.85 }]}
            hitSlop={8}>
            <Text style={styles.registerHeaderText}>S'inscrire</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}>
        {/* HERO SECTION IMMERSIVE */}
        <View style={styles.heroContainer}>
          <Image
            source={require('@/assets/images/hero_luxury_villa.jpg')}
            style={styles.heroImage}
            contentFit="cover"
            priority="high"
          />
          {/* Subtle gradient dark overlay for maximum contrast and prestige */}
          <View style={styles.heroOverlay}>
            <View style={styles.heroTag}>
              <Text style={styles.heroTagText}>✦ PORTAIL IMMOBILIER HAUT DE GAMME AU BÉNIN</Text>
            </View>

            <Text style={styles.heroMainTitle}>
              L'immobilier d'exception et sécurisé à portée de main
            </Text>

            <Text style={styles.heroDescription}>
              Villas contemporaines, appartements meublés et parcelles titrées à Cotonou, Calavi et
              dans tout le pays, vérifiés par nos experts agréés.
            </Text>

            {/* Quick Hero Call To Actions */}
            <View style={styles.heroCtaRow}>
              <Pressable
                onPress={onOpenRegister}
                style={({ pressed }) => [styles.heroPrimaryBtn, pressed && { opacity: 0.9 }]}>
                <Text style={styles.heroPrimaryBtnText}>Créer un compte</Text>
                <SymbolView
                  name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
                  size={16}
                  tintColor="#0F172A"
                />
              </Pressable>

              <Pressable
                onPress={onOpenLogin}
                style={({ pressed }) => [styles.heroSecondaryBtn, pressed && { opacity: 0.85 }]}>
                <Text style={styles.heroSecondaryBtnText}>Se connecter</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* TRUST BANNER - 3 KEY PILLARS */}
        <View style={[styles.trustBanner, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.trustItem}>
            <View style={[styles.trustIconCircle, { backgroundColor: '#FEF3C7' }]}>
              <SymbolView
                name={{ ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' }}
                size={20}
                tintColor="#B45309"
              />
            </View>
            <View style={styles.trustTextCol}>
              <Text style={[styles.trustTitle, { color: theme.text }]}>100% Titrés & Vérifiés</Text>
              <Text style={[styles.trustSubtitle, { color: theme.textSecondary }]}>Documents conformes ANDF</Text>
            </View>
          </View>

          <View style={[styles.trustDivider, { backgroundColor: theme.cardBorder }]} />

          <View style={styles.trustItem}>
            <View style={[styles.trustIconCircle, { backgroundColor: '#ECFDF5' }]}>
              <SymbolView
                name={{ ios: 'creditcard.fill', android: 'payments', web: 'payments' }}
                size={20}
                tintColor="#047857"
              />
            </View>
            <View style={styles.trustTextCol}>
              <Text style={[styles.trustTitle, { color: theme.text }]}>Mobile Money</Text>
              <Text style={[styles.trustSubtitle, { color: theme.textSecondary }]}>MTN & Moov Bénin</Text>
            </View>
          </View>

          <View style={[styles.trustDivider, { backgroundColor: theme.cardBorder }]} />

          <View style={styles.trustItem}>
            <View style={[styles.trustIconCircle, { backgroundColor: '#EFF6FF' }]}>
              <SymbolView
                name={{ ios: 'person.badge.shield.checkmark.fill', android: 'badge', web: 'badge' }}
                size={20}
                tintColor="#1D4ED8"
              />
            </View>
            <View style={styles.trustTextCol}>
              <Text style={[styles.trustTitle, { color: theme.text }]}>Agents Agréés</Text>
              <Text style={[styles.trustSubtitle, { color: theme.textSecondary }]}>Visites réelles garanties</Text>
            </View>
          </View>
        </View>

        {/* FEATURED PROPERTIES PREVIEW SECTION */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionBadge}>✦ EXCLUSIVITÉS</Text>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Propriétés en Vedette</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Aperçu sélectionné de notre catalogue immobilier au Bénin
              </Text>
            </View>
            <Pressable
              onPress={onOpenLogin}
              style={({ pressed }) => [styles.seeAllBtn, pressed && { opacity: 0.7 }]}>
              <Text style={styles.seeAllText}>Tout voir</Text>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={14}
                tintColor="#0F766E"
              />
            </Pressable>
          </View>

          {/* Property Cards Preview Grid */}
          <View style={styles.propertiesGrid}>
            {MOCK_PROPERTIES.slice(0, 4).map((property) => (
              <Pressable
                key={property.id}
                onPress={onOpenLogin}
                style={({ pressed }) => [
                  styles.propertyCard,
                  { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  pressed && { opacity: 0.95, transform: [{ scale: 0.99 }] },
                ]}>
                <View style={styles.cardImageWrapper}>
                  <Image source={property.image} style={styles.cardImage} contentFit="cover" />
                  <View
                    style={[
                      styles.cardBadge,
                      {
                        backgroundColor:
                          property.transactionType === 'vente' ? '#B45309' : '#0F766E',
                      },
                    ]}>
                    <Text style={styles.cardBadgeText}>
                      {property.transactionType === 'vente' ? 'À VENDRE' : 'À LOUER'}
                    </Text>
                  </View>

                  <View style={styles.lockBadge}>
                    <SymbolView
                      name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                      size={12}
                      tintColor="#FFFFFF"
                    />
                    <Text style={styles.lockBadgeText}>Connexion requise</Text>
                  </View>
                </View>

                <View style={styles.cardContent}>
                  <Text numberOfLines={1} style={[styles.cardTitle, { color: theme.text }]}>
                    {property.title}
                  </Text>

                  <View style={styles.locationRow}>
                    <SymbolView
                      name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }}
                      size={14}
                      tintColor={theme.textSecondary}
                    />
                    <Text style={[styles.locationText, { color: theme.textSecondary }]}>
                      {property.location.commune} ({property.location.quartier})
                    </Text>
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.priceValue}>{property.priceFormatted}</Text>
                    <View style={styles.unlockPrompt}>
                      <Text style={styles.unlockPromptText}>Débloquer</Text>
                      <SymbolView
                        name={{ ios: 'arrow.right.circle.fill', android: 'arrow_forward', web: 'arrow_forward' }}
                        size={16}
                        tintColor="#0F766E"
                      />
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* SECTION À PROPOS */}
        <View style={[styles.aboutSection, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={styles.aboutBadge}>✦ NOTRE MISSION</Text>
          <Text style={[styles.aboutTitle, { color: theme.text }]}>À Propos d'E-Mobilier</Text>
          <Text style={[styles.aboutSubtitle, { color: theme.textSecondary }]}>
            E-Mobilier est la plateforme digitale de référence dédiée à l'immobilier moderne et sécurisé en République du Bénin.
          </Text>

          <View style={styles.aboutGrid}>
            <View style={[styles.aboutCard, { backgroundColor: theme.backgroundElement, borderColor: theme.cardBorder }]}>
              <View style={[styles.aboutIconBox, { backgroundColor: '#FEF3C7' }]}>
                <SymbolView
                  name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }}
                  size={24}
                  tintColor="#B45309"
                />
              </View>
              <Text style={[styles.aboutCardTitle, { color: theme.text }]}>Sécurité Foncière Garantie</Text>
              <Text style={[styles.aboutCardDesc, { color: theme.textSecondary }]}>
                Fini les litiges fonciers. Chaque parcelle et bien listé est soumis à un contrôle strict des titres et pièces d'identité cadastrales.
              </Text>
            </View>

            <View style={[styles.aboutCard, { backgroundColor: theme.backgroundElement, borderColor: theme.cardBorder }]}>
              <View style={[styles.aboutIconBox, { backgroundColor: '#ECFDF5' }]}>
                <SymbolView
                  name={{ ios: 'briefcase.fill', android: 'work', web: 'work' }}
                  size={24}
                  tintColor="#047857"
                />
              </View>
              <Text style={[styles.aboutCardTitle, { color: theme.text }]}>Professionnalisation des Agents</Text>
              <Text style={[styles.aboutCardDesc, { color: theme.textSecondary }]}>
                Les agents immobiliers enregistrés disposent d'un espace de publication dédié et reçoivent directement les demandes de visites vérifiées.
              </Text>
            </View>

            <View style={[styles.aboutCard, { backgroundColor: theme.backgroundElement, borderColor: theme.cardBorder }]}>
              <View style={[styles.aboutIconBox, { backgroundColor: '#EFF6FF' }]}>
                <SymbolView
                  name={{ ios: 'qrcode.viewfinder', android: 'qr_code', web: 'qr_code' }}
                  size={24}
                  tintColor="#1D4ED8"
                />
              </View>
              <Text style={[styles.aboutCardTitle, { color: theme.text }]}>Écosystème Mobile Money</Text>
              <Text style={[styles.aboutCardDesc, { color: theme.textSecondary }]}>
                Une tarification transparente pour débloquer les coordonnées et planifier des visites sans mauvaises surprises avec MTN et Moov Bénin.
              </Text>
            </View>
          </View>
        </View>

        {/* SECTION CONTACT & SUPPORT */}
        <View style={[styles.contactSection, { backgroundColor: theme.navy }]}>
          <Text style={styles.contactBadge}>✦ CONTACTEZ-NOUS</Text>
          <Text style={styles.contactTitle}>Besoin d'un accompagnement ?</Text>
          <Text style={styles.contactSubtitle}>
            Notre équipe et nos conseillers immobiliers à Cotonou sont à votre écoute pour vous guider.
          </Text>

          {/* Contact Details Cards */}
          <View style={styles.contactCardsRow}>
            <View style={styles.contactInfoCard}>
              <View style={styles.contactInfoIcon}>
                <SymbolView
                  name={{ ios: 'mappin.circle.fill', android: 'location_on', web: 'location_on' }}
                  size={22}
                  tintColor="#D4AF37"
                />
              </View>
              <Text style={styles.contactInfoLabel}>Notre Siège</Text>
              <Text style={styles.contactInfoValue}>Cadjehoun, Cotonou, Bénin</Text>
            </View>

            <View style={styles.contactInfoCard}>
              <View style={styles.contactInfoIcon}>
                <SymbolView
                  name={{ ios: 'phone.circle.fill', android: 'phone', web: 'phone' }}
                  size={22}
                  tintColor="#2DD4BF"
                />
              </View>
              <Text style={styles.contactInfoLabel}>Téléphone & WhatsApp</Text>
              <Text style={styles.contactInfoValue}>+229 01 97 00 11 22</Text>
            </View>

            <View style={styles.contactInfoCard}>
              <View style={styles.contactInfoIcon}>
                <SymbolView
                  name={{ ios: 'envelope.circle.fill', android: 'email', web: 'email' }}
                  size={22}
                  tintColor="#60A5FA"
                />
              </View>
              <Text style={styles.contactInfoLabel}>Email Support</Text>
              <Text style={styles.contactInfoValue}>contact@e-mobilier.bj</Text>
            </View>
          </View>

          {/* Quick Contact Form */}
          <View style={styles.contactFormCard}>
            <Text style={styles.formTitle}>Envoyez-nous un message direct</Text>

            {contactSuccess && (
              <View style={styles.successMessageBanner}>
                <SymbolView
                  name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                  size={18}
                  tintColor="#047857"
                />
                <Text style={styles.successMessageText}>
                  Merci ! Votre message a été transmis à notre équipe à Cotonou.
                </Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Votre nom complet</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: Koffi Mensah"
                placeholderTextColor="#64748B"
                value={contactName}
                onChangeText={setContactName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Numéro de téléphone (Bénin)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: 0197001122"
                placeholderTextColor="#64748B"
                keyboardType="phone-pad"
                value={contactPhone}
                onChangeText={setContactPhone}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Votre message ou demande</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea]}
                placeholder="Décrivez votre besoin (achat, location, partenariat agent)..."
                placeholderTextColor="#64748B"
                multiline
                numberOfLines={4}
                value={contactMessage}
                onChangeText={setContactMessage}
              />
            </View>

            <Pressable
              onPress={handleSendContact}
              style={({ pressed }) => [styles.submitContactBtn, pressed && { opacity: 0.85 }]}>
              <Text style={styles.submitContactBtnText}>Envoyer mon message</Text>
              <SymbolView
                name={{ ios: 'paperplane.fill', android: 'send', web: 'send' }}
                size={16}
                tintColor="#0F172A"
              />
            </Pressable>
          </View>
        </View>

        {/* FINAL CONVERSION BANNER */}
        <View style={styles.finalCtaContainer}>
          <View style={styles.finalCtaCard}>
            <Text style={styles.finalCtaBadge}>COMMENCER DÈS AUJOURD'HUI</Text>
            <Text style={styles.finalCtaTitle}>
              Prêt à concrétiser votre projet immobilier ?
            </Text>
            <Text style={styles.finalCtaDesc}>
              Créez votre compte en moins d'une minute avec votre numéro béninois (01...) et accédez à l'ensemble
              des biens disponibles.
            </Text>

            <View style={styles.finalBtnRow}>
              <Pressable
                onPress={onOpenRegister}
                style={({ pressed }) => [styles.finalPrimaryBtn, pressed && { opacity: 0.9 }]}>
                <Text style={styles.finalPrimaryBtnText}>Créer un compte gratuit</Text>
              </Pressable>

              <Pressable
                onPress={onOpenLogin}
                style={({ pressed }) => [styles.finalSecondaryBtn, pressed && { opacity: 0.8 }]}>
                <Text style={styles.finalSecondaryBtnText}>J'ai déjà un compte</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeader: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    zIndex: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  flagBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  flagText: {
    color: '#D4AF37',
    fontSize: 10,
    fontWeight: '700',
  },
  brandSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  loginHeaderBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  loginHeaderText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  registerHeaderBtn: {
    backgroundColor: '#D4AF37',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  registerHeaderText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    flexGrow: 1,
  },

  /* HERO */
  heroContainer: {
    height: 460,
    width: '100%',
    position: 'relative',
    justifyContent: 'flex-end',
  },
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11, 15, 25, 0.65)',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    justifyContent: 'flex-end',
  },
  heroTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    borderColor: 'rgba(212, 175, 55, 0.5)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: Spacing.two,
  },
  heroTagText: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  heroMainTitle: {
    color: '#FFFFFF',
    fontSize: Platform.OS === 'web' && SCREEN_WIDTH > 768 ? 38 : 28,
    fontWeight: '800',
    lineHeight: Platform.OS === 'web' && SCREEN_WIDTH > 768 ? 46 : 34,
    marginBottom: Spacing.two,
    maxWidth: 620,
  },
  heroDescription: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: Spacing.four,
    maxWidth: 540,
  },
  heroCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flexWrap: 'wrap',
  },
  heroPrimaryBtn: {
    backgroundColor: '#D4AF37',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  heroPrimaryBtnText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
  },
  heroSecondaryBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  heroSecondaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  /* TRUST BANNER */
  trustBanner: {
    marginHorizontal: Spacing.four,
    marginTop: -30,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  trustItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  trustIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustTextCol: {
    flex: 1,
  },
  trustTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  trustSubtitle: {
    fontSize: 10,
    fontWeight: '500',
  },
  trustDivider: {
    width: 1,
    height: 32,
    marginHorizontal: 4,
  },

  /* PROPERTIES GRID */
  sectionContainer: {
    marginTop: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Spacing.four,
  },
  sectionBadge: {
    color: '#0F766E',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  seeAllText: {
    color: '#0F766E',
    fontSize: 13,
    fontWeight: '700',
  },
  propertiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  propertyCard: {
    width: Platform.OS === 'web' && SCREEN_WIDTH > 768 ? '48.5%' : '100%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardImageWrapper: {
    height: 200,
    width: '100%',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cardBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  lockBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  lockBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  cardContent: {
    padding: Spacing.three,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.three,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F766E',
  },
  unlockPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  unlockPromptText: {
    color: '#0F766E',
    fontSize: 13,
    fontWeight: '700',
  },

  /* SECTION A PROPOS */
  aboutSection: {
    marginTop: 48,
    marginHorizontal: Spacing.four,
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.five,
  },
  aboutBadge: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  aboutTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  aboutSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: Spacing.four,
  },
  aboutGrid: {
    gap: Spacing.three,
  },
  aboutCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.four,
  },
  aboutIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  aboutCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  aboutCardDesc: {
    fontSize: 13,
    lineHeight: 19,
  },

  /* SECTION CONTACT */
  contactSection: {
    marginTop: 48,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
  },
  contactBadge: {
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
    textAlign: 'center',
  },
  contactTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  contactSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 520,
    alignSelf: 'center',
    lineHeight: 20,
    marginBottom: Spacing.five,
  },
  contactCardsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
    marginBottom: Spacing.five,
  },
  contactInfoCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.three,
    alignItems: 'center',
  },
  contactInfoIcon: {
    marginBottom: 6,
  },
  contactInfoLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
    textAlign: 'center',
  },
  contactInfoValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  contactFormCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.four,
  },
  formTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.three,
  },
  successMessageBanner: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.three,
  },
  successMessageText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  inputGroup: {
    marginBottom: Spacing.three,
  },
  inputLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
  },
  formTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitContactBtn: {
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.two,
  },
  submitContactBtnText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },

  /* FINAL CONVERSION */
  finalCtaContainer: {
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.six,
  },
  finalCtaCard: {
    backgroundColor: '#0F766E',
    borderRadius: 20,
    padding: Spacing.five,
    alignItems: 'center',
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  },
  finalCtaBadge: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  finalCtaTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  finalCtaDesc: {
    color: '#E6FFFA',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 480,
    marginBottom: Spacing.four,
  },
  finalBtnRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  finalPrimaryBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 12,
  },
  finalPrimaryBtnText: {
    color: '#0F766E',
    fontSize: 14,
    fontWeight: '800',
  },
  finalSecondaryBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  finalSecondaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
