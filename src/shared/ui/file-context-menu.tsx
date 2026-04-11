import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/shared/ui/context-menu";
import { revealInFileManager } from "@/shared/lib/fileManager";
import { getPlatform } from "@/shared/lib/platform";

const revealLabel = `labels.revealInFileManager_${getPlatform()}` as const;

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
        <ContextMenuItem
          onSelect={() => void navigator.clipboard.writeText(filePath)}
        >
          {t("labels.copyPath")}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => void revealInFileManager(filePath)}>
          {t(revealLabel)}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
