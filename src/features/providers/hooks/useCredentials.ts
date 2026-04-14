import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getProviderConfig,
  saveProviderField,
  deleteProviderConfig,
  type ProviderStatus,
  checkAllProviderStatus,
} from "@/features/providers/api/credentials";
import type { ProviderFieldValue } from "@/shared/types/providers";

interface UseCredentialsReturn {
  configuredIds: Set<string>;
  loading: boolean;
  saving: boolean;
  getConfig: (providerId: string) => Promise<ProviderFieldValue[]>;
  save: (key: string, value: string) => Promise<void>;
  remove: (providerId: string) => Promise<void>;
  completeNativeSetup: () => Promise<void>;
}

export function useCredentials(): UseCredentialsReturn {
  const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refreshStatuses = useCallback(async () => {
    const nextStatuses = await checkAllProviderStatus();
    setStatuses(nextStatuses);
    return nextStatuses;
  }, []);

  useEffect(() => {
    refreshStatuses()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refreshStatuses]);

  const configuredIds = useMemo(
    () =>
      new Set(statuses.filter((s) => s.isConfigured).map((s) => s.providerId)),
    [statuses],
  );

  const getConfig = useCallback(async (providerId: string) => {
    return getProviderConfig(providerId);
  }, []);

  const save = useCallback(
    async (key: string, value: string) => {
      setSaving(true);
      try {
        await saveProviderField(key, value);
        await refreshStatuses();
      } finally {
        setSaving(false);
      }
    },
    [refreshStatuses],
  );

  const remove = useCallback(
    async (providerId: string) => {
      setSaving(true);
      try {
        await deleteProviderConfig(providerId);
        await refreshStatuses();
      } finally {
        setSaving(false);
      }
    },
    [refreshStatuses],
  );

  const completeNativeSetup = useCallback(async () => {
    await refreshStatuses();
  }, [refreshStatuses]);

  return {
    configuredIds,
    loading,
    saving,
    getConfig,
    save,
    remove,
    completeNativeSetup,
  };
}
