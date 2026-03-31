import { useState } from "react";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Wrench,
  Loader2,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { cn } from "@/shared/lib/cn";
import { runDoctorFix, type DoctorCheck } from "@/shared/api/doctor";

interface DoctorCheckRowProps {
  check: DoctorCheck;
  onFixed?: () => void;
}

const STATUS_ICON = {
  pass: CheckCircle,
  warn: AlertTriangle,
  fail: XCircle,
} as const;

const STATUS_COLOR = {
  pass: "text-foreground-success",
  warn: "text-foreground-warning",
  fail: "text-foreground-danger",
} as const;

export function DoctorCheckRow({ check, onFixed }: DoctorCheckRowProps) {
  const [showFixDialog, setShowFixDialog] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);

  const Icon = STATUS_ICON[check.status];

  async function confirmFix() {
    if (!check.fixCommand) return;
    setFixing(true);
    setFixError(null);
    try {
      await runDoctorFix(check.fixCommand);
      setShowFixDialog(false);
      onFixed?.();
    } catch (e) {
      setFixError(String(e));
    } finally {
      setFixing(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2.5 rounded-lg bg-background px-3.5 py-2.5">
        <Icon
          className={cn("h-4 w-4 flex-shrink-0", STATUS_COLOR[check.status])}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium">{check.label}</span>
          <span className="break-words text-xs text-foreground-secondary">
            {check.message}
          </span>
          {check.path && (
            <span className="break-words font-mono text-[10px] text-foreground-tertiary">
              {check.path}
            </span>
          )}
          {check.bridgePath && (
            <span className="break-words font-mono text-[10px] text-foreground-tertiary">
              {check.bridgePath}
            </span>
          )}
        </div>

        {check.fixCommand && check.status !== "pass" && (
          <button
            type="button"
            onClick={() => {
              setFixError(null);
              setFixing(false);
              setShowFixDialog(true);
            }}
            className="flex flex-shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground-secondary transition-colors hover:bg-background-secondary hover:text-foreground"
          >
            <Wrench className="h-3.5 w-3.5" />
            Fix
          </button>
        )}

        {check.fixUrl && check.status !== "pass" && (
          <button
            type="button"
            onClick={() => {
              if (check.fixUrl) void openUrl(check.fixUrl);
            }}
            aria-label="Open fix URL"
            className="flex flex-shrink-0 items-center justify-center rounded-md p-1 text-foreground-secondary transition-colors hover:bg-background-secondary hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showFixDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!fixing) setShowFixDialog(false);
            }}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-sm space-y-4 rounded-xl border border-border bg-background p-6 shadow-xl">
            <h3 className="text-sm font-semibold">Run fix command?</h3>
            <p className="break-all font-mono text-xs text-foreground-secondary">
              {check.fixCommand}
            </p>
            {fixError && (
              <p className="text-xs text-foreground-danger">{fixError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={fixing}
                onClick={() => setShowFixDialog(false)}
                className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors hover:bg-background-secondary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={fixing}
                onClick={confirmFix}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-background-secondary disabled:opacity-50"
              >
                {fixing && <Loader2 className="h-3 w-3 animate-spin" />}
                {fixing ? "Running" : fixError ? "Retry" : "Run"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
