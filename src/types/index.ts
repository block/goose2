export * from "./chat";

// Session
export interface Session {
  id: string;
  name: string;
  working_directory: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  metadata: Record<string, unknown>;
}

// Agent config
export type AgentConfigSource = "user" | "project";

export interface AgentConfigData {
  name: string;
  description?: string;
  model?: string;
  provider?: string;
  mcps?: string[];
  skills?: string[];
  instructions: string;
}

export interface AgentConfig {
  id: string;
  agent: AgentConfigData;
  file_path: string;
  source: AgentConfigSource;
  last_modified: string;
}

// Skill
export type SkillSource = "user" | "project";

export interface Skill {
  id: string;
  name: string;
  description: string;
  source: SkillSource;
  path: string;
  content: string;
}

// Provider
export interface Provider {
  id: string;
  name: string;
  description: string;
  models: Model[];
  configured: boolean;
}

export interface Model {
  id: string;
  name: string;
  provider: string;
}
