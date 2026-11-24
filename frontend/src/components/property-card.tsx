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
  onPressQuickAction?: (property: PropertyItem, action: 'demande_visite' | 'contact') => void;
  compact?: boolean;
}

export function PropertyCard({
  property,
  onPressDetails,
  onPressCard,
  onToggleFavorite,
  onPressQuickAction,
  compact = false,
}: PropertyCardProps) {
  const theme = useTheme();
  const isLocation = property.transactionType === 'location';

  const typeLabel =
    property.type === 'parcelle'
      ? 'PARCELLE'
      : property.type === 'chambre'
      ? 'CHAMBRE'
      : 'MAISON';

  return (
    <View
      style={[
        styles.cardContainer,
        compact && styles.cardContainerCompact,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.cardBorder,
        },
      ]}>
      {/* Property Image */}
      <Pressable
        onPress={() => (onPressCard ?? onPressDetails)(property)}
        style={[styles.imageContainer, compact && styles.imageContainerCompact]}>
        <Image
          source={property.image}
          style={styles.image}
          contentFit="cover"
          transition={220}
        />

        {/* Top Left Badges */}
        <View style={styles.topLeftBadges}>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: isLocation ? '#0F766E' : '#B45309',
              },
            ]}>
            <Text style={styles.badgeText}>{isLocation ? 'À LOUER' : 'À VENDRE'}</Text>
          </View>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{typeLabel}</Text>
          </View>
        </View>

        {/* Favorite Button */}
        {onToggleFavorite ? (
          <Pressable
            style={({ pressed }) => [
              styles.favoriteButton,
              pressed && { opacity: 0.85, transform: [{ scale: 0.94 }] },
            ]}
            onPress={() => onToggleFavorite(property.id)}
            hitSlop={6}>
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
        ) : null}

        {/* Unlocked / Price pill overlay */}
        {property.isUnlocked ? (
          <View style={styles.unlockedPill}>
            <Text style={styles.unlockedPillText}>✓ Débloqué</Text>
          </View>
        ) : null}
      </Pressable>

      {/* Content */}
      <View style={styles.contentContainer}>
        <View style={styles.locationRow}>
          <SymbolView
            name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }}
            size={13}
            tintColor={theme.primary}
          />
          <Text numberOfLines={1} style={[styles.locationText, { color: theme.textSecondary }]}>
            {property.location.fullAddress || property.location.commune}
          </Text>
        </View>

        <Pressable onPress={() => (onPressCard ?? onPressDetails)(property)}>
          <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>
            {property.title}
          </Text>
        </Pressable>

        <View style={styles.priceRow}>
          <Text style={[styles.priceText, { color: theme.primary }]}>
            {property.priceFormatted}
          </Text>
          {property.features.isNegotiable ? (
            <View style={[styles.negBadge, { backgroundColor: theme.badgeGoldBg }]}>
              <Text style={[styles.negBadgeText, { color: theme.badgeGoldText }]}>Négociable</Text>
            </View>
          ) : null}
        </View>

        {/* Feature Tags */}
        {property.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {property.tags.slice(0, 4).map((tag, index) => (
              <View
                key={`${property.id}-tag-${index}`}
                style={[styles.tagChip, { backgroundColor: theme.tagBackground }]}>
                <Text numberOfLines={1} style={[styles.tagText, { color: theme.tagText }]}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Quick Actions Row */}
        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: property.isUnlocked ? theme.badgeGreenBg : theme.primary,
              },
              pressed && styles.actionButtonPressed,
            ]}
            onPress={() => onPressDetails(property)}>
            <SymbolView
              name={{
                ios: property.isUnlocked ? 'checkmark.circle.fill' : 'eye.fill',
                android: property.isUnlocked ? 'check_circle' : 'visibility',
                web: property.isUnlocked ? 'check_circle' : 'visibility',
              }}
              size={15}
              tintColor={property.isUnlocked ? theme.badgeGreenText : '#FFFFFF'}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.actionButtonText,
                { color: property.isUnlocked ? theme.badgeGreenText : '#FFFFFF' },
              ]}>
              {property.isUnlocked ? 'Voir la fiche' : 'Voir le bien'}
            </Text>
          </Pressable>

          {onPressQuickAction ? (
            <Pressable
              style={({ pressed }) => [
                styles.secondaryActionBtn,
                { borderColor: theme.primary, backgroundColor: theme.primaryLight },
                pressed && styles.actionButtonPressed,
              ]}
              onPress={() => onPressQuickAction(property, 'demande_visite')}>
              <Text numberOfLines={1} style={[styles.secondaryActionText, { color: theme.primaryDark }]}>
                Visiter / RDV
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    flex: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.07,
        shadowRadius: 14,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 6px 20px rgba(15, 23, 42, 0.06)',
      },
    }),
  },
  cardContainerCompact: {
    borderRadius: 18,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 205,
    backgroundColor: '#E2E8F0',
  },
  imageContainerCompact: {
    height: 185,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  topLeftBadges: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  typeBadgeText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.52)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unlockedPill: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    backgroundColor: 'rgba(4, 120, 87, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  unlockedPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  contentContainer: {
    padding: Spacing.three,
    gap: 8,
    flex: 1,
    justifyContent: 'space-between',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  priceText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  negBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  negBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryActionBtn: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
