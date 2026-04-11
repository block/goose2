import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/shared/ui/context-menu";
import { revealInFileManager } from "@/shared/lib/fileManager";

interface FileContextMenuProps {
  filePath: string;
  children: ReactNode;
}

export function FileContextMenu({ filePath, children }: FileContextMenuProps) {
  const { t } = useTranslation("common");

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => void revealInFileManager(filePath)}>
          {t("labels.revealInFileManager")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
