import { cn } from "@/shared/lib/cn";

interface StatusBarProps {
  modelName?: string;
  tokenCount?: number;
  status?: "connected" | "disconnected" | "loading";
}

const statusColor = {
  connected: "bg-green-500",
  disconnected: "bg-red-500",
  loading: "bg-yellow-500",
} as const;

export function StatusBar({
  modelName = "Claude Sonnet 4",
  tokenCount = 0,
  status = "disconnected",
}: StatusBarProps) {
  return (
    <div
      className={cn(
        "flex h-6 w-full items-center justify-between border-t border-border",
        "bg-background/80 px-3 text-xs text-foreground-secondary",
      )}
    >
      <span>{modelName}</span>

      <div className="flex items-center gap-2">
        <span>{tokenCount.toLocaleString()} tokens</span>
        <div
          role="status"
          aria-label={status}
          className={cn("h-1.5 w-1.5 rounded-full", statusColor[status])}
        />
      </div>
    </div>
  );
}
