import Constants from 'expo-constants';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
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
import { notificationsApi } from '@/services/api';
import type { NotificationInterneItem } from '@/types/api';
import { showMessage } from '@/utils/dialog';

export default function NotificationsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isMobile, horizontalPadding } = useResponsive();
  const { isAuthenticated, openAuthModal, refreshUnreadCount } = useAuth();

  const [items, setItems] = useState<NotificationInterneItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pushTokenInput, setPushTokenInput] = useState('');

  const load = useCallback(
    async (targetPage = 1, replace = true) => {
      setLoadError(null);
      if (!isAuthenticated) {
        setItems([]);
        return;
      }
      const res = await notificationsApi.list(targetPage, 25);
      if (res.success && Array.isArray(res.data)) {
        setItems((prev) => (replace ? res.data! : [...prev, ...res.data!]));
        const meta = res.meta as { current_page?: number; last_page?: number } | undefined;
        setPage(meta?.current_page ?? targetPage);
        setLastPage(meta?.last_page ?? targetPage);
      } else {
        setLoadError(res.message || 'Impossible de charger vos notifications.');
      }
      await refreshUnreadCount();
    },
    [isAuthenticated, refreshUnreadCount]
  );

  useEffect(() => {
    void load(1, true).finally(() => setLoading(false));
  }, [load]);

  const handleMarkRead = async (id: number) => {
    const res = await notificationsApi.markRead(id);
    if (res.success) await load(1, true);
  };

  const handleMarkAllRead = async () => {
    const res = await notificationsApi.markAllRead();
    if (res.success) await load(1, true);
  };

  const handleRegisterToken = async () => {
    if (!pushTokenInput.trim()) {
      showMessage('Jeton requis', 'Collez un token FCM / Expo Push valide.');
      return;
    }
    const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    const res = await notificationsApi.registerDeviceToken({
      token: pushTokenInput.trim(),
      platform,
      device_name: Constants.deviceName || Platform.OS,
    });
    if (res.success) {
      showMessage('Enregistré', res.message || 'Jeton push associé à votre compte.');
      setPushTokenInput('');
    } else {
      showMessage('Erreur', res.message || "Impossible d'enregistrer le jeton.");
    }
  };

  const handleRevokeToken = async () => {
    const res = await notificationsApi.deleteDeviceToken(pushTokenInput.trim() || undefined);
    if (res.success) {
      showMessage('Désactivé', res.message || 'Jeton(s) push révoqué(s) pour cet appareil.');
      setPushTokenInput('');
    } else {
      showMessage('Erreur', res.message || 'Impossible de révoquer le jeton.');
    }
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Notifications"
        subtitle="Alertes & suivi en temps réel"
        rightAction={
          isAuthenticated ? (
            <Pressable onPress={handleMarkAllRead} style={[styles.markAllBtn, { backgroundColor: theme.primary }]}>
              <Text style={styles.markAllText}>Tout lire</Text>
            </Pressable>
          ) : undefined
        }
      />

      {!isAuthenticated ? (
        <View style={styles.gate}>
          <Text style={[styles.gateTitle, { color: theme.text }]}>Connexion requise</Text>
          <Text style={{ color: theme.textSecondary, textAlign: 'center', fontSize: 14 }}>
            Connectez-vous pour consulter vos alertes, validations d'annonces et confirmations de visites.
          </Text>
          <Pressable
            onPress={() => openAuthModal('login')}
            style={[styles.primaryBtn, { backgroundColor: theme.primary }]}>
            <Text style={styles.primaryBtnText}>Se connecter</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={theme.primary}
            />
          }
          contentContainerStyle={[
            styles.list,
            { paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + 24 },
          ]}
          ListHeaderComponent={
            <View style={{ gap: 8 }}>
              {loadError ? (
                <View style={[styles.tokenCard, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                  <Text style={{ color: '#B91C1C', fontWeight: '700', fontSize: 13 }}>{loadError}</Text>
                </View>
              ) : null}
              <View style={[styles.tokenCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <Text style={[styles.tokenTitle, { color: theme.text }]}>Jeton Push Appareil</Text>
                <View style={[styles.tokenRow, isMobile && { flexDirection: 'column' }]}>
                  <TextInput
                    style={[
                      styles.tokenInput,
                      { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundElement },
                    ]}
                    placeholder="ExponentPushToken[...] ou FCM"
                    placeholderTextColor={theme.textSecondary}
                    value={pushTokenInput}
                    onChangeText={setPushTokenInput}
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable onPress={handleRegisterToken} style={[styles.tokenBtn, { backgroundColor: theme.navy, flex: isMobile ? 1 : undefined }]}>
                      <Text style={styles.tokenBtnText}>Activer</Text>
                    </Pressable>
                    <Pressable onPress={handleRevokeToken} style={[styles.tokenBtn, { backgroundColor: '#FEE2E2', flex: isMobile ? 1 : undefined }]}>
                      <Text style={[styles.tokenBtnText, { color: '#B91C1C' }]}>Révoquer</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => !item.lu && handleMarkRead(item.id)}
              style={[
                styles.card,
                {
                  backgroundColor: item.lu ? theme.cardBackground : theme.primaryLight,
                  borderColor: item.lu ? theme.cardBorder : theme.primary,
                },
              ]}>
              <View style={styles.cardTop}>
                <Text style={[styles.title, { color: theme.text }]}>{item.titre}</Text>
                {!item.lu && <View style={styles.unreadDot} />}
              </View>
              <Text style={[styles.msg, { color: theme.textSecondary }]}>{item.message}</Text>
              <Text style={[styles.date, { color: theme.textSecondary }]}>
                {new Date(item.created_at).toLocaleString('fr-FR')} • {item.type}
              </Text>
            </Pressable>
          )}
          ListFooterComponent={
            page < lastPage ? (
              <Pressable
                onPress={async () => {
                  setLoadingMore(true);
                  await load(page + 1, false);
                  setLoadingMore(false);
                }}
                disabled={loadingMore}
                style={[styles.primaryBtn, { backgroundColor: theme.navy, alignSelf: 'center', marginTop: 8 }]}>
                <Text style={styles.primaryBtnText}>
                  {loadingMore ? 'Chargement...' : 'Charger plus'}
                </Text>
              </Pressable>
            ) : undefined
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
            ) : (
              <View style={styles.empty}>
                <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>
                  Aucune notification reçue pour le moment.
                </Text>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  markAllBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  markAllText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  list: { paddingTop: Spacing.three, gap: Spacing.two, maxWidth: 860, width: '100%', alignSelf: 'center' },
  tokenCard: { borderRadius: 16, borderWidth: 1, padding: Spacing.three, gap: 8, marginBottom: Spacing.two },
  tokenTitle: { fontSize: 13, fontWeight: '800' },
  tokenRow: { flexDirection: 'row', gap: 8 },
  tokenInput: { flex: 1, minHeight: 42, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  tokenBtn: { paddingHorizontal: 14, minHeight: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  tokenBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  card: { borderRadius: 16, borderWidth: 1, padding: Spacing.three, gap: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '800', flex: 1 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' },
  msg: { fontSize: 13, lineHeight: 19 },
  date: { fontSize: 11, marginTop: 4 },
  empty: { alignItems: 'center', marginTop: 48 },
  gate: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, gap: 12 },
  gateTitle: { fontSize: 18, fontWeight: '800' },
  primaryBtn: { borderRadius: 12, paddingHorizontal: 22, paddingVertical: 13 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
