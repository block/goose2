import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  IconChevronDown,
  IconFolder,
  IconGitBranch,
  IconCheck,
} from "@tabler/icons-react";
import { Badge } from "@/shared/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { buttonVariants } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";
import type { GitState } from "@/shared/types/git";
import type { WorkingContext } from "../../stores/chatSessionStore";

interface WorkingContextPickerProps {
  currentProjectPath: string | null;
  gitState: GitState | undefined;
  activeContext: WorkingContext | undefined;
  onSelect: (context: WorkingContext) => void;
  onSwitchBranch: (path: string, branch: string) => Promise<void>;
  onStashAndSwitch: (path: string, branch: string) => Promise<void>;
}

export function shortenPath(fullPath: string): string {
  const home =
    typeof window !== "undefined"
      ? fullPath.replace(/^\/Users\/[^/]+/, "~")
      : fullPath;
  const parts = home.split("/");
  if (parts.length > 3) {
    return `…/${parts.slice(-2).join("/")}`;
  }
  return home;
}

function normalizeComparablePath(path: string) {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function WorkingContextPicker({
  currentProjectPath,
  gitState,
  activeContext,
  onSelect,
  onSwitchBranch,
  onStashAndSwitch,
}: WorkingContextPickerProps) {
  const { t } = useTranslation("chat");
  const [open, setOpen] = useState(false);
  const [pendingBranch, setPendingBranch] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  const worktrees = gitState?.worktrees ?? [];
  const localBranches = gitState?.localBranches ?? [];
  const dirtyFileCount = gitState?.dirtyFileCount ?? 0;
  const defaultWorktreePath =
    worktrees.find(
      (worktree) =>
        normalizeComparablePath(worktree.path) ===
        normalizeComparablePath(currentProjectPath ?? ""),
    )?.path ?? worktrees[0]?.path;
  const currentPath = activeContext?.path ?? defaultWorktreePath;
  const activeWorktree =
    worktrees.find((worktree) => worktree.path === currentPath) ?? null;
  const activeBranch =
    activeWorktree?.branch ?? activeContext?.branch ?? gitState?.currentBranch;
  const activeWorktreeLabel = activeWorktree
    ? shortenPath(activeWorktree.path)
    : currentProjectPath
      ? shortenPath(currentProjectPath)
      : undefined;
  const activeBranchLabel = activeBranch ?? t("contextPanel.states.detached");
  const isMainWorktreeActive = activeWorktree?.isMain ?? false;
  const worktreeByBranch = new Map(
    worktrees
      .filter((worktree) => worktree.branch)
      .map((worktree) => [worktree.branch as string, worktree]),
  );

  const handleWorktreeSelect = useCallback(
    (path: string, branch: string | null) => {
      onSelect({ path, branch });
      setOpen(false);
    },
    [onSelect],
  );

  const finishSwitch = useCallback(
    (branch: string) => {
      if (!currentPath) return;
      onSelect({ path: currentPath, branch });
      setOpen(false);
      setPendingBranch(null);
    },
    [currentPath, onSelect],
  );

  const performCarrySwitch = useCallback(
    async (branch: string) => {
      if (!currentPath) return;
      setSwitching(true);
      try {
        await onSwitchBranch(currentPath, branch);
        finishSwitch(branch);
      } catch {
        toast.error(t("contextPanel.picker.switchError", { branch }));
      } finally {
        setSwitching(false);
      }
    },
    [currentPath, onSwitchBranch, finishSwitch, t],
  );

  const performStashSwitch = useCallback(
    async (branch: string) => {
      if (!currentPath) return;
      setSwitching(true);
      try {
        await onStashAndSwitch(currentPath, branch);
        finishSwitch(branch);
        toast.success(t("contextPanel.picker.stashSuccess", { branch }));
      } catch {
        toast.error(t("contextPanel.picker.stashError"));
      } finally {
        setSwitching(false);
      }
    },
    [currentPath, onStashAndSwitch, finishSwitch, t],
  );

  const handleBranchSelect = useCallback(
    (branch: string) => {
      if (dirtyFileCount > 0) {
        setPendingBranch(branch);
      } else {
        void performCarrySwitch(branch);
      }
    },
    [dirtyFileCount, performCarrySwitch],
  );

  const isWorktreeSelected = (path: string) => {
    return currentPath === path;
  };

  if (!gitState?.isGitRepo) return null;

  const hasWorktrees = worktrees.length > 0;
  const hasBranches = isMainWorktreeActive && localBranches.length > 0;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-md border border-border px-2.5 py-2",
              "text-xs text-foreground transition-colors",
              "hover:bg-background-alt focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            )}
            aria-label={t("contextPanel.picker.selectContext")}
          >
            <IconFolder className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate font-medium text-foreground">
                {activeWorktreeLabel ?? t("contextPanel.empty.folderNotSet")}
              </span>
              <span className="block truncate text-xxs text-foreground-subtle">
                {t("contextPanel.picker.checkedOutBranch", {
                  branch: activeBranchLabel,
                })}
              </span>
            </span>
            <IconChevronDown className="size-3 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          className="max-h-80 w-[var(--radix-popover-trigger-width)] min-w-56 overflow-y-auto p-1.5"
        >
          {hasWorktrees ? (
            <div>
              <p className="px-2 pb-1.5 pt-1 text-xxs font-medium uppercase tracking-wider text-muted-foreground">
                {t("contextPanel.picker.worktrees")}
              </p>
              {worktrees.map((wt) => (
                <button
                  key={wt.path}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                    "hover:bg-muted focus-visible:outline-none focus-visible:bg-muted",
                    isWorktreeSelected(wt.path) && "bg-muted",
                  )}
                  onClick={() => handleWorktreeSelect(wt.path, wt.branch)}
                >
                  <IconFolder className="size-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">
                      {shortenPath(wt.path)}
                    </span>
                    <span className="block truncate text-xxs text-foreground-subtle">
                      {t("contextPanel.picker.checkedOutBranch", {
                        branch: wt.branch ?? t("contextPanel.states.detached"),
                      })}
                    </span>
                  </div>
                  {wt.isMain ? (
                    <Badge variant="outline" className="text-[10px]">
                      {t("contextPanel.badges.main")}
                    </Badge>
                  ) : null}
                  {isWorktreeSelected(wt.path) ? (
                    <IconCheck className="size-3.5 shrink-0 text-brand" />
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          {hasBranches ? (
            <div
              className={hasWorktrees ? "mt-1 border-t border-border pt-1" : ""}
            >
              <p className="px-2 pb-1.5 pt-1 text-xxs font-medium uppercase tracking-wider text-muted-foreground">
                {t("contextPanel.picker.allBranches")}
              </p>
              {localBranches.map((branch) => (
                <button
                  key={branch}
                  type="button"
                  disabled={
                    switching ||
                    branch === activeBranch ||
                    (worktreeByBranch.has(branch) &&
                      worktreeByBranch.get(branch)?.path !== currentPath)
                  }
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                    "hover:bg-muted focus-visible:outline-none focus-visible:bg-muted",
                    "disabled:opacity-50",
                  )}
                  onClick={() => handleBranchSelect(branch)}
                >
                  <IconGitBranch className="size-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">
                      {branch}
                    </span>
                    <span className="block truncate text-xxs text-foreground-subtle">
                      {branch === activeBranch
                        ? t("contextPanel.picker.currentBranch")
                        : worktreeByBranch.has(branch) &&
                            worktreeByBranch.get(branch)?.path !== currentPath
                          ? t("contextPanel.picker.checkedOutInWorktree", {
                              path: shortenPath(
                                worktreeByBranch.get(branch)?.path ?? "",
                              ),
                            })
                          : t("contextPanel.picker.switchCurrentWorktree")}
                    </span>
                  </div>
                  {branch === activeBranch ? (
                    <IconCheck className="size-3.5 shrink-0 text-brand" />
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </PopoverContent>
      </Popover>

      <AlertDialog
        open={pendingBranch !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPendingBranch(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("contextPanel.picker.dirtyTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("contextPanel.picker.dirtyDescription", {
                count: dirtyFileCount,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={switching}>
              {t("contextPanel.picker.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={switching}
              className={buttonVariants({ variant: "secondary" })}
              onClick={() => {
                if (pendingBranch) {
                  void performCarrySwitch(pendingBranch);
                }
              }}
            >
              {t("contextPanel.picker.carryChanges")}
            </AlertDialogAction>
            <AlertDialogAction
              disabled={switching}
              onClick={() => {
                if (pendingBranch) {
                  void performStashSwitch(pendingBranch);
                }
              }}
            >
              {t("contextPanel.picker.stashAndSwitch")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
