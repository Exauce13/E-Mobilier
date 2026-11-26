import { Building2, LogOut, Moon, Sun, X } from 'lucide-react-native';
import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

export interface MobileNavItem {
  key: string;
  label: string;
  subtitle?: string;
  icon: React.ReactNode;
  accent?: boolean;
  badge?: string | number;
  onPress: () => void;
}

interface MobileNavDrawerProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  items: MobileNavItem[];
  isDark?: boolean;
  onToggleTheme?: () => void;
  footerAction?: {
    label: string;
    danger?: boolean;
    onPress: () => void;
  };
  secondaryFooterAction?: {
    label: string;
    onPress: () => void;
  };
}

/**
 * Menu tiroir responsive pour smartphone et tablette (< 1024 px).
 * Se ferme automatiquement après navigation ou clic hors du panneau.
 */
export function MobileNavDrawer({
  visible,
  onClose,
  title = 'E-Mobilier',
  subtitle = 'Navigation',
  items,
  isDark,
  onToggleTheme,
  footerAction,
  secondaryFooterAction,
}: MobileNavDrawerProps) {
  const theme = useTheme();
  const { width } = useResponsive();
  const drawerWidth = Math.min(320, Math.round(width * 0.86));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Fermer le menu"
          style={styles.backdrop}
          onPress={onClose}
        />
        <SafeAreaView
          edges={['top', 'bottom']}
          style={[
            styles.drawer,
            {
              width: drawerWidth,
              backgroundColor: theme.cardBackground,
              borderRightColor: theme.cardBorder,
            },
          ]}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: theme.navy }]}>
            <View style={styles.brandRow}>
              <View style={styles.logoWrap}>
                <Building2 size={18} color="#F59E0B" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={styles.brandTitle}>
                  {title}
                </Text>
                <Text numberOfLines={1} style={styles.brandSub}>
                  {subtitle}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityLabel="Fermer le menu"
              onPress={onClose}
              hitSlop={10}
              style={styles.closeBtn}>
              <X size={20} color="#FFFFFF" strokeWidth={2.3} />
            </Pressable>
          </View>

          {/* Navigation Items */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {items.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => {
                  onClose();
                  item.onPress();
                }}
                style={({ pressed }) => [
                  styles.navItem,
                  {
                    backgroundColor: item.accent ? theme.primaryLight : 'transparent',
                    borderColor: item.accent ? theme.primary : theme.cardBorder,
                  },
                  pressed && { opacity: 0.78 },
                ]}>
                <View style={styles.navIconWrap}>{item.icon}</View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.navLabel,
                      { color: item.accent ? theme.primaryDark : theme.text },
                    ]}>
                    {item.label}
                  </Text>
                  {item.subtitle ? (
                    <Text
                      numberOfLines={1}
                      style={[styles.navSub, { color: theme.textSecondary }]}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
                {item.badge !== undefined && item.badge !== 0 ? (
                  <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>

          {/* Footer Controls */}
          <View style={[styles.footer, { borderTopColor: theme.cardBorder }]}>
            {onToggleTheme && (
              <Pressable
                onPress={onToggleTheme}
                style={[
                  styles.themeRow,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.cardBorder },
                ]}>
                {isDark ? (
                  <Moon size={16} color={theme.text} strokeWidth={2} />
                ) : (
                  <Sun size={16} color={theme.text} strokeWidth={2} />
                )}
                <Text style={[styles.themeText, { color: theme.text }]}>
                  {isDark ? 'Mode sombre actif' : 'Mode clair actif'}
                </Text>
              </Pressable>
            )}

            {secondaryFooterAction && (
              <Pressable
                onPress={() => {
                  onClose();
                  secondaryFooterAction.onPress();
                }}
                style={[
                  styles.footerBtn,
                  { borderColor: theme.primary, backgroundColor: theme.primaryLight },
                ]}>
                <Text style={[styles.footerBtnText, { color: theme.primaryDark }]}>
                  {secondaryFooterAction.label}
                </Text>
              </Pressable>
            )}

            {footerAction && (
              <Pressable
                onPress={() => {
                  onClose();
                  footerAction.onPress();
                }}
                style={[
                  styles.footerBtn,
                  footerAction.danger
                    ? { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }
                    : { borderColor: theme.primary, backgroundColor: theme.primary },
                ]}>
                {footerAction.danger && <LogOut size={15} color="#DC2626" strokeWidth={2.2} />}
                <Text
                  style={[
                    styles.footerBtnText,
                    { color: footerAction.danger ? '#DC2626' : '#FFFFFF' },
                  ]}>
                  {footerAction.label}
                </Text>
              </Pressable>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawer: {
    height: '100%',
    borderRightWidth: 1,
    zIndex: 2,
    ...Platform.select({
      web: { boxShadow: '8px 0 28px rgba(15, 23, 42, 0.28)' } as any,
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.24,
        shadowRadius: 14,
      },
      android: { elevation: 12 },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  logoWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  brandSub: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 14,
    gap: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  navIconWrap: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  navSub: {
    fontSize: 11,
    marginTop: 1,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  footer: {
    padding: 14,
    borderTopWidth: 1,
    gap: 8,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  themeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  footerBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
