import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  IconLayoutSidebarRight,
  IconLayoutSidebarRightFilled,
} from "@tabler/icons-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MessageTimeline } from "./MessageTimeline";
import { ChatInput } from "./ChatInput";
import type { PastedImage } from "@/shared/types/messages";
import { LoadingGoose } from "./LoadingGoose";
import { ContextPanel } from "./ContextPanel";
import { useChat } from "../hooks/useChat";
import { useChatStore } from "../stores/chatStore";
import { useAgentStore } from "@/features/agents/stores/agentStore";
import { useProviderSelection } from "@/features/agents/hooks/useProviderSelection";
import { useChatSessionStore } from "../stores/chatSessionStore";
import { getProject, type ProjectInfo } from "@/features/projects/api/projects";
import { useProjectStore } from "@/features/projects/stores/projectStore";
import {
  buildProjectSystemPrompt,
  composeSystemPrompt,
  getProjectFolderOption,
} from "@/features/projects/lib/chatProjectContext";
import { useAvatarSrc } from "@/shared/hooks/useAvatarSrc";
import { getHomeDir } from "@/shared/api/system";
import { Button } from "@/shared/ui/button";
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
}

const CONTEXT_PANEL_WIDTH = 340;
const CONTEXT_PANEL_SHELL_PADDING = 12;
const CONTEXT_PANEL_HEADER_PADDING_X = 12;
const CONTEXT_PANEL_HEADER_PADDING_TOP = 10;
const CONTEXT_PANEL_TOTAL_WIDTH =
  CONTEXT_PANEL_WIDTH + CONTEXT_PANEL_SHELL_PADDING * 2;
const CONTEXT_PANEL_TOGGLE_RIGHT =
  CONTEXT_PANEL_SHELL_PADDING + CONTEXT_PANEL_HEADER_PADDING_X;
const CONTEXT_PANEL_TOGGLE_TOP =
  CONTEXT_PANEL_SHELL_PADDING + CONTEXT_PANEL_HEADER_PADDING_TOP;
const CONTEXT_PANEL_FADE_DURATION_SECONDS = 0.15;
const CONTEXT_PANEL_REFLOW_DURATION_MS = 200;

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
}: ChatViewProps) {
  const [activeSessionId] = useState(() => sessionId ?? crypto.randomUUID());
  const isContextPanelOpen = useChatSessionStore(
    (s) => s.contextPanelOpenBySession[activeSessionId] ?? false,
  );
  const setContextPanelOpen = useChatSessionStore((s) => s.setContextPanelOpen);
  const shouldReduceMotion = useReducedMotion();
  const fadeTransition = {
    duration: shouldReduceMotion ? 0 : CONTEXT_PANEL_FADE_DURATION_SECONDS,
  };
  const reflowDuration = shouldReduceMotion
    ? 0
    : CONTEXT_PANEL_REFLOW_DURATION_MS;

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

      setGlobalSelectedProvider(providerId);
      useChatSessionStore
        .getState()
        .updateSession(activeSessionId, { providerId });
    },
    [activeSessionId, selectedProvider, setGlobalSelectedProvider],
  );

  const handleProjectChange = useCallback(
    (projectId: string | null) => {
      useChatSessionStore
        .getState()
        .updateSession(activeSessionId, { projectId });
    },
    [activeSessionId],
  );

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
      !initialMessageSent.current
    ) {
      initialMessageSent.current = true;
      handleSend(initialMessage ?? "", undefined, initialImages);
      onInitialMessageConsumed?.();
    }
  }, [initialMessage, initialImages, handleSend, onInitialMessageConsumed]);

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
      <div className="relative flex h-full min-w-0">
        <div className="flex min-w-0 flex-1 flex-col">
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
            personas={personas}
            selectedPersonaId={selectedPersonaId}
            onPersonaChange={handlePersonaChange}
            onCreatePersona={handleCreatePersona}
            providers={providers}
            providersLoading={providersLoading}
            selectedProvider={selectedProvider}
            onProviderChange={handleProviderChange}
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
            contextTokens={tokenState.accumulatedTotal}
            contextLimit={tokenState.contextLimit}
          />
        </div>

        <div
          className="shrink-0 overflow-hidden"
          style={{
            width: isContextPanelOpen ? CONTEXT_PANEL_TOTAL_WIDTH : 0,
            transition: `width ${reflowDuration}ms ease`,
          }}
        >
          <AnimatePresence initial={false}>
            {isContextPanelOpen ? (
              <motion.div
                key="context-panel"
                className="flex h-full"
                style={{
                  width: CONTEXT_PANEL_TOTAL_WIDTH,
                  padding: CONTEXT_PANEL_SHELL_PADDING,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fadeTransition}
              >
                <aside className="flex min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-background">
                  <ContextPanel
                    projectName={project?.name}
                    projectColor={project?.color}
                    projectWorkingDir={project?.workingDirs[0] ?? null}
                  />
                </aside>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div
          className="absolute z-20"
          style={{
            right: CONTEXT_PANEL_TOGGLE_RIGHT,
            top: CONTEXT_PANEL_TOGGLE_TOP,
          }}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() =>
              setContextPanelOpen(activeSessionId, !isContextPanelOpen)
            }
            aria-label={
              isContextPanelOpen ? "Close context panel" : "Open context panel"
            }
            title={
              isContextPanelOpen ? "Close context panel" : "Open context panel"
            }
          >
            {isContextPanelOpen ? (
              <IconLayoutSidebarRightFilled className="size-4" />
            ) : (
              <IconLayoutSidebarRight className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </ArtifactPolicyProvider>
  );
}
