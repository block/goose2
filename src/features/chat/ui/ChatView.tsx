import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { MessageTimeline } from "./MessageTimeline";
import { ChatInput } from "./ChatInput";
import type { PastedImage } from "@/shared/types/messages";
import { LoadingGoose } from "./LoadingGoose";
import { useChat } from "../hooks/useChat";
import { useChatStore } from "../stores/chatStore";
import { useAgentStore } from "@/features/agents/stores/agentStore";
import { useProviderSelection } from "@/features/agents/hooks/useProviderSelection";
import { useChatSessionStore } from "../stores/chatSessionStore";
import { getProject, type ProjectInfo } from "@/features/projects/api/projects";
import { useProjectStore } from "@/features/projects/stores/projectStore";
import { acpGetModelState } from "@/shared/api/acp";
import {
  buildProjectSystemPrompt,
  composeSystemPrompt,
  getProjectFolderOption,
} from "@/features/projects/lib/chatProjectContext";
import { useAvatarSrc } from "@/shared/hooks/useAvatarSrc";
import { getHomeDir } from "@/shared/api/system";
import { ArtifactPolicyProvider } from "../hooks/ArtifactPolicyContext";

interface ChatViewProps {
  sessionId?: string;
  agentName?: string;
  agentAvatarUrl?: string;
  initialProvider?: string;
  initialPersonaId?: string;
  initialMessage?: string;
  initialImages?: PastedImage[];
  onInitialMessageConsumed?: () => void;
  onCreateProject?: (options?: {
    onCreated?: (projectId: string) => void;
  }) => void;
  onCreateProjectFromFolder?: (options?: {
    onCreated?: (projectId: string) => void;
  }) => void;
}

