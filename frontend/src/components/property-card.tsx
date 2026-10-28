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
  onToggleFavorite?: (id: string) => void;
}

export function PropertyCard({
  property,
  onPressDetails,
  onToggleFavorite,
}: PropertyCardProps) {
  const theme = useTheme();

  const isLocation = property.transactionType === 'location';

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.cardBorder,
        },
      ]}>
      {/* Property Image Container */}
      <View style={styles.imageContainer}>
        <Image
          source={property.image}
          style={styles.image}
          contentFit="cover"
          transition={250}
        />

        {/* Transaction Badge */}
        <View
          style={[
            styles.badge,
            {
              backgroundColor: isLocation ? theme.badgeBlueBg : theme.badgeGreenBg,
            },
          ]}>
          <Text
            style={[
              styles.badgeText,
              {
                color: isLocation ? theme.badgeBlueText : theme.badgeGreenText,
              },
            ]}>
            {isLocation ? 'À LOUER' : 'À VENDRE'}
          </Text>
        </View>

        {/* Favorite Button */}
        <Pressable
          style={({ pressed }) => [
            styles.favoriteButton,
            pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
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
      </View>

      {/* Card Content */}
      <View style={styles.contentContainer}>
        {/* Title */}
        <Text
          numberOfLines={2}
          style={[styles.title, { color: theme.text }]}>
          {property.title}
        </Text>

        {/* Price */}
        <View style={styles.priceRow}>
          <Text style={[styles.priceText, { color: theme.primary }]}>
            {property.priceFormatted}
          </Text>
        </View>

        {/* Tags / Details Badges */}
        <View style={styles.tagsContainer}>
          {property.tags.map((tag, index) => (
            <View
              key={`${property.id}-tag-${index}`}
              style={[
                styles.tagChip,
                {
                  backgroundColor: theme.tagBackground,
                },
              ]}>
              <Text style={[styles.tagText, { color: theme.tagText }]}>
                {tag}
              </Text>
            </View>
          ))}
        </View>

        {/* Unlock / View Details Action Button */}
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            {
              backgroundColor: property.isUnlocked
                ? theme.badgeGreenBg
                : theme.primary,
            },
            pressed && styles.actionButtonPressed,
          ]}
          onPress={() => onPressDetails(property)}>
          <View style={styles.buttonContent}>
            <SymbolView
              name={{
                ios: property.isUnlocked ? 'checkmark.circle.fill' : 'lock.open.fill',
                android: property.isUnlocked ? 'check_circle' : 'lock_open',
                web: property.isUnlocked ? 'check_circle' : 'lock_open',
              }}
              size={17}
              tintColor={property.isUnlocked ? theme.badgeGreenText : '#FFFFFF'}
            />
            <Text
              style={[
                styles.actionButtonText,
                {
                  color: property.isUnlocked ? theme.badgeGreenText : '#FFFFFF',
                },
              ]}>
              {property.isUnlocked ? 'Détails débloqués' : property.unlockButtonText}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.four,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
      },
    }),
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
    backgroundColor: '#E2E8F0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
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
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    padding: Spacing.three,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 2,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionButton: {
    marginTop: 8,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
