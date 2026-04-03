import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { ToolCallAdapter } from "./ToolCallAdapter";
import {
  getToolType,
  getToolVerb,
  extractFileDetail,
  getToolLabel,
} from "../lib/toolLabelUtils";
import type {
  ToolRequestContent,
  ToolResponseContent,
} from "@/shared/types/messages";

export interface ToolChainItem {
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

interface ToolGroup {
  type: string | undefined;
  items: ToolChainItem[];
}

function groupByConsecutiveType(items: ToolChainItem[]): ToolGroup[] {
  if (items.length === 0) return [];

  const groups: ToolGroup[] = [];
  let currentType = getToolType(getToolItemName(items[0]));
  let currentItems: ToolChainItem[] = [items[0]];

  for (let i = 1; i < items.length; i++) {
    const itemType = getToolType(getToolItemName(items[i]));
    if (itemType !== undefined && itemType === currentType) {
      currentItems.push(items[i]);
    } else {
      groups.push({ type: currentType, items: currentItems });
      currentType = itemType;
      currentItems = [items[i]];
    }
  }
  groups.push({ type: currentType, items: currentItems });

  return groups;
}

function ToolGroupRow({
  group,
  renderToolItem,
}: {
  group: ToolGroup;
  renderToolItem: (item: ToolChainItem, flat: boolean) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const label = getToolLabel(group.type, group.items.length);

  return (
    <div className="w-full flex flex-col">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="inline-flex items-center gap-1 py-px font-medium text-sm"
      >
        <span className={cn(!expanded && "text-muted-foreground")}>
          {label}
        </span>
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            expanded && "rotate-90",
          )}
        />
      </button>
      {expanded && (
        <div className="ml-[7px] mt-1 flex flex-col gap-3 border-l border-border py-3 pl-4 animate-in slide-in-from-top-2 fade-in-0 duration-200">
          {group.items.map((item) => renderToolItem(item, true))}
        </div>
      )}
    </div>
  );
}

export function ToolChainCards({ toolItems }: { toolItems: ToolChainItem[] }) {
  const [showInternalSteps, setShowInternalSteps] = useState(false);
  const { primaryItems, hiddenItems } = partitionToolSteps(toolItems);

  const renderToolItem = (item: ToolChainItem, flat = false) => {
    const name = getToolItemName(item);
    const status = getToolItemStatus(item);
    const { request, response } = item;

    const type = getToolType(name);
    const detail = extractFileDetail(
      name,
      request?.arguments,
      response?.result,
    );
    const displayLabel =
      flat && detail ? detail : getToolLabel(type, 1, detail, name);

    return (
      <ToolCallAdapter
        key={item.key}
        name={name}
        arguments={request?.arguments ?? {}}
        status={status}
        result={response?.result}
        isError={response?.isError}
        displayLabel={displayLabel}
        displayVerb={getToolVerb(type)}
        displayDetail={detail}
        flat={flat}
      />
    );
  };

  const groups = groupByConsecutiveType(primaryItems);

  return (
    <div className="w-full flex flex-col gap-3">
      {groups.flatMap((group) => {
        if (group.items.length > 1 && group.type !== undefined) {
          const groupKey = group.items.map((i) => i.key).join(":");
          return (
            <ToolGroupRow
              key={groupKey}
              group={group}
              renderToolItem={renderToolItem}
            />
          );
        }
        return group.items.map((item) => renderToolItem(item));
      })}

      {hiddenItems.length > 0 && (
        <div className="ml-1 flex flex-col gap-1.5">
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
