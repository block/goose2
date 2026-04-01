import { useState } from "react";
import { Brain, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { MarkdownContent } from "./MarkdownContent";

interface ThinkingBlockProps {
  text: string;
  type: "thinking" | "reasoning";
  defaultExpanded?: boolean;
  isStreaming?: boolean;
  durationSeconds?: number;
}

export function ThinkingBlock({
  text,
  type,
  defaultExpanded = false,
  isStreaming = false,
  durationSeconds,
}: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const label = isStreaming
    ? "Thinking"
    : durationSeconds
      ? `Thought for ${durationSeconds}s`
      : type === "thinking"
        ? "Thinking"
        : "Reasoning";

  return (
    <div className="my-1.5">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
        aria-expanded={expanded}
        aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
      >
        <span
          className={cn(
            "w-5 h-5 rounded-full bg-accent flex-shrink-0 flex items-center justify-center",
            isStreaming && "bg-amber-500/10",
          )}
        >
          <Brain className="w-2.5 h-2.5" />
        </span>
        <span>{label}</span>
        <ChevronRight
          size={12}
          className={cn(
            "shrink-0 transition-transform duration-200 motion-reduce:transition-none",
            expanded && "rotate-90",
          )}
        />
      </button>

      {expanded && (
        <div className="mt-2 ml-[26px] pl-3 border-l-2 border-border text-muted-foreground text-[13px] leading-relaxed italic animate-fade-in max-h-64 overflow-y-auto">
          <MarkdownContent content={text} className="text-[13px]" />
        </div>
      )}
    </div>
  );
}
