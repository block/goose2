import { useState } from "react";
import { Home, Plus, X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import type { Tab } from "@/features/tabs/types";
import { SessionActivityIndicator } from "@/shared/ui/SessionActivityIndicator";

const DISMISS_STAGGER_MS = 40;
const DISMISS_DURATION_MS = 200;

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onNewTab: () => void;
  onHomeClick: () => void;
  onClearAllTabs: () => void;
}

export function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onNewTab,
  onHomeClick,
  onClearAllTabs,
}: TabBarProps) {
  const [dismissingTabs, setDismissingTabs] = useState(false);

  const handleClearTabs = () => {
    if (dismissingTabs || tabs.length === 0) return;
    setDismissingTabs(true);
    const totalMs = (tabs.length - 1) * DISMISS_STAGGER_MS + DISMISS_DURATION_MS;
    setTimeout(() => {
      onClearAllTabs();
      setDismissingTabs(false);
    }, totalMs);
  };

  return (
    <div
      data-tauri-drag-region
      className="flex h-10 w-full items-center border-b border-border bg-background pl-20"
    >
      <Button
        variant="ghost-subtle"
        size="icon-xs"
        onClick={onHomeClick}
        aria-label="Home"
      >
        <Home  />
      </Button>

      <div
        role="tablist"
        className="flex items-center gap-0.5 overflow-x-auto px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {tabs.map((tab, index) => (
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
              "group flex h-7 cursor-pointer select-none items-center gap-1.5 rounded-md pl-3 pr-1.5 text-xs transition-colors",
              tab.id === activeTabId
                ? "bg-background-secondary text-foreground"
                : "text-foreground-secondary hover:bg-background-secondary/50 hover:text-foreground",
            )}
            style={
              dismissingTabs
                ? {
                    animation: `tab-dismiss ${DISMISS_DURATION_MS}ms ease-out forwards`,
                    animationDelay: `${(tabs.length - 1 - index) * DISMISS_STAGGER_MS}ms`,
                  }
                : undefined
            }
          >
            <span className="truncate">{tab.title}</span>
            <SessionActivityIndicator
              isRunning={tab.isRunning}
              hasUnread={tab.hasUnread}
            />
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: close is a secondary action inside an interactive tab, keyboard users close tabs via other means */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: cannot use button inside a tab element, span with click is intentional */}
            <span
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-background-secondary group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </span>
          </div>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 pr-3">
        <Button
          variant="ghost-subtle"
          size="icon-xs"
          onClick={onNewTab}
          aria-label="New tab"
        >
          <Plus  />
        </Button>
        {tabs.length > 0 && (
          <Button
            variant="ghost-subtle"
            size="icon-xs"
            onClick={handleClearTabs}
            aria-label="Close all tabs"
            title="Close all tabs"
          >
            <X  />
          </Button>
        )}
      </div>
    </div>
  );
}
