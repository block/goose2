import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AsyncButton } from "@/shared/ui/async-button";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Spinner } from "@/shared/ui/spinner";
import {
  getProviderIcon,
  formatProviderLabel,
} from "@/shared/ui/icons/ProviderIcons";
import { IconCheck, IconLoader2 } from "@tabler/icons-react";
import {
  authenticateModelProvider,
  onModelSetupOutput,
} from "@/features/providers/api/modelSetup";
import type {
  ProviderDisplayInfo,
  ProviderField,
  ProviderFieldValue,
} from "@/shared/types/providers";
import {
  MAX_SETUP_OUTPUT_LINES,
  type SetupOutputLine,
  getDefaultFieldValue,
  createDraftValues,
  getSetupMessage,
  getNativeConnectDescription,
  getFieldSetupDescription,
  renderInlineCodeMessage,
  renderSetupMessage,
} from "./modelProviderHelpers";

interface ModelProviderRowProps {
  provider: ProviderDisplayInfo;
  onGetConfig: (providerId: string) => Promise<ProviderFieldValue[]>;
  onSaveField: (key: string, value: string, isSecret: boolean) => Promise<void>;
  onRemoveConfig?: () => Promise<void>;
  onCompleteNativeSetup: () => Promise<void>;
  saving?: boolean;
}

