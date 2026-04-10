import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IconChevronDown,
  IconFolder,
  IconGitBranch,
  IconCheck,
} from "@tabler/icons-react";
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
import { cn } from "@/shared/lib/cn";
import type { GitState } from "@/shared/types/git";
import type { WorkingContext } from "../../stores/chatSessionStore";

interface WorkingContextPickerProps {
  gitState: GitState | undefined;
  activeContext: WorkingContext | undefined;
  onSelect: (context: WorkingContext) => void;
  onSwitchBranch: (path: string, branch: string) => Promise<void>;
}

function shortenPath(fullPath: string): string {
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

export function WorkingContextPicker({
  gitState,
  activeContext,
  onSelect,
  onSwitchBranch,
}: WorkingContextPickerProps) {
  const { t } = useTranslation("chat");
  const [open, setOpen] = useState(false);
  const [pendingBranch, setPendingBranch] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  const worktrees = gitState?.worktrees ?? [];
  const localBranches = gitState?.localBranches ?? [];
  const dirtyFileCount = gitState?.dirtyFileCount ?? 0;
  const currentPath = activeContext?.path ?? worktrees[0]?.path;

  const activeBranch = activeContext?.branch ?? gitState?.currentBranch;

  const handleWorktreeSelect = useCallback(
    (path: string, branch: string | null) => {
      onSelect({ path, branch, type: "worktree" });
      setOpen(false);
    },
    [onSelect],
  );

  const performBranchSwitch = useCallback(
    async (branch: string) => {
      if (!currentPath) return;
      setSwitching(true);
      try {
        await onSwitchBranch(currentPath, branch);
        onSelect({ path: currentPath, branch, type: "branch" });
        setOpen(false);
      } finally {
        setSwitching(false);
        setPendingBranch(null);
      }
    },
    [currentPath, onSelect, onSwitchBranch],
  );

  const handleBranchSelect = useCallback(
    (branch: string) => {
      if (dirtyFileCount > 0) {
        setPendingBranch(branch);
      } else {
        void performBranchSwitch(branch);
      }
    },
    [dirtyFileCount, performBranchSwitch],
  );

  const isSelected = (branch: string | null, type: "worktree" | "branch") => {
    if (!activeContext) return false;
    return activeContext.branch === branch && activeContext.type === type;
  };

  const isWorktreeSelected = (path: string) => {
    return activeContext?.path === path && activeContext?.type === "worktree";
  };

  if (!gitState?.isGitRepo) return null;

  const hasWorktrees = worktrees.length > 1;
  const hasBranches = localBranches.length > 0;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-md border border-border px-2.5 py-1.5",
              "text-xs text-foreground transition-colors",
              "hover:bg-background-alt focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            )}
            aria-label={t("contextPanel.picker.selectBranch")}
          >
            <IconGitBranch className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-left font-medium">
              {activeBranch ?? t("contextPanel.states.detached")}
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
                      {wt.branch ?? t("contextPanel.states.detached")}
                    </span>
                    <span className="block truncate text-xxs text-foreground-subtle">
                      {shortenPath(wt.path)}
                    </span>
                  </div>
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
                {t("contextPanel.picker.branches")}
              </p>
              {localBranches.map((branch) => (
                <button
                  key={branch}
                  type="button"
                  disabled={switching}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                    "hover:bg-muted focus-visible:outline-none focus-visible:bg-muted",
                    "disabled:opacity-50",
                    isSelected(branch, "branch") && "bg-muted",
                  )}
                  onClick={() => handleBranchSelect(branch)}
                >
                  <IconGitBranch className="size-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">
                      {branch}
                    </span>
                    <span className="block truncate text-xxs text-foreground-subtle">
                      {t("contextPanel.picker.switchBranch")}
                    </span>
                  </div>
                  {isSelected(branch, "branch") ? (
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
              {t("contextPanel.picker.switchBranch")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("contextPanel.picker.switchWarning")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("contextPanel.picker.switchCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingBranch) {
                  void performBranchSwitch(pendingBranch);
                }
              }}
            >
              {t("contextPanel.picker.switchConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