export function ChatView({
  sessionId,
  agentName = "Goose",
  agentAvatarUrl,
  initialProvider,
  initialPersonaId,
  initialMessage,
  initialImages,
  onInitialMessageConsumed,
  onCreateProject,
  onCreateProjectFromFolder,
}: ChatViewProps) {
  const [activeSessionId] = useState(() => sessionId ?? crypto.randomUUID());

  // Provider state from shared store
  const {
    providers,
    providersLoading,
    selectedProvider: globalSelectedProvider,
    setSelectedProvider: setGlobalSelectedProvider,
  } = useProviderSelection();

  // Persona state
  const personas = useAgentStore((s) => s.personas);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(
    initialPersonaId ?? null,
  );
  const session = useChatSessionStore((s) =>
    s.sessions.find((candidate) => candidate.id === activeSessionId),
  );
  const modelStateByProvider = useChatSessionStore(
    (s) => s.modelStateByProvider,
  );
  const projects = useProjectStore((s) => s.projects);
  const storedProject = useProjectStore((s) =>
    session?.projectId
      ? s.projects.find((candidate) => candidate.id === session.projectId)
      : undefined,
  );
  const [fallbackProject, setFallbackProject] = useState<ProjectInfo | null>(
    null,
  );
  const [homeArtifactsRoot, setHomeArtifactsRoot] = useState<string | null>(
    null,
  );
  const [modelsLoading, setModelsLoading] = useState(false);
  const project = storedProject ?? fallbackProject;
  const availableProjects = useMemo(
    () =>
      [...projects]
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
        .map((projectInfo) => ({
          id: projectInfo.id,
          name: projectInfo.name,
          workingDir: projectInfo.workingDirs[0] ?? null,
          color: projectInfo.color,
        })),
    [projects],
  );
  // For existing sessions, use their saved provider; otherwise use global selection
  const selectedProvider =
    session?.providerId ??
    initialProvider ??
    project?.preferredProvider ??
    globalSelectedProvider;

  const selectedPersona = personas.find((p) => p.id === selectedPersonaId);
  const providerModelState = selectedProvider
    ? modelStateByProvider[selectedProvider]
    : undefined;
  const availableModels = providerModelState?.availableModels ?? [];
  const lastModelBootstrapKeyRef = useRef<string | null>(null);
  const bootstrapSessionId = useMemo(
    () =>
      `chat-bootstrap-${activeSessionId}-${selectedProvider}-${selectedPersonaId ?? "default"}`,
    [activeSessionId, selectedPersonaId, selectedProvider],
  );
  const currentModel = useMemo(() => {
    if (modelsLoading) return "Loading models...";
    // Session's saved display name is authoritative after model selection
    if (session?.modelName) return session.modelName;
    // Fall back to matching against available models list
    const matchedModel = session?.currentModelId
      ? availableModels.find((model) => model.id === session.currentModelId)
      : undefined;
    if (matchedModel) return matchedModel.displayName ?? matchedModel.name;
    // Provider's reported current model
    if (providerModelState?.currentModelName)
      return providerModelState.currentModelName;
    return "";
  }, [
    modelsLoading,
    session?.modelName,
    session?.currentModelId,
    availableModels,
    providerModelState?.currentModelName,
  ]);
  const projectFolders = useMemo(
    () => getProjectFolderOption(project),
    [project],
  );
  const effectiveWorkingDir =
    projectFolders[0]?.path ?? homeArtifactsRoot ?? undefined;
  const allowedArtifactRoots = useMemo(() => {
    const roots = projectFolders
      .map((folder) => folder.path?.trim())
      .filter((path): path is string => Boolean(path));
    if (homeArtifactsRoot) {
      roots.push(homeArtifactsRoot);
    }
    return [...new Set(roots)];
  }, [homeArtifactsRoot, projectFolders]);
  const projectSystemPrompt = useMemo(
    () => buildProjectSystemPrompt(project),
    [project],
  );
  const effectiveSystemPrompt = useMemo(
    () =>
      composeSystemPrompt(selectedPersona?.systemPrompt, projectSystemPrompt),
    [selectedPersona?.systemPrompt, projectSystemPrompt],
  );

  useEffect(() => {
    let cancelled = false;

    if (!session?.projectId || storedProject) {
      setFallbackProject(null);
      return;
    }

    getProject(session.projectId)
      .then((projectInfo) => {
        if (!cancelled) {
          setFallbackProject(projectInfo);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFallbackProject(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session?.projectId, storedProject]);

  useEffect(() => {
    let cancelled = false;
    getHomeDir()
      .then((homeDir) => {
        if (cancelled) return;
        const normalizedHome = homeDir.replace(/\\/g, "/").replace(/\/+$/, "");
        setHomeArtifactsRoot(`${normalizedHome}/.goose/artifacts`);
      })
      .catch(() => {
        if (cancelled) return;
        setHomeArtifactsRoot(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const handleProviderChange = useCallback(
    (providerId: string) => {
      if (providerId === selectedProvider) {
        return;
      }

      // Show a notification if there are already messages in the chat
      const currentMessages =
        useChatStore.getState().messagesBySession[activeSessionId] ?? [];
      if (currentMessages.length > 0) {
        const providerLabel =
          providers.find((p) => p.id === providerId)?.label ?? providerId;
        // Include the default model if we already have cached model state
        const cachedState =
          useChatSessionStore.getState().modelStateByProvider[providerId];
        const defaultModelName =
          cachedState?.currentModelName ?? cachedState?.currentModelId;
        const switchText = defaultModelName
          ? `Switched to ${providerLabel} (${defaultModelName})`
          : `Switched to ${providerLabel}`;
        useChatStore.getState().addMessage(activeSessionId, {
          id: crypto.randomUUID(),
          role: "system",
          created: Date.now(),
          content: [
            {
              type: "systemNotification",
              notificationType: "info",
              text: switchText,
            },
          ],
          metadata: { userVisible: true, agentVisible: false },
        });
      }

      setGlobalSelectedProvider(providerId);
      useChatSessionStore.getState().updateSession(activeSessionId, {
        providerId,
        currentModelId: undefined,
        modelName: undefined,
      });
    },
    [activeSessionId, providers, selectedProvider, setGlobalSelectedProvider],
  );

  const handleProjectChange = useCallback(
    (projectId: string | null) => {
      useChatSessionStore
        .getState()
        .updateSession(activeSessionId, { projectId });
    },
    [activeSessionId],
  );

  const handleModelChange = useCallback(
    (modelId: string) => {
      if (modelId === session?.currentModelId) {
        return;
      }

      const matchedModel = availableModels.find(
        (model) => model.id === modelId,
      );
      const displayName =
        matchedModel?.displayName ?? matchedModel?.name ?? modelId;

      // Update session — the pre-send sync in useChat will apply the model
      // to the real ACP session when the user sends the next message.
      useChatSessionStore.getState().updateSession(activeSessionId, {
        currentModelId: modelId,
        modelName: displayName,
      });

      // Show a system notification if there are already messages in the chat
      const currentMessages =
        useChatStore.getState().messagesBySession[activeSessionId] ?? [];
      if (currentMessages.length > 0) {
        useChatStore.getState().addMessage(activeSessionId, {
          id: crypto.randomUUID(),
          role: "system",
          created: Date.now(),
          content: [
            {
              type: "systemNotification",
              notificationType: "info",
              text: `Switched to ${displayName}`,
            },
          ],
          metadata: { userVisible: true, agentVisible: false },
        });
      }
    },
    [activeSessionId, availableModels, session?.currentModelId],
  );

  useEffect(() => {
    if (!selectedProvider) {
      return;
    }

    // Don't fire until effectiveWorkingDir is resolved — avoids a wasted
    // first bootstrap that gets immediately cancelled when homeArtifactsRoot arrives.
    if (!effectiveWorkingDir) {
      return;
    }

    // If the shared store already has models for this provider (e.g. from
    // HomeScreen), use them immediately and skip the expensive ACP spawn.
    const cached =
      useChatSessionStore.getState().modelStateByProvider[selectedProvider];
    if (cached && cached.availableModels.length > 0) {
      // Read from store at call time to avoid closing over session?.currentModelId
      // (which would cause cascading re-fires if added to the dependency array)
      const desiredModelId = useChatSessionStore
        .getState()
        .getSession(activeSessionId)?.currentModelId;
      const desiredModel = desiredModelId
        ? cached.availableModels.find((model) => model.id === desiredModelId)
        : undefined;

      useChatSessionStore.getState().setModelState(activeSessionId, {
        providerId: selectedProvider,
        source: cached.source,
        configId: cached.configId,
        currentModelId: desiredModelId ?? cached.currentModelId,
        currentModelName:
          desiredModel?.displayName ??
          desiredModel?.name ??
          cached.currentModelName,
        availableModels: cached.availableModels,
      });
      setModelsLoading(false);
      return;
    }

    const bootstrapKey = [
      bootstrapSessionId,
      selectedProvider,
      selectedPersonaId ?? "",
      effectiveWorkingDir,
    ].join(":");

    if (lastModelBootstrapKeyRef.current === bootstrapKey) {
      return;
    }

    let cancelled = false;
    lastModelBootstrapKeyRef.current = bootstrapKey;
    setModelsLoading(true);

    acpGetModelState(bootstrapSessionId, selectedProvider, {
      personaId: selectedPersonaId ?? undefined,
      workingDir: effectiveWorkingDir,
      persistSession: false,
    })
      .then((modelState) => {
        if (cancelled) {
          return;
        }

        const desiredModelId = useChatSessionStore
          .getState()
          .getSession(activeSessionId)?.currentModelId;
        const desiredModel = modelState.availableModels.find(
          (model) => model.id === desiredModelId,
        );

        useChatSessionStore.getState().setModelState(activeSessionId, {
          providerId: selectedProvider,
          source: modelState.source,
          configId: modelState.configId,
          currentModelId: desiredModelId ?? modelState.currentModelId,
          currentModelName:
            desiredModel?.displayName ??
            desiredModel?.name ??
            modelState.currentModelName,
          availableModels: modelState.availableModels,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        console.error("Failed to bootstrap ACP model state:", error);
        lastModelBootstrapKeyRef.current = null;
      })
      .finally(() => {
        // Always reset loading — if cancelled, the next effect will set it true again.
        // Leaving it true on cancellation causes permanently stuck "Loading models..."
        setModelsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeSessionId,
    bootstrapSessionId,
    effectiveWorkingDir,
    selectedPersonaId,
    selectedProvider,
  ]);

  // When persona changes, update the provider to match persona's default
  const handlePersonaChange = useCallback(
    (personaId: string | null) => {
      setSelectedPersonaId(personaId);
      const persona = personas.find((p) => p.id === personaId);
      if (persona?.provider) {
        const matchingProvider = providers.find(
          (p) =>
            p.id === persona.provider ||
            p.label.toLowerCase().includes(persona.provider ?? ""),
        );
        if (matchingProvider) {
          handleProviderChange(matchingProvider.id);
        }
      }

      // Update the active agent to match persona
      const agentStore = useAgentStore.getState();
      const matchingAgent = agentStore.agents.find(
        (a) => a.personaId === personaId,
      );
      if (matchingAgent) {
        agentStore.setActiveAgent(matchingAgent.id);
      }

      // Persist persona selection to session store
      useChatSessionStore
        .getState()
        .updateSession(activeSessionId, { personaId: personaId ?? undefined });
    },
    [personas, providers, activeSessionId, handleProviderChange],
  );

  // Validate persona still exists — fall back to default if deleted
  useEffect(() => {
    if (
      selectedPersonaId !== null &&
      personas.length > 0 &&
      !personas.find((p) => p.id === selectedPersonaId)
    ) {
      // Selected persona was deleted — reset to no persona
      setSelectedPersonaId(null);
    }
  }, [personas, selectedPersonaId]);

  const displayAgentName = selectedPersona?.displayName ?? agentName;
  const personaAvatarSrc = useAvatarSrc(selectedPersona?.avatar);

  const personaInfo = selectedPersona
    ? { id: selectedPersona.id, name: selectedPersona.displayName }
    : undefined;

  const {
    messages,
    chatState,
    tokenState,
    sendMessage,
    stopStreaming,
    streamingMessageId,
  } = useChat(
    activeSessionId,
    selectedProvider,
    effectiveSystemPrompt,
    personaInfo,
    effectiveWorkingDir,
  );

  // Ref for deferred sends after persona switch (Bug 1 fix: avoid stale system prompt)
  const deferredSend = useRef<{ text: string; images?: PastedImage[] } | null>(
    null,
  );

  // Wrap sendMessage to handle @ mentioned persona overrides
  const chatStore = useChatStore();
  const handleSend = useCallback(
    (text: string, personaId?: string, images?: PastedImage[]) => {
      if (personaId && personaId !== selectedPersonaId) {
        const newPersona = personas.find((p) => p.id === personaId);
        if (newPersona) {
          // Inject a system notification about the persona switch
          chatStore.addMessage(activeSessionId, {
            id: crypto.randomUUID(),
            role: "system",
            created: Date.now(),
            content: [
              {
                type: "systemNotification",
                notificationType: "info",
                text: `Switched to ${newPersona.displayName}`,
              },
            ],
            metadata: { userVisible: true, agentVisible: false },
          });
        }
        handlePersonaChange(personaId);
        // Defer the send until after persona state updates
        deferredSend.current = { text, images };
        return;
      }
      sendMessage(text, undefined, images);
    },
    [
      sendMessage,
      selectedPersonaId,
      handlePersonaChange,
      personas,
      chatStore,
      activeSessionId,
    ],
  );

  // Effect to send deferred message after persona switch completes
  useEffect(() => {
    if (deferredSend.current && selectedPersona) {
      const { text, images } = deferredSend.current;
      deferredSend.current = null;
      sendMessage(text, undefined, images);
    }
  }, [sendMessage, selectedPersona]);

  // Auto-send initial message from HomeScreen on mount
  const initialMessageSent = useRef(false);
  useEffect(() => {
    if (
      (initialMessage || initialImages?.length) &&
      !initialMessageSent.current &&
      !modelsLoading
    ) {
      initialMessageSent.current = true;
      handleSend(initialMessage ?? "", undefined, initialImages);
      onInitialMessageConsumed?.();
    }
  }, [
    initialMessage,
    initialImages,
    handleSend,
    modelsLoading,
    onInitialMessageConsumed,
  ]);

  const isStreaming = chatState === "streaming";
  const showIndicator =
    chatState === "thinking" ||
    chatState === "streaming" ||
    chatState === "waiting" ||
    chatState === "compacting";

  // Open persona editor
  const handleCreatePersona = useCallback(() => {
    useAgentStore.getState().openPersonaEditor();
  }, []);

  return (
    <ArtifactPolicyProvider
      messages={messages}
      allowedRoots={allowedArtifactRoots}
    >
      <div className="flex h-full flex-col">
        <MessageTimeline
          messages={messages}
          streamingMessageId={streamingMessageId}
          agentName={displayAgentName}
          agentAvatarUrl={personaAvatarSrc ?? agentAvatarUrl}
        />

        {showIndicator && (
          <LoadingGoose
            agentName={displayAgentName}
            chatState={
              chatState as "thinking" | "streaming" | "waiting" | "compacting"
            }
          />
        )}

        <ChatInput
          onSend={handleSend}
          onStop={stopStreaming}
          isStreaming={isStreaming || chatState === "thinking"}
          placeholder={`Message ${displayAgentName}...`}
          // Personas
          personas={personas}
          selectedPersonaId={selectedPersonaId}
          onPersonaChange={handlePersonaChange}
          onCreatePersona={handleCreatePersona}
          // Providers (secondary)
          providers={providers}
          providersLoading={providersLoading}
          selectedProvider={selectedProvider}
          onProviderChange={handleProviderChange}
          currentModel={currentModel}
          currentModelId={session?.currentModelId}
          modelsLoading={modelsLoading}
          availableModels={availableModels}
          onModelChange={handleModelChange}
          selectedProjectId={session?.projectId ?? null}
          availableProjects={availableProjects}
          onProjectChange={handleProjectChange}
          onCreateProject={(options) =>
            onCreateProject?.({
              onCreated: (projectId) => {
                handleProjectChange(projectId);
                options?.onCreated?.(projectId);
              },
            })
          }
          onCreateProjectFromFolder={(options) =>
            onCreateProjectFromFolder?.({
              onCreated: (projectId) => {
                handleProjectChange(projectId);
                options?.onCreated?.(projectId);
              },
            })
          }
          contextTokens={tokenState.accumulatedTotal}
          contextLimit={tokenState.contextLimit}
        />
      </div>
    </ArtifactPolicyProvider>
  );
}
