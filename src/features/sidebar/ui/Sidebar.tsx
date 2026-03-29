import { Plus, MessageSquare, MessageCircle, Hash } from "lucide-react";
import { cn } from "@/shared/lib/cn";

interface SidebarProps {
  isOpen: boolean;
}

const recentItems = [
  { icon: MessageCircle, label: "Debug login flow" },
  { icon: Hash, label: "API refactor notes" },
  { icon: MessageCircle, label: "Weekend deploy plan" },
  { icon: Hash, label: "Design review" },
];

export function Sidebar({ isOpen }: SidebarProps) {
  return (
    <aside
      className={cn(
        "h-full flex-shrink-0 bg-card/90 backdrop-blur-xl transition-[width] duration-300 ease-in-out overflow-hidden",
        isOpen ? "border-r border-border/50" : "w-0"
      )}
      style={{ width: isOpen ? "12.5rem" : "0" }}
    >
      <div className="flex flex-col h-full w-[12.5rem]">
        {/* New Chat button */}
        <div className="px-3 py-2">
          <button className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer transition-colors">
            <Plus className="h-4 w-4" />
            <MessageSquare className="h-4 w-4" />
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
              <a
                key={item.label}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </a>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  );
}
