import { cn } from "@/shared/lib/cn";

interface StreamingIndicatorProps {
  agentName?: string;
  state?: "thinking" | "streaming" | "compacting";
  className?: string;
}

export function StreamingIndicator({
  agentName = "Goose",
  state = "thinking",
  className,
}: StreamingIndicatorProps) {
  const labels: Record<string, string> = {
    thinking: "is thinking",
    streaming: "is generating",
    compacting: "is compacting context",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-4 py-2 animate-in fade-in duration-300 motion-reduce:animate-none",
        className,
      )}
      role="status"
      aria-label={`${agentName} ${labels[state] ?? "is thinking"}`}
    >
      <div className="flex gap-1" aria-hidden="true">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full bg-accent",
            "animate-bounce motion-reduce:animate-none [animation-delay:0ms]",
          )}
        />
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full bg-accent",
            "animate-bounce motion-reduce:animate-none [animation-delay:150ms]",
          )}
        />
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full bg-accent",
            "animate-bounce motion-reduce:animate-none [animation-delay:300ms]",
          )}
        />
      </div>
      <span className="text-xs text-foreground-tertiary">
        {agentName} {labels[state] ?? "is thinking"}...
      </span>
    </div>
  );
}
