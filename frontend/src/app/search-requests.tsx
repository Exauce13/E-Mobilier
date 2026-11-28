import React from 'react';

import { ClientWorkspace } from '@/components/client/client-workspace';

export default function SearchRequestsScreen() {
  return <ClientWorkspace embeddedInTabs={false} initialSection="recherches" />;
}
