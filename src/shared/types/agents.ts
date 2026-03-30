// Provider types
export type ProviderType = "goose" | "claude" | "openai" | "ollama" | "custom";

export interface ProviderConfig {
  type: ProviderType;
  name: string;
  description?: string;
  models: ModelInfo[];
  requiresApiKey: boolean;
  apiKeyEnvVar?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsThinking: boolean;
}

// Persona types (from sprout)
export interface Persona {
  id: string;
  displayName: string;
  avatarUrl?: string;
  systemPrompt: string;
  provider?: ProviderType;
  model?: string;
  isBuiltin: boolean;
  isFromDisk?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonaRequest {
  displayName: string;
  avatarUrl?: string;
  systemPrompt: string;
  provider?: ProviderType;
  model?: string;
}

export interface UpdatePersonaRequest {
  displayName?: string;
  avatarUrl?: string;
  systemPrompt?: string;
  provider?: ProviderType;
  model?: string;
}

// Agent types
export type AgentStatus = "online" | "offline" | "starting" | "error";
export type AgentConnectionType = "builtin" | "acp";

export interface Agent {
  id: string;
  name: string;
  personaId?: string;
  persona?: Persona;
  provider: ProviderType;
  model: string;
  systemPrompt?: string;
  connectionType: AgentConnectionType;
  status: AgentStatus;
  isBuiltin: boolean;
  acpEndpoint?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentRequest {
  name: string;
  personaId?: string;
  provider: ProviderType;
  model: string;
  systemPrompt?: string;
  connectionType: AgentConnectionType;
  acpEndpoint?: string;
}

// Session types
export interface Session {
  id: string;
  title: string;
  agentId?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessagePreview?: string;
}

// Token tracking
export interface TokenState {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  accumulatedInput: number;
  accumulatedOutput: number;
  accumulatedTotal: number;
}

// Chat state
export type ChatState =
  | "idle"
  | "thinking"
  | "streaming"
  | "waiting"
  | "compacting"
  | "error";

// SSE event types (from goosed server)
export type MessageEventType =
  | "message"
  | "error"
  | "finish"
  | "modelChange"
  | "notification"
  | "updateConversation"
  | "ping";

export interface MessageEvent {
  type: MessageEventType;
  data: unknown;
}
