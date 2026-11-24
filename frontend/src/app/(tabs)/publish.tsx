import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PublishPropertyForm } from '@/components/publish/publish-property-form';
import { BottomTabInset } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

export default function PublishScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { horizontalPadding } = useResponsive();
  const { isAgentMobilier } = useAuth();

  const [selectedMode, setSelectedMode] = useState<'client' | 'agent'>(
    isAgentMobilier ? 'agent' : 'client'
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Mode Switcher Bar */}
      <View
        style={[
          styles.switcherWrap,
          {
            paddingHorizontal: horizontalPadding,
            backgroundColor: theme.cardBackground,
            borderBottomColor: theme.cardBorder,
          },
        ]}>
        <View style={styles.switcherInner}>
          <View style={styles.titleCol}>
            <Text style={[styles.title, { color: theme.text }]}>Publier une annonce</Text>
            <Text style={[styles.sub, { color: theme.textSecondary }]}>
              Choisissez le parcours Client ou Agent Immobilier
            </Text>
          </View>

          <View style={[styles.modeToggle, { backgroundColor: theme.backgroundElement }]}>
            <Pressable
              onPress={() => setSelectedMode('client')}
              style={[
                styles.modeBtn,
                selectedMode === 'client' && { backgroundColor: theme.primary },
              ]}>
              <Text
                style={{
                  color: selectedMode === 'client' ? '#FFFFFF' : theme.text,
                  fontSize: 12,
                  fontWeight: '800',
                }}>
                Client (500 F)
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedMode('agent')}
              style={[
                styles.modeBtn,
                selectedMode === 'agent' && { backgroundColor: '#F59E0B' },
              ]}>
              <Text
                style={{
                  color: selectedMode === 'agent' ? '#0F172A' : theme.text,
                  fontSize: 12,
                  fontWeight: '800',
                }}>
                Agent (100 F)
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() =>
              router.push((selectedMode === 'agent' ? '/publish-agent' : '/publish-client') as any)
            }>
            <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700' }}>
              Page dédiée ↗
            </Text>
          </Pressable>
        </View>
      </View>

      <PublishPropertyForm
        mode={selectedMode}
        bottomPadding={BottomTabInset + insets.bottom + 84}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  switcherWrap: {
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  switcherInner: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  titleCol: { flex: 1, minWidth: 180 },
  title: { fontSize: 19, fontWeight: '900' },
  sub: { fontSize: 12 },
  modeToggle: { flexDirection: 'row', padding: 3, borderRadius: 12, gap: 4 },
  modeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9 },
});
