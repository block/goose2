import { useState } from "react";
import { Copy, Check, RotateCcw, Pencil, Bot, User } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { ToolCallCard } from "./ToolCallCard";
import { ThinkingBlock } from "./ThinkingBlock";
import type {
  Message,
  MessageContent,
  TextContent,
  ToolRequestContent,
  ToolResponseContent,
  ThinkingContent,
  ReasoningContent,
  SystemNotificationContent,
} from "@/shared/types/messages";

interface MessageBubbleProps {
  message: Message;
  agentName?: string;
  agentAvatarUrl?: string;
  isStreaming?: boolean;
  onCopy?: () => void;
  onRetry?: () => void;
  onEdit?: () => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded p-1 text-foreground-tertiary opacity-0 transition-opacity duration-150 hover:text-foreground-primary group-hover:opacity-100"
      aria-label={copied ? "Copied" : "Copy message"}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function renderContentBlock(content: MessageContent, index: number) {
  switch (content.type) {
    case "text": {
      const tc = content as TextContent;
      return (
        <div
          key={`text-${index}`}
          className="prose whitespace-pre-wrap break-words text-sm leading-relaxed"
        >
          {tc.text}
        </div>
      );
    }
    case "toolRequest": {
      const tr = content as ToolRequestContent;
      return (
        <ToolCallCard
          key={`tool-${tr.id}`}
          name={tr.name}
          arguments={tr.arguments}
          status={tr.status}
        />
      );
    }
    case "toolResponse": {
      const resp = content as ToolResponseContent;
      return (
        <ToolCallCard
          key={`toolresp-${resp.id}`}
          name={resp.name}
          arguments={{}}
          status={resp.isError ? "error" : "completed"}
          result={resp.result}
          isError={resp.isError}
        />
      );
    }
    case "thinking": {
      const th = content as ThinkingContent;
      return (
        <ThinkingBlock
          key={`thinking-${index}`}
          text={th.text}
          type="thinking"
        />
      );
    }
    case "reasoning": {
      const r = content as ReasoningContent;
      return (
        <ThinkingBlock
          key={`reasoning-${index}`}
          text={r.text}
          type="reasoning"
        />
      );
    }
    case "redactedThinking":
      return (
        <div
          key={`redacted-${index}`}
          className="text-xs italic text-foreground-tertiary"
        >
          (thinking redacted)
        </div>
      );
    case "systemNotification": {
      const sn = content as SystemNotificationContent;
      return (
        <div
          key={`notification-${index}`}
          className="rounded-md bg-background-tertiary p-2 text-xs text-foreground-secondary"
        >
          {sn.text}
        </div>
      );
    }
    default:
      return null;
  }
}

export function MessageBubble({
  message,
  agentName,
  agentAvatarUrl,
  isStreaming,
  onRetry,
  onEdit,
}: MessageBubbleProps) {
  const { role, content, created } = message;

  const textContent = content
    .filter((c): c is TextContent => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  // System messages: centered, muted
  if (role === "system") {
    return (
      <div className="flex justify-center px-4 py-2">
        <div className="max-w-md rounded-full bg-background-tertiary px-3 py-1 text-center text-xs text-foreground-tertiary">
          {content.map((c, i) => renderContentBlock(c, i))}
        </div>
      </div>
    );
  }

  const isUser = role === "user";

  return (
    <div
      className={cn(
        "group flex gap-3 px-4 py-3",
        "animate-in fade-in duration-200 motion-reduce:animate-none",
        isUser ? "flex-row-reverse ml-auto" : "flex-row",
      )}
      data-role={isUser ? "user-message" : "assistant-message"}
    >
      {/* Avatar */}
      {isUser ? (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background-tertiary">
          <User size={14} className="text-foreground-secondary" />
        </div>
      ) : (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background-tertiary">
          {agentAvatarUrl ? (
            <img src={agentAvatarUrl} alt="" className="h-7 w-7 rounded-full" />
          ) : (
            <Bot size={14} className="text-foreground-secondary" />
          )}
        </div>
      )}

      {/* Message content */}
      <div
        className={cn(
          "flex flex-col gap-1",
          isUser ? "max-w-[80%] items-end" : "max-w-[85%] items-start",
        )}
      >
        {/* Agent name */}
        {!isUser && agentName && (
          <span className="mb-0.5 text-xs font-medium text-foreground-secondary">
            {agentName}
          </span>
        )}

        <div
          className={cn(
            "text-[13px] leading-relaxed",
            isUser ? "text-foreground-primary" : "text-foreground-secondary",
          )}
        >
          {content.map((c, i) => {
            const key = `${c.type}-${message.id}-${"id" in c ? (c as unknown as Record<string, unknown>).id : i}`;
            return <div key={key}>{renderContentBlock(c, i)}</div>;
          })}
          {isStreaming && (
            <span
              className="inline-block animate-pulse text-foreground-tertiary"
              aria-hidden="true"
            >
              ▍
            </span>
          )}
        </div>

        {/* Hover actions + timestamp */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {textContent && <CopyButton text={textContent} />}
          {!isUser && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded p-1 text-foreground-tertiary hover:text-foreground-primary"
              aria-label="Retry"
            >
              <RotateCcw size={14} />
            </button>
          )}
          {isUser && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded p-1 text-foreground-tertiary hover:text-foreground-primary"
              aria-label="Edit message"
            >
              <Pencil size={14} />
            </button>
          )}
          <span className="px-1 text-[10px] text-foreground-secondary">
            {new Date(created).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
