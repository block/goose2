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

// Session, TokenState, ChatState, and MessageEventType are defined in ./chat.ts
