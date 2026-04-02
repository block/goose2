import { Home, Plus, X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import type { Tab } from "@/features/tabs/types";

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onNewTab: () => void;
  onHomeClick: () => void;
}

export function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onNewTab,
  onHomeClick,
}: TabBarProps) {
  return (
    <div
      data-tauri-drag-region
      className="flex h-10 w-full items-center border-b border-border bg-background pl-20"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={onHomeClick}
        className="rounded-md text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        aria-label="Home"
      >
        <Home className="size-4" />
      </Button>

      <div
        role="tablist"
        className="flex items-center gap-0.5 overflow-x-auto px-1"
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            role="tab"
            tabIndex={0}
            aria-selected={tab.id === activeTabId}
            onClick={() => onTabSelect(tab.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onTabSelect(tab.id);
              }
            }}
            className={cn(
              "group flex h-7 cursor-pointer items-center gap-1.5 rounded-md pl-3 pr-1.5 text-xs transition-colors",
              tab.id === activeTabId
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <span className="truncate">{tab.title}</span>
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: close is a secondary action inside an interactive tab, keyboard users close tabs via other means */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: cannot use button inside a tab element, span with click is intentional */}
            <span
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </span>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={onNewTab}
        className="rounded-md text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        aria-label="New tab"
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
