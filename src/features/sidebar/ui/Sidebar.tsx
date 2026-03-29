import { Plus, MessageCircle, Hash, Settings2 } from "lucide-react";
import { cn } from "@/shared/lib/cn";

interface SidebarProps {
  isOpen: boolean;
  onSettingsClick?: () => void;
}

const recentItems = [
  { id: "1", icon: MessageCircle, label: "Debug login flow" },
  { id: "2", icon: Hash, label: "API refactor notes" },
  { id: "3", icon: MessageCircle, label: "Weekend deploy plan" },
  { id: "4", icon: Hash, label: "Design review" },
];

export function Sidebar({ isOpen, onSettingsClick }: SidebarProps) {
  return (
    <aside
      aria-hidden={!isOpen}
      className={cn(
        "h-full flex-shrink-0 bg-card/90 backdrop-blur-xl transition-[width] duration-300 ease-in-out overflow-hidden",
        isOpen ? "border-r border-border/50" : "w-0"
      )}
      style={{ width: isOpen ? "12.5rem" : "0" }}
    >
      <div className="flex flex-col h-full w-[12.5rem]">
        {/* New Chat button */}
        <div className="px-3 py-2">
          <button type="button" className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer transition-colors">
            <Plus className="h-4 w-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Recent section */}
        <div className="mt-4 flex flex-col gap-0.5">
          <span className="px-3 py-1.5 text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
            Recent
          </span>
          <nav className="flex flex-col gap-0.5 px-1.5">
            {recentItems.map((item) => (
              <button
                type="button"
                key={item.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto pt-2 border-t border-border/50">
          <button
            type="button"
            onClick={onSettingsClick}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 w-full transition-colors"
          >
            <Settings2 className="h-4 w-4" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
