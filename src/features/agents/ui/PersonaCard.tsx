import { useState, useRef, useEffect } from "react";
import { MoreVertical, Copy, Pencil, Trash2, Download } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Avatar, AvatarImage, AvatarFallback } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useAvatarSrc } from "@/shared/hooks/useAvatarSrc";
import type { Persona } from "@/shared/types/agents";

interface PersonaCardProps {
  persona: Persona;
  onSelect?: (persona: Persona) => void;
  onEdit?: (persona: Persona) => void;
  onDuplicate?: (persona: Persona) => void;
  onDelete?: (persona: Persona) => void;
  onExport?: (persona: Persona) => void;
  isActive?: boolean;
}

export function PersonaCard({
  persona,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  onExport,
  isActive = false,
}: PersonaCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const initials = persona.displayName.charAt(0).toUpperCase();
  const avatarSrc = useAvatarSrc(persona.avatar);

  return (
    <section
      aria-label={`Persona: ${persona.displayName}`}
      onClick={() => onSelect?.(persona)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(persona);
        }
      }}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: card needs keyboard focus but contains nested interactive buttons
      tabIndex={0}
      className={cn(
        "group relative flex flex-col items-center gap-3 rounded-xl border p-5 cursor-pointer",
        "bg-background transition-colors duration-200 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2",
        "hover:bg-accent/50",
        isActive ? "border-border ring-1 ring-ring" : "border-border",
      )}
    >
      {/* Dropdown trigger */}
      <div ref={menuRef} className="absolute right-2 top-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Persona options"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((prev) => !prev);
          }}
          className={cn(
            "size-6 rounded-md text-muted-foreground hover:text-foreground",
            menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <MoreVertical className="size-4" />
        </Button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-10 mt-1 w-36 rounded-lg border border-border bg-background py-1 shadow-popover"
          >
            <Button
              type="button"
              variant="ghost"
              size="xs"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onEdit?.(persona);
              }}
              className="w-full justify-start"
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onDuplicate?.(persona);
              }}
              className="w-full justify-start"
            >
              <Copy className="size-3.5" />
              Duplicate
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onExport?.(persona);
              }}
              className="w-full justify-start"
            >
              <Download className="size-3.5" />
              Export
            </Button>
            {!persona.isBuiltin && !persona.isFromDisk && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete?.(persona);
                }}
                className="w-full justify-start text-destructive hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Avatar */}
      <Avatar className="h-12 w-12">
        <AvatarImage src={avatarSrc ?? undefined} alt={persona.displayName} />
        <AvatarFallback className="text-sm font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>

      {/* Name */}
      <h3 className="text-sm font-medium text-center leading-tight">
        {persona.displayName}
      </h3>

      {/* Built-in badge */}
      {persona.isBuiltin && (
        <Badge variant="secondary" className="text-[10px]">
          Built-in
        </Badge>
      )}

      {/* System prompt preview */}
      <p className="text-xs text-muted-foreground text-center line-clamp-2 w-full">
        {persona.systemPrompt}
      </p>

      {/* Provider/model badge */}
      {(persona.provider || persona.model) && (
        <Badge variant="secondary" className="text-[10px]">
          {persona.provider && <span>{persona.provider}</span>}
          {persona.provider && persona.model && (
            <span aria-hidden="true">/</span>
          )}
          {persona.model && <span>{persona.model}</span>}
        </Badge>
      )}
    </section>
  );
}
