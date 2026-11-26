import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  onBack?: () => void;
}

export function ScreenHeader({ title, subtitle, rightAction, onBack }: ScreenHeaderProps) {
  const theme = useTheme();
  const { isSmallMobile, horizontalPadding, contentMaxWidth } = useResponsive();

  return (
    <View
      style={[
        styles.headerOuter,
        {
          backgroundColor: theme.navy,
          borderBottomColor: 'rgba(255,255,255,0.08)',
          paddingHorizontal: isSmallMobile ? 10 : horizontalPadding,
        },
      ]}>
      <View style={[styles.headerInner, { maxWidth: contentMaxWidth }]}>
        <Pressable
          accessibilityLabel="Retour"
          onPress={
            onBack ||
            (() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/' as any);
              }
            })
          }
          hitSlop={10}
          style={styles.backBtn}>
          <ArrowLeft size={20} color="#FFFFFF" strokeWidth={2.2} />
        </Pressable>

        <View style={styles.titleWrap}>
          <Text
            numberOfLines={1}
            style={[styles.title, isSmallMobile && { fontSize: 15 }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {rightAction ? <View style={styles.right}>{rightAction}</View> : <View style={styles.spacer} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerOuter: {
    borderBottomWidth: 1,
    paddingVertical: Spacing.two + 2,
    alignItems: 'center',
    width: '100%',
  },
  headerInner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  subtitle: { color: '#CBD5E1', fontSize: 12, marginTop: 1 },
  right: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '45%' },
  spacer: { width: 40, flexShrink: 0 },
});
