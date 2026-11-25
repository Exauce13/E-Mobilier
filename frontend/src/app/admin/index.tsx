import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AgentsKycSection,
  DemasquagesSection,
  GovernanceSection,
  TechHealthSection,
} from '@/components/admin/admin-gov-sections';
import {
  DemandesMatchingSection,
  MetricsSection,
  ModerationSection,
  VisitesOpsSection,
} from '@/components/admin/admin-ops-sections';
import { SuperAdminPrincipalPortal } from '@/components/super-admin/super-admin-portal';
import {
  SuperAdminPostsSection,
  SuperAdminSettingsSection,
} from '@/components/super-admin/super-admin-sections';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { cguApi } from '@/services/api';
import { showMessage } from '@/utils/dialog';

type AdminTabKey =
  | 'metrics'
  | 'moderation'
  | 'catalogue'
  | 'visites'
  | 'demandes'
  | 'demasquages'
  | 'kyc'
  | 'governance'
  | 'parametres'
  | 'tech';

export default function AdminDashboardScreen() {
  const { isSuperAdminPrincipal } = useAuth();

  if (isSuperAdminPrincipal) {
    return <SuperAdminPrincipalPortal initialPage="dashboard" />;
  }

  return <StandardAdminDashboard />;
}

function StandardAdminDashboard() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isAdminStaff, isSuperAdmin, hasAnyRole } = useAuth();

  const tabs = useMemo(() => {
    const canKyc = hasAnyRole(['Super Admin Principal', 'Super Admin Technique', 'Secrétaire', 'Admin']);
    const list: Array<{ key: AdminTabKey; label: string }> = [
      { key: 'metrics', label: 'Métriques' },
      { key: 'moderation', label: 'Modération' },
      { key: 'visites', label: 'Visites' },
      { key: 'demandes', label: 'Demandes' },
      { key: 'demasquages', label: 'Démasquages' },
    ];
    if (canKyc) list.push({ key: 'kyc', label: 'Agents KYC' });
    if (isSuperAdmin) {
      list.push({ key: 'catalogue', label: 'Tous les posts' });
      list.push({ key: 'governance', label: 'Gouvernance' });
      list.push({ key: 'parametres', label: 'Paramètres' });
      list.push({ key: 'tech', label: 'Tech & Sécurité' });
    }
    return list;
  }, [hasAnyRole, isSuperAdmin]);

  const [activeTab, setActiveTab] = useState<AdminTabKey>('metrics');
  const [charteModalVisible, setCharteModalVisible] = useState(false);
  const [charteMsg, setCharteMsg] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const handleCharteRequired = (msg?: string) => {
    setCharteMsg(
      msg ||
        "La signature de la Charte de Confidentialité et de Non-Contournement est requise pour accéder aux opérations."
    );
    setCharteModalVisible(true);
  };

  const handleSignCharte = async () => {
    setSigning(true);
    const res = await cguApi.signerCharte(true);
    setSigning(false);
    if (res.success) {
      setCharteModalVisible(false);
      setRefreshTick((t) => t + 1);
      showMessage('Charte signée', res.message || 'Accès administration débloqué.');
    } else {
      showMessage('Erreur', res.message || 'Impossible de signer la charte.');
    }
  };

  if (!isAdminStaff) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <ScreenHeader title="Administration" />
        <View style={styles.deniedBox}>
          <Text style={[styles.deniedTitle, { color: theme.text }]}>Accès restreint</Text>
          <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
            Cet espace est réservé aux profils d'administration E-Mobilier.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Administration E-Mobilier"
        subtitle="Gouvernance, Modération & Opérations"
        rightAction={
          !isSuperAdmin ? (
            <Pressable
              onPress={() => setCharteModalVisible(true)}
              style={[styles.charteBtn, { backgroundColor: theme.gold }]}>
              <Text style={styles.charteBtnText}>Charte</Text>
            </Pressable>
          ) : null
        }
      />

      {/* Horizontal Tab Bar */}
      <View style={[styles.tabBarWrap, { borderBottomColor: theme.cardBorder, backgroundColor: theme.cardBackground }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tabPill,
                  { backgroundColor: active ? theme.primary : theme.backgroundElement },
                ]}>
                <Text style={{ color: active ? '#FFFFFF' : theme.text, fontWeight: '700', fontSize: 13 }}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        key={`${activeTab}-${refreshTick}`}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]}>
        {activeTab === 'metrics' && <MetricsSection onCharteRequired={handleCharteRequired} />}
        {activeTab === 'moderation' && <ModerationSection onCharteRequired={handleCharteRequired} />}
        {activeTab === 'catalogue' && <SuperAdminPostsSection />}
        {activeTab === 'visites' && <VisitesOpsSection onCharteRequired={handleCharteRequired} />}
        {activeTab === 'demandes' && <DemandesMatchingSection onCharteRequired={handleCharteRequired} />}
        {activeTab === 'demasquages' && <DemasquagesSection onCharteRequired={handleCharteRequired} />}
        {activeTab === 'kyc' && <AgentsKycSection onCharteRequired={handleCharteRequired} />}
        {activeTab === 'governance' && <GovernanceSection />}
        {activeTab === 'parametres' && <SuperAdminSettingsSection />}
        {activeTab === 'tech' && <TechHealthSection />}
      </ScrollView>

      {/* Charte de Non-Contournement Modal */}
      <Modal
        visible={charteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCharteModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Charte de Non-Contournement
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19 }}>
              {charteMsg ||
                "En signant cette charte horodatée, vous vous engagez à respecter la confidentialité des coordonnées clients et les règles d'audit anti-contournement d'E-Mobilier."}
            </Text>
            <Pressable
              onPress={handleSignCharte}
              disabled={signing}
              style={[styles.signBtn, { backgroundColor: theme.primary }]}>
              <Text style={styles.signBtnText}>
                {signing ? 'Signature en cours...' : 'Accepter et signer numériquement'}
              </Text>
            </Pressable>
            <Pressable onPress={() => setCharteModalVisible(false)} style={styles.cancelLink}>
              <Text style={{ color: theme.textSecondary }}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBarWrap: { borderBottomWidth: 1, paddingVertical: 8 },
  tabScroll: { paddingHorizontal: Spacing.three, gap: 8 },
  tabPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  scroll: {
    padding: Spacing.three,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  charteBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  charteBtnText: { color: '#0F172A', fontWeight: '800', fontSize: 12 },
  deniedBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.five, gap: 8 },
  deniedTitle: { fontSize: 18, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.7)', justifyContent: 'center', padding: Spacing.four },
  modalCard: { borderRadius: 20, borderWidth: 1, padding: Spacing.four, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  signBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  signBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  cancelLink: { alignItems: 'center', paddingVertical: 6 },
});
