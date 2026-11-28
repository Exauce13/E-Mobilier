import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import {
  ClientWorkspace,
  type ClientWorkspaceSection,
} from '@/components/client/client-workspace';

export default function ClientSpaceScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const initialSection: ClientWorkspaceSection =
    rawTab === 'recherches' || rawTab === 'visites' || rawTab === 'profil' || rawTab === 'annonces'
      ? rawTab
      : 'annonces';

  return <ClientWorkspace embeddedInTabs={false} initialSection={initialSection} />;
}
