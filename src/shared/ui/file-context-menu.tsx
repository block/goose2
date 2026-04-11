import type { ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/shared/ui/context-menu";
import { revealInFileManager, revealLabel } from "@/shared/lib/fileManager";

interface FileContextMenuProps {
  filePath: string;
  children: ReactNode;
}

export function FileContextMenu({ filePath, children }: FileContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => void revealInFileManager(filePath)}>
          {revealLabel}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
