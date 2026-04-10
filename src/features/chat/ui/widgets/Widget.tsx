import type { ReactNode } from "react";

interface WidgetProps {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

export function Widget({ title, icon, action, children }: WidgetProps) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="flex h-8 items-center justify-between bg-background-alt px-3">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          {icon}
          <span>{title}</span>
        </div>
        {action}
      </div>
      <div className="px-3 py-2.5 text-xs text-foreground-subtle">
        {children}
      </div>
    </div>
  );
}
