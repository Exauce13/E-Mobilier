import React from 'react';

import { AgentWorkspace } from '@/components/agent/agent-workspace';
import { ClientWorkspace } from '@/components/client/client-workspace';
import { useAuth } from '@/context/auth-context';

export default function MyPropertiesScreen() {
  const { isAuthenticated, isAgentMobilier, isAdminStaff } = useAuth();

  if (isAuthenticated && isAgentMobilier && !isAdminStaff) {
    return <AgentWorkspace embeddedInTabs={false} initialSection="biens" />;
  }

  return <ClientWorkspace embeddedInTabs={false} initialSection="annonces" />;
}
