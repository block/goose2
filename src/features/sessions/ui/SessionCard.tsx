import { Calendar, MessageSquare, Folder, Bot } from "lucide-react";
import { cn } from "@/shared/lib/cn";

function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface SessionCardProps {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  personaName?: string;
  projectName?: string;
  projectColor?: string;
  workingDir?: string;
  archivedAt?: string;
  onSelect?: (id: string) => void;
}

export function SessionCard({
  id,
  title,
  updatedAt,
  messageCount,
  personaName,
  projectName,
  projectColor,
  workingDir,
  archivedAt,
  onSelect,
}: SessionCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(id)}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-background p-4 text-left transition-shadow hover:shadow-card",
        archivedAt && "opacity-60",
      )}
    >
      <p className="text-sm font-medium line-clamp-2 break-words">{title}</p>

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Calendar className="size-3 shrink-0" />
          <span>{formatRelativeDate(updatedAt)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <MessageSquare className="size-3 shrink-0" />
          <span>{messageCount}</span>
        </div>

        {personaName && (
          <div className="flex items-center gap-1.5">
            <Bot className="size-3 shrink-0" />
            <span className="truncate">{personaName}</span>
          </div>
        )}

        {projectName && (
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block size-2 shrink-0 rounded-full"
              style={
                projectColor ? { backgroundColor: projectColor } : undefined
              }
            />
            <span className="truncate">{projectName}</span>
          </div>
        )}

        {workingDir && (
          <div className="flex items-center gap-1.5">
            <Folder className="size-3 shrink-0" />
            <span className="truncate">{workingDir}</span>
          </div>
        )}

        {archivedAt && (
          <span className="text-muted-foreground text-xs">Archived</span>
        )}
      </div>
    </button>
  );
}
