import { Home } from "lucide-react";
import { cn } from "@/shared/lib/cn";

interface TopBarProps {
  onHomeClick: () => void;
  className?: string;
}

export function TopBar({ onHomeClick, className }: TopBarProps) {
  return (
    <header
      className={cn(
        "flex h-10 items-center gap-2 border-b border-border bg-background/80 pl-20 pr-3 backdrop-blur-sm",
        className,
      )}
      data-tauri-drag-region
    >
      <button
        type="button"
        onClick={onHomeClick}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        aria-label="Go home"
        title="Home"
      >
        <Home className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1" />
    </header>
  );
}
