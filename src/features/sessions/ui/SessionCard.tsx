import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  MessageSquare,
  Folder,
  Bot,
  MoreHorizontal,
  Pencil,
  Trash2,
  ArchiveRestore,
} from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";

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
  onRename?: (id: string, nextTitle: string) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
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
  onRename,
  onArchive,
  onUnarchive,
}: SessionCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftTitle(title);
  }, [title]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const startRename = () => {
    setDraftTitle(title);
    setMenuOpen(false);
    setEditing(true);
  };

  const commitRename = () => {
    const nextTitle = draftTitle.trim();
    setEditing(false);
    if (!nextTitle || nextTitle === title) return;
    onRename?.(id, nextTitle);
  };

  const cancelRename = () => {
    setDraftTitle(title);
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2 rounded-lg border border-border bg-background p-4 text-left transition-shadow hover:shadow-card",
        archivedAt && "opacity-60",
      )}
    >
      {/* Click-to-open overlay */}
      <button
        type="button"
        onClick={() => onSelect?.(id)}
        className="absolute inset-0 z-0 rounded-lg"
        aria-label={`Open ${title}`}
      />

      {/* Title — editable or static */}
      {editing ? (
        <Input
          ref={inputRef}
          type="text"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onBlur={commitRename}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitRename();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancelRename();
            }
          }}
          className="relative z-10 text-sm font-medium"
        />
      ) : (
        <p className="text-sm font-medium line-clamp-2 break-words pr-6">
          {title}
        </p>
      )}

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
      </div>

      {/* Actions menu */}
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Options for ${title}`}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "absolute right-2 top-2 z-10 size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50",
              menuOpen
                ? "visible opacity-100"
                : "invisible group-hover:visible opacity-0 group-hover:opacity-100",
            )}
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4}>
          {archivedAt ? (
            <DropdownMenuItem
              onClick={() => {
                setMenuOpen(false);
                onUnarchive?.(id);
              }}
            >
              <ArchiveRestore className="size-3.5" />
              Restore
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onClick={startRename}>
                <Pencil className="size-3.5" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setMenuOpen(false);
                  onArchive?.(id);
                }}
              >
                <Trash2 className="size-3.5" />
                Archive
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
