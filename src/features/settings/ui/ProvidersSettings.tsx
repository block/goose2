import { useEffect, useMemo, useState } from "react";
import { Button } from "@/shared/ui/button";
import { Separator } from "@/shared/ui/separator";
import { Skeleton } from "@/shared/ui/skeleton";
import { IconChevronDown, IconRefresh } from "@tabler/icons-react";
import {
  getAgentProviders,
  getModelProviders,
} from "@/features/providers/providerCatalog";
import { useCredentials } from "@/features/providers/hooks/useCredentials";
import { AgentProviderCard } from "./AgentProviderCard";
import { ModelProviderRow } from "./ModelProviderRow";
import type {
  ProviderDisplayInfo,
  ProviderSetupStatus,
  ProviderCatalogEntry,
} from "@/shared/types/providers";

function resolveStatus(
  entry: ProviderCatalogEntry,
  configuredIds: Set<string>,
): ProviderSetupStatus {
  if (entry.id === "goose") return "built_in";
  if (entry.category === "agent") return "not_installed";
  if (configuredIds.has(entry.id)) return "connected";
  return "not_configured";
}

function toDisplayInfo(
  entries: ProviderCatalogEntry[],
  configuredIds: Set<string>,
): ProviderDisplayInfo[] {
  return entries.map((entry) => ({
    ...entry,
    status: resolveStatus(entry, configuredIds),
  }));
}

export function ProvidersSettings() {
  const [showAllModels, setShowAllModels] = useState(false);
  const [modelOrder, setModelOrder] = useState<string[] | null>(null);

  const {
    configuredIds,
    loading,
    saving,
    needsRestart,
    getConfig,
    save,
    remove,
    restart,
    completeNativeSetup,
  } = useCredentials();

  const agents = useMemo(
    () => toDisplayInfo(getAgentProviders(), configuredIds),
    [configuredIds],
  );

  const allModels = useMemo(
    () => toDisplayInfo(getModelProviders(), configuredIds),
    [configuredIds],
  );

  const sortedModels = useMemo(() => {
    return [...allModels].sort((a, b) => {
      const connected = (p: ProviderDisplayInfo) =>
        p.status === "connected" || p.status === "built_in";
      if (connected(a) && !connected(b)) return -1;
      if (!connected(a) && connected(b)) return 1;
      return 0;
    });
  }, [allModels]);

  useEffect(() => {
    if (!loading && modelOrder === null) {
      setModelOrder(sortedModels.map((model) => model.id));
    }
  }, [loading, modelOrder, sortedModels]);

  const orderedModels = useMemo(() => {
    if (!modelOrder) {
      return sortedModels;
    }

    const orderIndex = new Map(
      modelOrder.map((modelId, index) => [modelId, index]),
    );

    return [...allModels].sort((a, b) => {
      const aIndex = orderIndex.get(a.id);
      const bIndex = orderIndex.get(b.id);

      if (aIndex !== undefined && bIndex !== undefined) {
        return aIndex - bIndex;
      }
      if (aIndex !== undefined) {
        return -1;
      }
      if (bIndex !== undefined) {
        return 1;
      }
      return a.displayName.localeCompare(b.displayName);
    });
  }, [allModels, modelOrder, sortedModels]);

  const promotedModels = orderedModels.filter(
    (m) => m.tier === "promoted" || m.tier === "standard",
  );
  const advancedModels = orderedModels.filter((m) => m.tier === "advanced");
  const visibleModels = showAllModels ? orderedModels : promotedModels;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold font-display tracking-tight">
        Providers
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Connect agents and AI models to use with Goose
      </p>

      {needsRestart && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-accent bg-background-accent/30 px-3 py-2.5">
          <p className="flex-1 text-sm">Restart to apply credential changes.</p>
          <Button type="button" size="sm" onClick={() => void restart()}>
            <IconRefresh className="size-3.5" />
            Restart now
          </Button>
        </div>
      )}

      <Separator className="my-4" />

      <section>
        <div className="mb-3">
          <h4 className="text-sm font-semibold">Agents</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Agents handle your requests using their own tools and models
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {agents.map((agent) => (
            <AgentProviderCard key={agent.id} provider={agent} />
          ))}
        </div>
      </section>

      <Separator className="my-6" />

      <section>
        <div className="mb-3">
          <h4 className="text-sm font-semibold">Models</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            AI models that power Goose. Expand a provider to review what it
            needs. Connect signs in with an existing account, while Set up saves
            API keys or other provider settings.
          </p>
        </div>

        <div className="space-y-2">
          {visibleModels.map((model) => (
            <ModelProviderRow
              key={model.id}
              provider={model}
              onGetConfig={getConfig}
              onSaveField={save}
              onRemoveConfig={() => remove(model.id)}
              onCompleteNativeSetup={completeNativeSetup}
              saving={saving}
            />
          ))}
        </div>

        {!showAllModels && advancedModels.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAllModels(true)}
            className="mt-2 w-full text-muted-foreground"
          >
            Show {advancedModels.length} more providers
            <IconChevronDown className="size-3" />
          </Button>
        )}

        {showAllModels && advancedModels.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAllModels(false)}
            className="mt-2 w-full text-muted-foreground"
          >
            Show fewer
          </Button>
        )}
      </section>
    </div>
  );
}
