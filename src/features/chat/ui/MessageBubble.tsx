import { useState } from "react";
import {
  Copy,
  Check,
  RotateCcw,
  Pencil,
  Bot,
  User,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { ToolCallCard } from "./ToolCallCard";
import { ThinkingBlock } from "./ThinkingBlock";
import { MarkdownContent } from "./MarkdownContent";
import type {
  Message,
  MessageContent,
  TextContent,
  ImageContent,
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

const INTERNAL_TOOL_PREFIXES = new Set([
  "awk",
  "bash",
  "cat",
  "chmod",
  "cp",
  "echo",
  "find",
  "grep",
  "head",
  "ls",
  "mv",
  "open",
  "pip",
  "pip3",
  "python",
  "python3",
  "rm",
  "sed",
  "sh",
  "tail",
  "wc",
  "which",
  "zsh",
]);

function getToolItemName(item: ToolChainItem): string {
  return item.request?.name || item.response?.name || "Tool result";
}

function getToolItemStatus(item: ToolChainItem) {
  if (item.response) {
    return item.response.isError ? "error" : "completed";
  }
  return item.request?.status ?? "completed";
}

function isLowSignalToolStep(item: ToolChainItem): boolean {
  if (getToolItemStatus(item) !== "completed") {
    return false;
  }
  if (item.response?.isError) {
    return false;
  }

  const name = getToolItemName(item).trim();
  if (!name) return false;

  const lower = name.toLowerCase();
  const firstToken = lower.split(/\s+/)[0];
  if (INTERNAL_TOOL_PREFIXES.has(firstToken)) {
    return true;
  }
  if (name.length > 88) {
    return true;
  }
  return (
    lower.includes("&&") ||
    lower.includes("||") ||
    lower.includes("2>&1") ||
    lower.includes("|")
  );
}

function partitionToolSteps(toolItems: ToolChainItem[]) {
  if (toolItems.length <= 3) {
    return { primaryItems: toolItems, hiddenItems: [] as ToolChainItem[] };
  }

  const primaryItems: ToolChainItem[] = [];
  const hiddenItems: ToolChainItem[] = [];

  for (const item of toolItems) {
    if (isLowSignalToolStep(item)) {
      hiddenItems.push(item);
      continue;
    }
    primaryItems.push(item);
  }

  if (primaryItems.length === 0) {
    return { primaryItems: toolItems, hiddenItems: [] as ToolChainItem[] };
  }

  if (hiddenItems.length < 2) {
    return { primaryItems: toolItems, hiddenItems: [] as ToolChainItem[] };
  }

  return { primaryItems, hiddenItems };
}

function ToolChainCards({ toolItems }: { toolItems: ToolChainItem[] }) {
  const [showInternalSteps, setShowInternalSteps] = useState(false);
  const { primaryItems, hiddenItems } = partitionToolSteps(toolItems);

  const renderToolItem = (
    item: ToolChainItem,
    options?: { variant?: "default" | "subtle"; expandable?: boolean },
  ) => {
    const name = getToolItemName(item);
    const status = getToolItemStatus(item);
    const { request, response } = item;

    return (
      <ToolCallCard
        key={item.key}
        name={name}
        arguments={request?.arguments ?? {}}
        status={status}
        result={response?.result}
        isError={response?.isError}
        variant={options?.variant}
        expandable={options?.expandable}
      />
    );
  };

  return (
    <div className="my-1 flex flex-col items-start gap-1.5">
      {primaryItems.map((item) => renderToolItem(item))}

      {hiddenItems.length > 0 && (
        <div className="ml-1 flex flex-col items-start gap-1.5">
          <button
            type="button"
            onClick={() => setShowInternalSteps((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xs text-foreground-tertiary hover:text-foreground-secondary"
          >
            <ChevronRight
              className={cn(
                "h-3 w-3 transition-transform",
                showInternalSteps && "rotate-90",
              )}
            />
            {showInternalSteps
              ? `Hide internal steps (${hiddenItems.length})`
              : `Show internal steps (${hiddenItems.length})`}
          </button>

          {showInternalSteps &&
            hiddenItems.map((item) =>
              renderToolItem(item, { variant: "subtle", expandable: false }),
            )}
        </div>
      )}
    </div>
  );
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
    case "image": {
      const ic = content as ImageContent;
      const src =
        ic.source.type === "base64"
          ? `data:${ic.source.mediaType};base64,${ic.source.data}`
          : ic.source.url;
      return (
        <img
          key={`image-${index}`}
          src={src}
          alt="Attached"
          className="max-h-48 max-w-xs rounded-lg object-contain"
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
        {!isUser && assistantDisplayName && (
          <span className="mb-0.5 text-xs font-medium text-foreground-secondary">
            {assistantDisplayName}
          </span>
        )}

        <div className="text-[13px] leading-relaxed">
          {groupContentSections(content).map((section, sectionIdx) => {
            if (section.type === "toolChain") {
              const toolItems = section.items as ToolChainItem[];
              return <ToolChainCards key={section.key} toolItems={toolItems} />;
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
