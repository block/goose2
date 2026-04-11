import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { IconGitBranch } from "@tabler/icons-react";
import { cn } from "@/shared/lib/cn";
import { FileContextMenu } from "@/shared/ui/file-context-menu";
import { Spinner } from "@/shared/ui/spinner";
import type { ChangedFile } from "@/shared/types/git";

function splitPath(relativePath: string) {
  const lastSlash = relativePath.lastIndexOf("/");
  if (lastSlash === -1) return { dir: "", name: relativePath };
  return {
    dir: relativePath.slice(0, lastSlash + 1),
    name: relativePath.slice(lastSlash + 1),
  };
}

function ChangedFileRow({
  file,
  fullPath,
  onOpen,
}: {
  file: ChangedFile;
  fullPath: string;
  onOpen: (path: string) => void;
}) {
  const { dir, name } = splitPath(file.path);
  return (
    <FileContextMenu filePath={fullPath}>
      <button
        type="button"
        className={cn(
        "flex w-full select-none items-center gap-2 px-3 py-1.5 text-left",
        "transition-colors duration-100",
        "hover:bg-muted/80",
        )}
        onClick={() => onOpen(file.path)}
      >
        <div className={cn(
          "flex min-w-0 flex-1 items-center overflow-hidden",
          file.status === "deleted" && "line-through opacity-60",
        )}>
          {dir && (
            <span className="shrink truncate text-xs text-muted-foreground">
              {dir}
            </span>
          )}
          <span className="shrink-0 whitespace-nowrap text-xs font-medium text-foreground">
            {name}
          </span>
        </div>
      </button>
    </FileContextMenu>
  );
}

interface ChangesWidgetProps {
  files: ChangedFile[] | undefined;
  isLoading: boolean;
  currentBranch: string | null;
  repoPath: string;
  onOpenFile: (path: string) => void;
}

export function ChangesWidget({
  files,
  isLoading,
  currentBranch,
  repoPath,
  onOpenFile,
}: ChangesWidgetProps) {
  const { t } = useTranslation("chat");

  const totals = useMemo(() => {
    if (!files?.length) return { additions: 0, deletions: 0 };
    return files.reduce(
      (acc, f) => ({
        additions: acc.additions + f.additions,
        deletions: acc.deletions + f.deletions,
      }),
      { additions: 0, deletions: 0 },
    );
  }, [files]);

  const fileCount = files?.length ?? 0;
  const hasChanges = fileCount > 0;

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="flex h-8 items-center gap-2 bg-background-alt px-3">
        <IconGitBranch className="size-3.5 shrink-0 text-foreground-subtle" />
        <div className="flex min-w-0 items-center gap-1">
          <span className="text-xs font-medium text-foreground">
            {t("contextPanel.widgets.changes")}
          </span>
          {currentBranch && (
            <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              <span className="shrink-0">on</span>
              <span className="max-w-[120px] truncate text-foreground">
                {currentBranch}
              </span>
            </span>
          )}
        </div>
        <div className="flex-1" />
        {isLoading && <Spinner className="size-3" />}
        {hasChanges && (
          <span className="shrink-0 font-mono text-xxs tabular-nums">
            <span className="text-text-success">+{totals.additions}</span>
            {" "}
            <span className="text-text-danger">&minus;{totals.deletions}</span>
          </span>
        )}
      </div>

      {hasChanges ? (
        <div className="max-h-[300px] overflow-y-auto">
          {files?.map((file) => (
            <ChangedFileRow
              key={`${file.path}-${file.staged}`}
              file={file}
              fullPath={`${repoPath}/${file.path}`}
              onOpen={onOpenFile}
            />
          ))}
        </div>
      ) : (
        <div className="px-3 py-2.5 text-xs text-foreground-subtle">
          {t("contextPanel.empty.noChanges")}
        </div>
      )}
    </div>
  );
}
