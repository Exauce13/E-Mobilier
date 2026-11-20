import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { notificationsApi } from '@/services/api';
import type { NotificationInterneItem } from '@/types/api';

type NotifCategory = 'all' | 'foncier' | 'transactions' | 'visites' | 'securite';

export default function NotificationsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { refreshUnreadCount, unreadNotificationsCount } = useAuth();

  const [activeCategory, setActiveCategory] = useState<NotifCategory>('all');
  const [items, setItems] = useState<NotificationInterneItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await notificationsApi.list(1, 30);
      if (res.success && Array.isArray(res.data)) {
        setItems(res.data);
      }
    } catch {
      // Fallback
    } finally {
      await refreshUnreadCount();
      setLoading(false);
    }
  }, [refreshUnreadCount]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleMarkRead = async (id: number) => {
    const res = await notificationsApi.markRead(id);
    if (res.success) await load();
  };

  const handleMarkAllRead = async () => {
    const res = await notificationsApi.markAllRead();
    if (res.success) {
      await load();
      Alert.alert('Succès', 'Toutes les notifications sont marquées comme lues.');
    }
  };

  // Mock Stitch notifications for enriched experience
  const stitchMockNotifications = [
    {
      id: 991,
      category: 'foncier',
      title: 'Indexation ANDF validée — TF n° 19.452',
      tag: '🇧🇯 Titre Foncier Certifié',
      time: 'Il y a 12 min',
      body: 'Votre Titre Foncier pour la parcelle de Haie Vive (Îlot 12) a été vérifié et scellé au cadastre national.',
      actionText: "Consulter l'attestation",
      actionIcon: 'verified',
      is_read: false,
    },
    {
      id: 992,
      category: 'transactions',
      title: 'Paiement reçu — Frais de mise en relation',
      tag: 'Paiement Kkiapay',
      time: 'Il y a 1h',
      body: '500 FCFA reçus via MTN Mobile Money pour la visite encadrée de la villa de Calavi.',
      actionText: 'Voir la quittance',
      actionIcon: 'receipt_long',
      is_read: false,
    },
    {
      id: 993,
      category: 'visites',
      title: 'Visite confirmée — Terrain Calavi Togbin',
      tag: 'Visite Terrain',
      time: 'Hier à 16:45',
      body: "Mme Aïcha Bio a confirmé la visite avec l'agent Pamphile Dossou pour samedi à 15h30.",
      actionText: 'Voir itinéraire',
      actionIcon: 'navigation',
      is_read: true,
    },
    {
      id: 994,
      category: 'securite',
      title: 'Démasquage temporaire (TTL) expiré',
      tag: 'Anti-Contournement',
      time: 'Il y a 2 jours',
      body: 'La session de consultation de 15 min pour la parcelle TF 4821 est terminée. Les coordonnées sont de nouveau masquées.',
      actionText: '',
      actionIcon: '',
      is_read: true,
    },
    {
      id: 995,
      category: 'foncier',
      title: 'Annonce approuvée et publiée au catalogue',
      tag: 'Validation Notariale',
      time: 'Il y a 3 jours',
      body: 'Votre parcelle de 500m² à Zoundja a passé la modération et est désormais visible aux acquéreurs.',
      actionText: "Voir l'annonce",
      actionIcon: 'apartment',
      is_read: true,
    },
  ];

  const categoryChips = [
    { id: 'all', label: 'Toutes (12)' },
    { id: 'foncier', label: 'Foncier & ANDF (4)' },
    { id: 'transactions', label: 'Transactions (3)' },
    { id: 'visites', label: 'Visites & TTL (3)' },
    { id: 'securite', label: 'Sécurité (2)' },
  ];

  const filteredStitchNotifs = stitchMockNotifications.filter((n) => {
    if (activeCategory === 'all') return true;
    return n.category === activeCategory;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* Header (Stitch) */}
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: Math.max(insets.top, 12),
            backgroundColor: theme.surfaceContainerLowest,
            borderBottomColor: theme.cardBorder,
          },
        ]}>
        <View style={styles.headerLeftRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={[styles.backBtn, { backgroundColor: theme.surfaceContainerLow }]}>
            <SymbolView
              name={{ ios: 'chevron.backward', android: 'arrow_back', web: 'arrow_back' }}
              size={18}
              tintColor={theme.text}
            />
          </Pressable>

          <View style={styles.titleWithBadge}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
            <View style={[styles.unreadCountPill, { backgroundColor: theme.errorContainer }]}>
              <Text style={[styles.unreadCountText, { color: theme.error }]}>3 non lues</Text>
            </View>
          </View>
        </View>

        <Pressable onPress={handleMarkAllRead} style={styles.markAllBtn}>
          <SymbolView
            name={{ ios: 'checkmark.circle', android: 'done_all', web: 'done_all' }}
            size={16}
            tintColor={theme.primaryContainer}
          />
          <Text style={[styles.markAllText, { color: theme.primaryContainer }]}>Tout lire</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={theme.primaryContainer} />
        }
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
        {/* Filter Category Chips (Stitch) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {categoryChips.map((chip) => {
            const isActive = activeCategory === chip.id;
            return (
              <Pressable
                key={chip.id}
                onPress={() => setActiveCategory(chip.id as any)}
                style={[
                  styles.chipBtn,
                  {
                    backgroundColor: isActive ? theme.primaryContainer : theme.surfaceContainerLowest,
                    borderColor: isActive ? theme.primaryContainer : theme.cardBorder,
                  },
                ]}>
                <Text
                  style={[
                    styles.chipBtnText,
                    { color: isActive ? '#FFFFFF' : theme.text },
                  ]}>
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Section: Aujourd'hui (Stitch exact) */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeadingRow}>
            <Text style={[styles.sectionHeadingText, { color: theme.textSecondary }]}>
              Aujourd'hui — 2 alertes récentes
            </Text>
          </View>

          {filteredStitchNotifs.slice(0, 2).map((item) => (
            <View
              key={item.id}
              style={[
                styles.notifCard,
                {
                  backgroundColor: !item.is_read ? theme.surfaceContainerLowest : theme.surfaceContainerLow,
                  borderColor: theme.cardBorder,
                },
              ]}>
              <View style={styles.notifCardTop}>
                <View style={[styles.tagPill, { backgroundColor: theme.surfaceContainerLow }]}>
                  <Text style={[styles.tagPillText, { color: theme.primaryContainer }]}>{item.tag}</Text>
                </View>
                <Text style={[styles.timeText, { color: theme.textSecondary }]}>{item.time}</Text>
              </View>

              <Text style={[styles.notifTitle, { color: theme.text }]}>{item.title}</Text>
              <Text style={[styles.notifBody, { color: theme.textSecondary }]}>{item.body}</Text>

              {item.actionText ? (
                <Pressable
                  onPress={() => {
                    if (item.actionText.includes('attestation')) {
                      router.push('/profile' as any);
                    } else if (item.actionText.includes('quittance')) {
                      router.push('/transactions' as any);
                    } else {
                      router.push('/visits' as any);
                    }
                  }}
                  style={[
                    styles.notifActionBtn,
                    { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder },
                  ]}>
                  <Text style={[styles.notifActionBtnText, { color: theme.primaryContainer }]}>
                    {item.actionText}
                  </Text>
                  <SymbolView
                    name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
                    size={12}
                    tintColor={theme.primaryContainer}
                  />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>

        {/* Section: Cette semaine (Stitch exact) */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeadingRow}>
            <Text style={[styles.sectionHeadingText, { color: theme.textSecondary }]}>
              Cette semaine
            </Text>
          </View>

          {filteredStitchNotifs.slice(2).map((item) => (
            <View
              key={item.id}
              style={[
                styles.notifCard,
                {
                  backgroundColor: !item.is_read ? theme.surfaceContainerLowest : theme.surfaceContainerLow,
                  borderColor: theme.cardBorder,
                },
              ]}>
              <View style={styles.notifCardTop}>
                <View style={[styles.tagPill, { backgroundColor: theme.surfaceContainerLow }]}>
                  <Text style={[styles.tagPillText, { color: theme.primaryContainer }]}>{item.tag}</Text>
                </View>
                <Text style={[styles.timeText, { color: theme.textSecondary }]}>{item.time}</Text>
              </View>

              <Text style={[styles.notifTitle, { color: theme.text }]}>{item.title}</Text>
              <Text style={[styles.notifBody, { color: theme.textSecondary }]}>{item.body}</Text>

              {item.actionText ? (
                <Pressable
                  onPress={() => router.push('/visits' as any)}
                  style={[
                    styles.notifActionBtn,
                    { backgroundColor: theme.surfaceContainerLow, borderColor: theme.cardBorder },
                  ]}>
                  <Text style={[styles.notifActionBtnText, { color: theme.primaryContainer }]}>
                    {item.actionText}
                  </Text>
                  <SymbolView
                    name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
                    size={12}
                    tintColor={theme.primaryContainer}
                  />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two + 2,
    borderBottomWidth: 1,
    zIndex: 40,
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  unreadCountPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  unreadCountText: {
    fontSize: 10,
    fontWeight: '800',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.four,
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  chipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 6,
  },
  chipBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionBlock: {
    gap: 10,
  },
  sectionHeadingRow: {
    paddingHorizontal: 2,
  },
  sectionHeadingText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notifCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 6,
  },
  notifCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  timeText: {
    fontSize: 11,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  notifBody: {
    fontSize: 12,
    lineHeight: 17,
  },
  notifActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  notifActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
