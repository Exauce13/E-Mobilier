import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { publicConfigApi } from '@/services/api';
import type { PlatformTarifs, PublicPlatformConfig } from '@/types/api';

interface PlatformConfigContextValue {
  config: PublicPlatformConfig | null;
  tarifs: PlatformTarifs | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const PlatformConfigContext = createContext<PlatformConfigContextValue>({
  config: null,
  tarifs: null,
  loading: true,
  error: null,
  refresh: async () => {},
});

export function PlatformConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<PublicPlatformConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await publicConfigApi.getConfig();
    if (res.success && res.data) {
      setConfig(res.data);
    } else {
      setError(res.message || 'Impossible de charger la configuration de la plateforme.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<PlatformConfigContextValue>(
    () => ({
      config,
      tarifs: config?.tarifs ?? null,
      loading,
      error,
      refresh,
    }),
    [config, loading, error, refresh]
  );

  return (
    <PlatformConfigContext.Provider value={value}>
      {children}
    </PlatformConfigContext.Provider>
  );
}

export function usePlatformConfig(): PlatformConfigContextValue {
  return useContext(PlatformConfigContext);
}
