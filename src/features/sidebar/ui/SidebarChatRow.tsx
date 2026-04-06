import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { SessionActivityIndicator } from "@/shared/ui/SessionActivityIndicator";

const INACTIVE_CHAT_ROW_CLASS =
  "text-muted-foreground hover:bg-transparent hover:text-foreground group-hover:text-foreground";
const ACTIVE_CHAT_ROW_CLASS =
  "text-foreground hover:bg-transparent hover:text-foreground";

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
  onMouseEnter?: (e: React.MouseEvent<HTMLElement>) => void;
  activeRef?: (el: HTMLElement | null) => void;
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
  onMouseEnter,
  activeRef,
}: SidebarChatRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!activeRef || !isActive || !rowRef.current) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      if (rowRef.current) {
        activeRef(rowRef.current);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [activeRef, isActive]);

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
      <div
        className={cn("flex items-center group rounded-md pr-0.5", className)}
      >
        <Input
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
          className="flex-1 min-w-0 px-3 text-[13px] font-light"
          style={{ height: 32 }}
        />
      </div>
    );
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: wrapper div for hover detection, interactive content is the inner Button
    <div
      ref={rowRef}
      className={cn(
        "flex items-center group rounded-md pr-0.5 transition-colors duration-200",
        className,
      )}
      onMouseEnter={onMouseEnter}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onSelect?.(id)}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          startRename();
        }}
        title="Double-click to rename"
        className={cn(
          "flex-1 min-w-0 justify-start gap-2 rounded-md px-3 py-2 text-[13px] font-light",
          isActive ? ACTIVE_CHAT_ROW_CLASS : INACTIVE_CHAT_ROW_CLASS,
        )}
      >
        <span className="flex-1 min-w-0 truncate text-left">{title}</span>
        <SessionActivityIndicator isRunning={isRunning} hasUnread={hasUnread} />
      </Button>

      <div ref={menuRef} className="relative shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Options for ${title}`}
          aria-haspopup="true"
          aria-expanded={menuOpen}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((prev) => !prev);
          }}
          className={cn(
            "size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50",
            menuOpen
              ? "visible opacity-100"
              : "invisible group-hover:visible opacity-0 group-hover:opacity-100",
          )}
        >
          <MoreHorizontal className="size-3.5" />
        </Button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-10 mt-1 w-36 rounded-card border border-border bg-background p-1 shadow-popover"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              role="menuitem"
              onClick={startRename}
              className="w-full justify-start rounded-pill"
            >
              <Pencil className="size-3.5" />
              Rename
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onArchive?.(id);
              }}
              className="w-full justify-start rounded-pill"
            >
              <Trash2 className="size-3.5" />
              Archive
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
