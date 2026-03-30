import { useState } from "react";
import { Brain, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/cn";

interface ThinkingBlockProps {
  text: string;
  type: "thinking" | "reasoning";
  defaultExpanded?: boolean;
}

export function ThinkingBlock({
  text,
  type,
  defaultExpanded = false,
}: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const label = type === "thinking" ? "Thinking..." : "Reasoning...";

  return (
    <div className="my-1.5 rounded-md border border-dashed border-border-secondary">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground-tertiary transition-colors hover:text-foreground-secondary"
        aria-expanded={expanded}
        aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
      >
        <Brain size={14} className="shrink-0" />
        <span className="italic">{label}</span>
        <ChevronRight
          size={12}
          className={cn(
            "ml-auto shrink-0 transition-transform duration-200 motion-reduce:transition-none",
            expanded && "rotate-90",
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-dashed border-border-secondary px-3 py-2 text-xs leading-relaxed text-foreground-tertiary">
            <p className="whitespace-pre-wrap">{text}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
