import { User } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

interface TopBarProps {
  onSettingsClick?: () => void;
  className?: string;
}

export function TopBar({ onSettingsClick, className }: TopBarProps) {
  return (
    <header
      className={cn(
        "flex h-10 items-center gap-2 border-b border-border bg-background/80 pl-20 pr-3 backdrop-blur-sm",
        className,
      )}
      data-tauri-drag-region
    >
      <div className="min-w-0 flex-1" />

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={onSettingsClick}
        className="bg-accent text-muted-foreground hover:bg-accent/80"
        title="Settings"
      >
        <User className="size-3.5" />
      </Button>
    </header>
  );
}
