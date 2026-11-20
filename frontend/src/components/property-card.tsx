import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PropertyItem } from '@/types/property';

interface PropertyCardProps {
  property: PropertyItem;
  onPressDetails: (property: PropertyItem) => void;
  onPressCard?: (property: PropertyItem) => void;
  onToggleFavorite?: (id: string) => void;
  onUnlockPress?: (property: PropertyItem) => void;
  onVisitPress?: (property: PropertyItem) => void;
}

export function PropertyCard({
  property,
  onPressDetails,
  onPressCard,
  onToggleFavorite,
  onUnlockPress,
  onVisitPress,
}: PropertyCardProps) {
  const theme = useTheme();
  const isLocation = property.transactionType === 'location';

  const handleCardPress = () => {
    (onPressCard ?? onPressDetails)(property);
  };

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.cardBorder,
        },
      ]}>
      {/* Property Visual Header */}
      <Pressable onPress={handleCardPress} style={styles.imageContainer}>
        <Image
          source={property.image}
          style={styles.image}
          contentFit="cover"
          transition={250}
        />

        {/* Top Badges Stack */}
        <View style={styles.topBadgesCol}>
          <View
            style={[
              styles.operationBadge,
              {
                backgroundColor: isLocation ? theme.navy : theme.primary,
              },
            ]}>
            <Text style={styles.operationBadgeText}>
              {isLocation ? 'À LOUER' : 'À VENDRE — EXCLUSIVITÉ'}
            </Text>
          </View>

          <View
            style={[
              styles.guaranteeBadge,
              {
                backgroundColor: 'rgba(255, 255, 255, 0.92)',
              },
            ]}>
            <SymbolView
              name={{ ios: 'checkmark.seal.fill', android: 'gavel', web: 'gavel' }}
              size={12}
              tintColor={theme.primaryContainer}
            />
            <Text style={[styles.guaranteeBadgeText, { color: theme.primaryContainer }]}>
              {property.status === 'validated' || property.status === 'published'
                ? 'Titre Foncier Purifié'
                : 'Certifié ANDF'}
            </Text>
          </View>
        </View>

        {/* Favorite Button */}
        <Pressable
          style={({ pressed }) => [
            styles.favoriteButton,
            pressed && { opacity: 0.8, transform: [{ scale: 0.92 }] },
          ]}
          onPress={() => onToggleFavorite?.(property.id)}>
          <SymbolView
            name={{
              ios: property.isFavorite ? 'heart.fill' : 'heart',
              android: property.isFavorite ? 'favorite' : 'favorite_border',
              web: property.isFavorite ? 'favorite' : 'favorite_border',
            }}
            size={18}
            tintColor={property.isFavorite ? '#EF4444' : '#FFFFFF'}
          />
        </Pressable>

        {/* Floating Price Pill */}
        <View style={styles.priceOverlay}>
          <Text style={styles.priceOverlayText}>{property.priceFormatted}</Text>
          {isLocation && <Text style={styles.priceSuffix}>/ mois</Text>}
        </View>
      </Pressable>

      {/* Card Content */}
      <View style={styles.contentContainer}>
        <Pressable onPress={handleCardPress}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
            {property.title}
          </Text>

          {/* Location with Pin */}
          <View style={styles.locationRow}>
            <SymbolView
              name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }}
              size={14}
              tintColor={theme.primaryContainer}
            />
            <Text numberOfLines={1} style={[styles.locationText, { color: theme.textSecondary }]}>
              {property.city || property.address || 'Abomey-Calavi, Bénin'}
            </Text>
          </View>
        </Pressable>

        {/* Specs Chips Row */}
        <View style={styles.specsRow}>
          {property.surfaceArea ? (
            <View style={[styles.specChip, { backgroundColor: theme.surfaceContainerLow }]}>
              <SymbolView
                name={{ ios: 'square.dashed', android: 'square_foot', web: 'square_foot' }}
                size={12}
                tintColor={theme.textSecondary}
              />
              <Text style={[styles.specText, { color: theme.text }]}>
                {property.surfaceArea} m²
              </Text>
            </View>
          ) : null}

          {property.bedrooms ? (
            <View style={[styles.specChip, { backgroundColor: theme.surfaceContainerLow }]}>
              <SymbolView
                name={{ ios: 'bed.double.fill', android: 'bed', web: 'bed' }}
                size={12}
                tintColor={theme.textSecondary}
              />
              <Text style={[styles.specText, { color: theme.text }]}>
                {property.bedrooms} ch.
              </Text>
            </View>
          ) : null}

          <View style={[styles.specChip, { backgroundColor: theme.badgeGreenBg }]}>
            <SymbolView
              name={{ ios: 'checkmark.circle.fill', android: 'verified', web: 'verified' }}
              size={12}
              tintColor={theme.badgeGreenText}
            />
            <Text style={[styles.specText, { color: theme.badgeGreenText }]}>
              TF ANDF Vérifié
            </Text>
          </View>
        </View>

        {/* Action Buttons: Démasquer TTL & Planifier Visite */}
        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.ttlButton,
              {
                backgroundColor: property.isUnlocked
                  ? theme.badgeGreenBg
                  : theme.surfaceContainerLow,
                borderColor: theme.cardBorder,
              },
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => (onUnlockPress ? onUnlockPress(property) : handleCardPress())}>
            <SymbolView
              name={{
                ios: property.isUnlocked ? 'lock.open.fill' : 'key.fill',
                android: property.isUnlocked ? 'lock_open' : 'key',
                web: property.isUnlocked ? 'lock_open' : 'key',
              }}
              size={14}
              tintColor={property.isUnlocked ? theme.badgeGreenText : theme.primaryContainer}
            />
            <Text
              style={[
                styles.ttlButtonText,
                {
                  color: property.isUnlocked ? theme.badgeGreenText : theme.text,
                },
              ]}>
              {property.isUnlocked ? 'Démasqué' : 'Démasquer (TTL)'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.visitButton,
              {
                backgroundColor: theme.primaryContainer,
              },
              pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => (onVisitPress ? onVisitPress(property) : handleCardPress())}>
            <SymbolView
              name={{ ios: 'calendar.badge.clock', android: 'calendar_month', web: 'calendar_month' }}
              size={14}
              tintColor="#FFFFFF"
            />
            <Text style={styles.visitButtonText}>Visite (500 F)</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.four,
    ...Platform.select({
      ios: {
        shadowColor: '#0B1C30',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 4px 16px rgba(11, 28, 48, 0.08)',
      },
    }),
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 10,
    backgroundColor: '#E2E8F0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  topBadgesCol: {
    position: 'absolute',
    top: 12,
    left: 12,
    gap: 6,
    alignItems: 'flex-start',
  },
  operationBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  operationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  guaranteeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  guaranteeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  priceOverlayText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  priceSuffix: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  contentContainer: {
    padding: Spacing.three,
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '500',
  },
  specsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  specText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  ttlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  ttlButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  visitButton: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  visitButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
