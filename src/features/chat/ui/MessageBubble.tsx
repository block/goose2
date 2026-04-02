import { useState } from "react";
import { Copy, Check, RotateCcw, Pencil, Bot, User } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { ToolCallCard } from "./ToolCallCard";
import { ThinkingBlock } from "./ThinkingBlock";
import { MarkdownContent } from "./MarkdownContent";
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
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={handleCopy}
      className="size-6 rounded-md text-muted-foreground opacity-0 transition-opacity duration-150 hover:text-foreground group-hover:opacity-100"
      aria-label={copied ? "Copied" : "Copy message"}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

interface ContentSection {
  key: string;
  type: "single" | "toolChain";
  items: MessageContent[] | ToolChainItem[];
}

interface ToolChainItem {
  key: string;
  request?: ToolRequestContent;
  response?: ToolResponseContent;
}

function findMatchingToolChainIndex(
  items: ToolChainItem[],
  response: ToolResponseContent,
): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (!item.request || item.response) {
      continue;
    }
    if (item.request.id === response.id) {
      return index;
    }
  }

  if (!response.name) {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (item.request && !item.response) {
        return index;
      }
    }
  }

  return -1;
}

function groupContentSections(content: MessageContent[]): ContentSection[] {
  const sections: ContentSection[] = [];
  let currentToolChain: ToolChainItem[] = [];

  const flushToolChain = () => {
    if (currentToolChain.length > 0) {
      sections.push({
        key: currentToolChain.map((item) => item.key).join(":"),
        type: "toolChain",
        items: [...currentToolChain],
      });
      currentToolChain = [];
    }
  };

  for (const [index, block] of content.entries()) {
    if (block.type === "toolRequest") {
      currentToolChain.push({
        key: `tool-request-${block.id}-${index}`,
        request: block,
      });
      continue;
    }

    if (block.type === "toolResponse") {
      const matchingIndex = findMatchingToolChainIndex(currentToolChain, block);
      if (matchingIndex !== -1) {
        const requestName = currentToolChain[matchingIndex].request?.name ?? "";
        currentToolChain[matchingIndex] = {
          ...currentToolChain[matchingIndex],
          response: {
            ...block,
            name: block.name || requestName,
          },
        };
        continue;
      }
      currentToolChain.push({
        key: `tool-response-${block.id}-${index}`,
        response: block,
      });
      continue;
    }

    flushToolChain();
    sections.push({
      key: `${block.type}-${"id" in block ? String(block.id) : index}`,
      type: "single",
      items: [block],
    });
  }

  flushToolChain();

  return sections;
}

function renderContentBlock(content: MessageContent, index: number) {
  switch (content.type) {
    case "text": {
      const tc = content as TextContent;
      return (
        <MarkdownContent
          key={`text-${index}`}
          content={tc.text}
          className="text-sm leading-relaxed"
        />
      );
    }
    case "toolRequest":
    case "toolResponse":
      // Handled by groupContentSections toolChain rendering
      return null;
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
          className="text-xs italic text-muted-foreground"
        >
          (thinking redacted)
        </div>
      );
    case "systemNotification": {
      const sn = content as SystemNotificationContent;
      return (
        <div
          key={`notification-${index}`}
          className="rounded-md bg-accent p-2 text-xs text-muted-foreground"
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
        <div className="max-w-md rounded-full bg-accent px-3 py-1 text-center text-xs text-muted-foreground">
          {content.map((c, i) => renderContentBlock(c, i))}
        </div>
      </div>
    );
  }

  const isUser = role === "user";
  const assistantDisplayName = message.metadata?.personaName ?? agentName;

  return (
    <div
      className={cn(
        "group flex gap-3 px-4 py-1",
        "animate-in fade-in duration-200 motion-reduce:animate-none",
        isUser ? "flex-row-reverse ml-auto" : "flex-row",
      )}
      data-role={isUser ? "user-message" : "assistant-message"}
    >
      {/* Avatar */}
      {isUser ? (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent">
          <User size={14} className="text-muted-foreground" />
        </div>
      ) : (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent">
          {agentAvatarUrl ? (
            <img src={agentAvatarUrl} alt="" className="h-7 w-7 rounded-full" />
          ) : (
            <Bot size={14} className="text-muted-foreground" />
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
        {!isUser && assistantDisplayName && (
          <span className="mb-0.5 text-xs font-medium text-muted-foreground">
            {assistantDisplayName}
          </span>
        )}

        <div className="text-[13px] leading-relaxed">
          {groupContentSections(content).map((section, sectionIdx) => {
            if (section.type === "toolChain") {
              const toolItems = section.items as ToolChainItem[];
              return (
                <div
                  key={section.key}
                  className="my-1 flex flex-col items-start gap-1.5"
                >
                  {toolItems.map((item) => {
                    const { request, response } = item;
                    return (
                      <ToolCallCard
                        key={item.key}
                        name={request?.name || response?.name || "Tool result"}
                        arguments={request?.arguments ?? {}}
                        status={
                          response
                            ? response.isError
                              ? "error"
                              : "completed"
                            : (request?.status ?? "completed")
                        }
                        result={response?.result}
                        isError={response?.isError}
                      />
                    );
                  })}
                </div>
              );
            }
            const block = section.items[0] as MessageContent;
            return (
              <div key={`${message.id}-${section.key}`}>
                {renderContentBlock(block, sectionIdx)}
              </div>
            );
          })}
          {isStreaming && (
            <span
              className="inline-block animate-pulse text-muted-foreground"
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
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onRetry}
              className="size-6 rounded-md text-muted-foreground hover:text-foreground"
              aria-label="Retry"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          )}
          {isUser && onEdit && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onEdit}
              className="size-6 rounded-md text-muted-foreground hover:text-foreground"
              aria-label="Edit message"
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
          <span className="px-1 text-[10px] text-muted-foreground">
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
