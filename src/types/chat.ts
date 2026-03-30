// Message content types matching goose-server API
export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

export interface ToolRequestContent {
  type: "toolRequest";
  id: string;
  toolCall: {
    status: "success" | "error";
    value?: { name: string; arguments?: Record<string, unknown> };
    error?: string;
  };
}

export interface ToolResponseContent {
  type: "toolResponse";
  id: string;
  toolResult: {
    status: "success" | "error";
    value?: {
      content: Array<{ type: string; text?: string; [key: string]: unknown }>;
      isError?: boolean;
    };
    error?: string;
  };
}

export interface ThinkingContent {
  type: "thinking";
  thinking: string;
  signature: string;
}

export interface ReasoningContent {
  type: "reasoning";
  text: string;
}

export interface ActionRequiredContent {
  type: "actionRequired";
  data: {
    actionType: "toolConfirmation" | "elicitation";
    id: string;
    toolName?: string;
    arguments?: Record<string, unknown>;
    prompt?: string;
    message?: string;
  };
}

export type MessageContent =
  | TextContent
  | ImageContent
  | ToolRequestContent
  | ToolResponseContent
  | ThinkingContent
  | ReasoningContent
  | ActionRequiredContent;

export type MessageRole = "user" | "assistant";

export interface MessageMetadata {
  userVisible: boolean;
  agentVisible: boolean;
}

export interface Message {
  id: string;
  role: MessageRole;
  created: number;
  content: MessageContent[];
  metadata: MessageMetadata;
}

export type ChatState = "idle" | "thinking" | "streaming" | "waiting" | "error";

export interface TokenState {
  input: number;
  output: number;
  accumulated: { input: number; output: number };
}

export type ToolCallStatus = "pending" | "executing" | "completed" | "error";

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  status: ToolCallStatus;
  error?: string;
}

// Type guards
export function isTextContent(c: MessageContent): c is TextContent {
  return c.type === "text";
}
export function isToolRequestContent(
  c: MessageContent,
): c is ToolRequestContent {
  return c.type === "toolRequest";
}
export function isToolResponseContent(
  c: MessageContent,
): c is ToolResponseContent {
  return c.type === "toolResponse";
}
export function isThinkingContent(c: MessageContent): c is ThinkingContent {
  return c.type === "thinking";
}
export function isReasoningContent(c: MessageContent): c is ReasoningContent {
  return c.type === "reasoning";
}
export function isActionRequiredContent(
  c: MessageContent,
): c is ActionRequiredContent {
  return c.type === "actionRequired";
}

export function getMessageText(content: MessageContent[]): string {
  return content
    .filter(isTextContent)
    .map((c) => c.text)
    .join("\n");
}

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
