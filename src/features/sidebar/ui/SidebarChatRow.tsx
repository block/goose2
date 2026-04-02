import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { SessionActivityIndicator } from "@/shared/ui/SessionActivityIndicator";

const INACTIVE_CHAT_ROW_CLASS = "text-foreground group-hover:text-foreground";
const ACTIVE_CHAT_ROW_CLASS = "bg-accent text-foreground";

interface SidebarChatRowProps {
  id: string;
  title: string;
  isActive: boolean;
  isRunning?: boolean;
  hasUnread?: boolean;
  className?: string;
  onSelect?: (id: string) => void;
  onRename?: (id: string, nextTitle: string) => void;
  onArchive?: (id: string) => void;
}

export function SidebarChatRow({
  id,
  title,
  isActive,
  isRunning = false,
  hasUnread = false,
  className,
  onSelect,
  onRename,
  onArchive,
}: SidebarChatRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

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

  const cancelRename = () => {
    setDraftTitle(title);
    setEditing(false);
  };

  const commitRename = () => {
    const nextTitle = draftTitle.trim();
    setEditing(false);
    if (!nextTitle || nextTitle === title) return;
    onRename?.(id, nextTitle);
  };

  if (editing) {
    return (
      <div className={cn("flex items-center group rounded-md", className)}>
        <div className="flex items-center flex-1 min-w-0 py-1.5 rounded-md text-[13px] px-2.5">
          <input
            ref={inputRef}
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitRename}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
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
            className="w-full min-w-0 h-6 px-1.5 rounded border border-border bg-background text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center group rounded-md transition-colors duration-150",
        isActive ? "bg-accent" : "hover:bg-accent",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSelect?.(id)}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          startRename();
        }}
        title="Double-click to rename"
        className={cn(
          "flex items-center gap-2 flex-1 min-w-0 py-1.5 text-[13px]",
          "transition-colors duration-150 px-2.5 text-left bg-transparent",
          isActive ? ACTIVE_CHAT_ROW_CLASS : INACTIVE_CHAT_ROW_CLASS,
        )}
      >
        <span className="flex-1 min-w-0 truncate">{title}</span>
        <SessionActivityIndicator isRunning={isRunning} hasUnread={hasUnread} />
      </button>

      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          aria-label={`Options for ${title}`}
          aria-haspopup="true"
          aria-expanded={menuOpen}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((prev) => !prev);
          }}
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded-md",
            "text-muted-foreground/60 hover:text-foreground",
            menuOpen
              ? "visible opacity-100"
              : "invisible group-hover:visible opacity-0 group-hover:opacity-100",
          )}
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-10 mt-1 w-32 rounded-lg border border-border bg-background py-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              onClick={startRename}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-background-secondary transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Rename
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onArchive?.(id);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-background-secondary transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Archive
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
