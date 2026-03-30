import { useState, useRef, useEffect } from "react";
import { MoreVertical, Copy, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type { Persona } from "@/shared/types/agents";

interface PersonaCardProps {
  persona: Persona;
  onSelect?: (persona: Persona) => void;
  onEdit?: (persona: Persona) => void;
  onDuplicate?: (persona: Persona) => void;
  onDelete?: (persona: Persona) => void;
  isActive?: boolean;
}

export function PersonaCard({
  persona,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
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
        "bg-background transition-all duration-200 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2",
        "hover:shadow-md hover:-translate-y-0.5",
        isActive
          ? "border-border-primary ring-1 ring-ring"
          : "border-border hover:border-border-primary/50",
      )}
    >
      {/* Dropdown trigger */}
      <div ref={menuRef} className="absolute right-2 top-2">
        <button
          type="button"
          aria-label="Persona options"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((prev) => !prev);
          }}
          className={cn(
            "rounded-md p-1 text-foreground-secondary/60 transition-opacity",
            "hover:bg-background-secondary hover:text-foreground",
            menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-10 mt-1 w-36 rounded-lg border border-border bg-background py-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onEdit?.(persona);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-background-secondary transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onDuplicate?.(persona);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-background-secondary transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
              Duplicate
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={persona.isBuiltin}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onDelete?.(persona);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors",
                persona.isBuiltin
                  ? "text-foreground-secondary/40 cursor-not-allowed"
                  : "text-foreground-danger hover:bg-background-secondary",
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Avatar */}
      {persona.avatarUrl ? (
        <img
          src={persona.avatarUrl}
          alt=""
          className="h-12 w-12 rounded-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-background-secondary text-sm font-semibold text-foreground-secondary"
        >
          {initials}
        </div>
      )}

      {/* Name */}
      <h3 className="text-sm font-medium text-center leading-tight">
        {persona.displayName}
      </h3>

      {/* Built-in badge */}
      {persona.isBuiltin && (
        <span className="inline-flex items-center rounded-full bg-background-secondary px-2 py-0.5 text-[10px] font-medium text-foreground-secondary">
          Built-in
        </span>
      )}

      {/* System prompt preview */}
      <p className="text-xs text-foreground-secondary/70 text-center line-clamp-2 w-full">
        {persona.systemPrompt}
      </p>

      {/* Provider/model badge */}
      {(persona.provider || persona.model) && (
        <span className="inline-flex items-center gap-1 rounded-md bg-background-secondary px-2 py-0.5 text-[10px] text-foreground-secondary">
          {persona.provider && <span>{persona.provider}</span>}
          {persona.provider && persona.model && (
            <span aria-hidden="true">/</span>
          )}
          {persona.model && <span>{persona.model}</span>}
        </span>
      )}
    </section>
  );
}
