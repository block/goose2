import type { ReactNode } from "react";

interface WidgetCardProps {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

export function WidgetCard({ title, icon, action, children }: WidgetCardProps) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="flex h-8 items-center justify-between bg-background-alt px-3">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          {icon}
          <span>{title}</span>
        </div>
        {action}
      </div>
      <div className="text-xs text-foreground-subtle">{children}</div>
    </div>
  );
}
