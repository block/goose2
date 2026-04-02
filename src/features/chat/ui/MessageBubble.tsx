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
import {
  MessageActions,
  MessageAction,
  MessageResponse,
} from "@/shared/ui/ai-elements/message";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/shared/ui/ai-elements/reasoning";
import { ToolCallAdapter } from "./ToolCallAdapter";
import { ClickableImage } from "./ClickableImage";
import type {
  Message,
  MessageContent,
  TextContent,
  ImageContent,
  ToolRequestContent,
  ToolResponseContent,
  ThinkingContent,
  ReasoningContent as ReasoningContentType,
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

  const renderToolItem = (item: ToolChainItem) => {
    const name = getToolItemName(item);
    const status = getToolItemStatus(item);
    const { request, response } = item;

    return (
      <ToolCallAdapter
        key={item.key}
        name={name}
        arguments={request?.arguments ?? {}}
        status={status}
        result={response?.result}
        isError={response?.isError}
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

          {showInternalSteps && hiddenItems.map((item) => renderToolItem(item))}
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

function renderContentBlock(
  content: MessageContent,
  index: number,
  isStreamingMsg?: boolean,
) {
  switch (content.type) {
    case "text": {
      const tc = content as TextContent;
      return (
        <MessageResponse key={`text-${index}`} isAnimating={isStreamingMsg}>
          {tc.text}
        </MessageResponse>
      );
    }
    case "image": {
      const ic = content as ImageContent;
      const src =
        ic.source.type === "base64"
          ? `data:${ic.source.mediaType};base64,${ic.source.data}`
          : ic.source.url;
      return <ClickableImage key={`image-${index}`} src={src} alt="Attached" />;
    }
    case "toolRequest":
    case "toolResponse":
      // Handled by groupContentSections toolChain rendering
      return null;
    case "thinking": {
      const th = content as ThinkingContent;
      return (
        <Reasoning
          key={`thinking-${index}`}
          isStreaming={isStreamingMsg}
          defaultOpen={false}
        >
          <ReasoningTrigger />
          <ReasoningContent>{th.text}</ReasoningContent>
        </Reasoning>
      );
    }
    case "reasoning": {
      const r = content as ReasoningContentType;
      return (
        <Reasoning
          key={`reasoning-${index}`}
          isStreaming={isStreamingMsg}
          defaultOpen={false}
        >
          <ReasoningTrigger />
          <ReasoningContent>{r.text}</ReasoningContent>
        </Reasoning>
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

function CopyAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <MessageAction tooltip={copied ? "Copied" : "Copy"} onClick={handleCopy}>
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </MessageAction>
  );
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
          "min-w-0 flex flex-col gap-1",
          isUser ? "max-w-[80%] items-end" : "max-w-[85%] items-start",
        )}
      >
        {!isUser && assistantDisplayName && (
          <span className="mb-0.5 text-xs font-medium text-muted-foreground">
            {assistantDisplayName}
          </span>
        )}

        <div className="w-full min-w-0 text-[13px] leading-relaxed">
          {groupContentSections(content).map((section, sectionIdx) => {
            if (section.type === "toolChain") {
              const toolItems = section.items as ToolChainItem[];
              return <ToolChainCards key={section.key} toolItems={toolItems} />;
            }
            const block = section.items[0] as MessageContent;
            return (
              <div key={`${message.id}-${section.key}`}>
                {renderContentBlock(block, sectionIdx, isStreaming)}
              </div>
            );
          })}
        </div>

        {/* Hover actions + timestamp */}
        <MessageActions className="opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {textContent && <CopyAction text={textContent} />}
          {!isUser && onRetry && (
            <MessageAction tooltip="Retry" onClick={onRetry}>
              <RotateCcw className="size-3.5" />
            </MessageAction>
          )}
          {isUser && onEdit && (
            <MessageAction tooltip="Edit" onClick={onEdit}>
              <Pencil className="size-3.5" />
            </MessageAction>
          )}
          <span className="px-1 text-[10px] text-muted-foreground">
            {new Date(created).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </MessageActions>
      </div>
    </div>
  );
}
