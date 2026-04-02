import { useState } from "react";
import { Brain, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
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
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="h-auto gap-1.5 rounded-md px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
        aria-expanded={expanded}
        aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
      >
        <span
          className={cn(
            "flex size-5 flex-shrink-0 items-center justify-center rounded-full bg-accent",
            isStreaming && "bg-amber-500/10",
          )}
        >
          <Brain className="size-2.5" />
        </span>
        <span>{label}</span>
        <ChevronRight
          className={cn(
            "size-3 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
            expanded && "rotate-90",
          )}
        />
      </Button>

      {expanded && (
        <div className="mt-2 ml-[26px] pl-3 border-l-2 border-border text-muted-foreground text-[13px] leading-relaxed italic animate-fade-in max-h-64 overflow-y-auto">
          <MarkdownContent content={text} className="text-[13px]" />
        </div>
      )}
    </div>
  );
}