export function ModelProviderRow({
  provider,
  onGetConfig,
  onSaveField,
  onRemoveConfig,
  onCompleteNativeSetup,
  saving = false,
}: ModelProviderRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [configValues, setConfigValues] = useState<ProviderFieldValue[]>([]);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [error, setError] = useState("");
  const [authenticating, setAuthenticating] = useState(false);
  const [setupOutput, setSetupOutput] = useState<SetupOutputLine[]>([]);
  const [setupError, setSetupError] = useState("");
  const [showSavedState, setShowSavedState] = useState(false);
  const [preserveSetupLayout, setPreserveSetupLayout] = useState(false);
  const setupLineCounter = useRef(0);
  const hasLoadedConfig = useRef(false);
  const shouldRestorePanelFocus = useRef(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const icon = getProviderIcon(provider.id, "size-4");
  const fields = provider.fields ?? [];
  const hasFields = fields.length > 0;
  const supportsNativeConnect = !!provider.nativeConnectQuery;
  const isConnected =
    provider.status === "connected" || provider.status === "built_in";
  const fieldValueMap = useMemo(
    () => new Map(configValues.map((value) => [value.key, value])),
    [configValues],
  );

  const loadConfig = useCallback(
    async ({ showSkeleton = false }: { showSkeleton?: boolean } = {}) => {
      if (!hasFields) return;
      if (showSkeleton) {
        setLoadingConfig(true);
      }
      try {
        const nextValues = await onGetConfig(provider.id);
        hasLoadedConfig.current = true;
        setConfigValues(nextValues);
        setDraftValues(createDraftValues(fields, nextValues));
        setError("");
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to load provider settings",
        );
      } finally {
        if (showSkeleton) {
          setLoadingConfig(false);
        }
      }
    },
    [fields, hasFields, onGetConfig, provider.id],
  );

  useEffect(() => {
    if (expanded && hasFields) {
      void loadConfig({ showSkeleton: !hasLoadedConfig.current });
    }
  }, [expanded, hasFields, loadConfig]);

  useEffect(() => {
    if (isConnected) {
      setAuthenticating(false);
      setSetupError("");
    }
  }, [isConnected]);

  useLayoutEffect(() => {
    if (!shouldRestorePanelFocus.current) {
      return;
    }

    shouldRestorePanelFocus.current = false;
    panelRef.current?.focus({ preventScroll: true });
  });

  function appendSetupOutput(line: string) {
    setupLineCounter.current += 1;
    setSetupOutput((current) =>
      [
        ...current,
        {
          id: setupLineCounter.current,
          text: line,
        },
      ].slice(-MAX_SETUP_OUTPUT_LINES),
    );
  }

  async function runNativeConnect() {
    if (!provider.nativeConnectQuery) {
      return;
    }

    setExpanded(true);
    setAuthenticating(true);
    setSetupError("");
    setSetupOutput([]);
    setupLineCounter.current = 0;
    setEditingKey(null);
    setError("");
    setShowSavedState(false);
    setPreserveSetupLayout(false);

    const unlisten = await onModelSetupOutput(provider.id, appendSetupOutput);

    try {
      await authenticateModelProvider(provider.id, provider.nativeConnectQuery);
      await onCompleteNativeSetup();
    } catch (nextError) {
      setSetupError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to complete sign-in",
      );
    } finally {
      unlisten();
      setAuthenticating(false);
    }
  }

  function handleToggle() {
    setExpanded((current) => {
      if (current) {
        setShowSavedState(false);
        setPreserveSetupLayout(false);
      }
      return !current;
    });
    setEditingKey(null);
    setError("");
    setSetupError("");
  }

  function getFieldValue(field: ProviderField) {
    return fieldValueMap.get(field.key) ?? getDefaultFieldValue(field);
  }

  function getDisplayValue(field: ProviderField) {
    const fieldValue = getFieldValue(field);
    if (!fieldValue.isSet) {
      return "Not set";
    }
    return fieldValue.value ?? "Saved";
  }

  async function handleSaveField(field: ProviderField) {
    const nextValue = draftValues[field.key]?.trim() ?? "";
    if (!nextValue) {
      setError(`Enter a value for ${field.label}`);
      return;
    }
    setError("");
    try {
      shouldRestorePanelFocus.current = true;
      await onSaveField(field.key, nextValue, field.secret);
      await loadConfig();
      setEditingKey(null);
      setShowSavedState(true);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to save",
      );
    }
  }

  async function handleSaveSetup() {
    const missingLabels = fields
      .filter((field) => {
        if (!field.required) {
          return false;
        }
        const currentValue = getFieldValue(field);
        const nextValue = draftValues[field.key]?.trim() ?? "";
        return !currentValue.isSet && !nextValue;
      })
      .map((field) => field.label);

    if (missingLabels.length > 0) {
      setError(`Fill in ${missingLabels.join(", ")}`);
      return;
    }

    const fieldsToSave = fields.filter((field) => {
      const currentValue = getFieldValue(field);
      const nextValue = draftValues[field.key]?.trim() ?? "";

      if (!nextValue) {
        return false;
      }

      if (field.secret) {
        return true;
      }

      return nextValue !== (currentValue.value ?? "");
    });

    if (fieldsToSave.length === 0) {
      setError("");
      return;
    }

    setError("");
    try {
      for (const field of fieldsToSave) {
        const nextValue = draftValues[field.key]?.trim() ?? "";
        await onSaveField(field.key, nextValue, field.secret);
      }
      await loadConfig();
      setShowSavedState(true);
      setPreserveSetupLayout(true);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to save",
      );
    }
  }

  async function handleRemove() {
    try {
      shouldRestorePanelFocus.current = true;
      await onRemoveConfig?.();
      await loadConfig();
      setEditingKey(null);
      setError("");
      setShowSavedState(false);
      setPreserveSetupLayout(false);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to remove",
      );
    }
  }

  function renderExpandedContent() {
    if (!expanded) return null;

    const setupMessage = getSetupMessage(
      provider.setupMethod,
      isConnected,
      supportsNativeConnect,
    );
    const nativeConnectDescription = getNativeConnectDescription(
      provider.setupMethod,
    );
    const fieldSetupDescription = getFieldSetupDescription(
      provider.setupMethod,
    );

    if (loadingConfig && hasFields) {
      return (
        <div
          ref={panelRef}
          tabIndex={-1}
          className="focus-override mx-3 space-y-3 rounded-b-lg border-x border-b px-3 py-3 outline-none"
        >
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      );
    }

    if (supportsNativeConnect && !hasFields) {
      return (
        <div
          ref={panelRef}
          tabIndex={-1}
          className="focus-override mx-3 space-y-3 rounded-b-lg border-x border-b px-3 py-3 outline-none"
        >
          {!isConnected && nativeConnectDescription ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {nativeConnectDescription}
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => void runNativeConnect()}
                disabled={authenticating}
                className="shrink-0"
              >
                {authenticating ? (
                  <Spinner className="size-3.5 text-current" />
                ) : null}
                {setupError ? "Retry" : "Connect"}
              </Button>
            </div>
          ) : (
            renderSetupMessage(setupMessage)
          )}
          {authenticating ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner className="size-3.5 text-accent" />
              <span>Waiting for sign-in...</span>
            </div>
          ) : null}
          {setupOutput.length > 0 ? (
            <div className="space-y-1 rounded-md bg-muted px-3 py-2 font-mono text-xxs text-muted-foreground">
              {setupOutput.map((line) => (
                <p key={line.id}>{line.text}</p>
              ))}
            </div>
          ) : null}
          {setupError ? (
            <p className="text-xs text-danger">{setupError}</p>
          ) : null}
        </div>
      );
    }

    if (hasFields && isConnected && !preserveSetupLayout) {
      return (
        <div
          ref={panelRef}
          tabIndex={-1}
          className="focus-override mx-3 space-y-3 rounded-b-lg border-x border-b px-3 py-3 outline-none"
        >
          {fields.map((field) => {
            const isEditing = editingKey === field.key;
            return (
              <div
                key={field.key}
                className="space-y-2 rounded-md border border-border px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm">{field.label}</p>
                    {!isEditing && (
                      <p className="truncate text-xs text-muted-foreground">
                        {getDisplayValue(field)}
                      </p>
                    )}
                  </div>

                  {!isEditing && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setEditingKey(field.key);
                        setError("");
                        setShowSavedState(false);
                      }}
                      disabled={saving}
                      className="text-muted-foreground"
                    >
                      {getFieldValue(field).isSet ? "Edit" : "Add"}
                    </Button>
                  )}
                </div>

                {isEditing && (
                  <div className="flex items-center gap-2">
                    <Input
                      type={field.secret ? "password" : "text"}
                      value={draftValues[field.key] ?? ""}
                      placeholder={
                        field.secret && getFieldValue(field).isSet
                          ? getDisplayValue(field)
                          : field.placeholder
                      }
                      onChange={(event) => {
                        setShowSavedState(false);
                        setDraftValues((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }));
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          void handleSaveField(field);
                        }
                      }}
                      disabled={saving}
                      className="h-8 flex-1 text-xs"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleSaveField(field)}
                      disabled={
                        saving || !(draftValues[field.key]?.trim() ?? "")
                      }
                      className="h-8"
                    >
                      {saving ? (
                        <IconLoader2 className="size-3 animate-spin" />
                      ) : null}
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDraftValues((current) => ({
                          ...current,
                          [field.key]: field.secret
                            ? ""
                            : (getFieldValue(field).value ?? ""),
                        }));
                        setEditingKey(null);
                        setError("");
                      }}
                      disabled={saving}
                      className="h-8"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex justify-end gap-2">
            {showSavedState ? (
              <Button type="button" variant="secondary" size="sm" disabled>
                Saved
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleRemove()}
              disabled={saving}
              className="text-danger hover:text-danger"
            >
              {saving ? <IconLoader2 className="size-3 animate-spin" /> : null}
              Disconnect
            </Button>
          </div>
          {renderSetupMessage(setupMessage)}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      );
    }

    if (hasFields) {
      return (
        <div
          ref={panelRef}
          tabIndex={-1}
          className="focus-override mx-3 space-y-3 rounded-b-lg border-x border-b px-3 py-3 outline-none"
        >
          {!isConnected && fieldSetupDescription ? (
            <p className="text-xs text-muted-foreground">
              {fieldSetupDescription}
            </p>
          ) : null}
          {fields.map((field) => {
            const fieldValue = getFieldValue(field);
            return (
              <div key={field.key} className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-foreground">
                    {field.label}
                  </span>
                  {field.required && (
                    <span className="text-xxs text-muted-foreground">
                      Required
                    </span>
                  )}
                </div>
                <Input
                  type={field.secret ? "password" : "text"}
                  value={draftValues[field.key] ?? ""}
                  placeholder={
                    field.secret && fieldValue.isSet
                      ? getDisplayValue(field)
                      : field.placeholder
                  }
                  onChange={(event) => {
                    setShowSavedState(false);
                    setDraftValues((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }));
                  }}
                  disabled={saving}
                  className="h-8 text-xs"
                />
              </div>
            );
          })}

          <div className="flex justify-end">
            <AsyncButton
              type="button"
              state={saving ? "pending" : showSavedState ? "success" : "idle"}
              idleLabel="Save"
              pendingLabel="Saving..."
              successLabel="Saved"
              pendingVisual="text"
              pendingDelayMs={250}
              size="sm"
              onClick={() => void handleSaveSetup()}
              disabled={saving || showSavedState}
              className="h-8"
            />
          </div>
          {provider.setupMethod === "host_with_oauth_fallback"
            ? renderInlineCodeMessage(
                "Leave Access Token blank, save your host URL, then run `goose configure` in your terminal to sign in.",
              )
            : null}
          {provider.setupMethod === "cloud_credentials" && setupMessage
            ? renderSetupMessage(setupMessage)
            : null}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      );
    }

    return (
      <div
        ref={panelRef}
        tabIndex={-1}
        className="focus-override mx-3 space-y-2 rounded-b-lg border-x border-b px-3 py-3 outline-none"
      >
        {renderSetupMessage(setupMessage)}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={expanded}
        disabled={authenticating}
        className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:bg-transparent"
      >
        <div className="flex size-6 flex-shrink-0 items-center justify-center">
          {icon || (
            <span className="text-xs font-medium text-muted-foreground">
              {formatProviderLabel(provider.id).charAt(0)}
            </span>
          )}
        </div>

        <span className="min-w-0 flex-1 text-sm">{provider.displayName}</span>

        {isConnected ? (
          <IconCheck className="size-4 flex-shrink-0 text-success" />
        ) : null}
        {!isConnected && authenticating ? (
          <Spinner className="size-3.5 flex-shrink-0 text-accent" />
        ) : null}
      </button>

      {renderExpandedContent()}
    </div>
  );
}
