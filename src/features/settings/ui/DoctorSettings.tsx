import { useState, useEffect, useRef, useCallback } from "react";
import {
  RefreshCw,
  Stethoscope,
  ClipboardCopy,
  Check,
  Loader2,
} from "lucide-react";
import {
  runDoctor,
  type DoctorCheck,
  type DoctorReport,
} from "@/shared/api/doctor";
import { DoctorCheckRow } from "./DoctorCheckRow";

function formatDebugReport(report: DoctorReport): string {
  const STATUS_ICONS: Record<DoctorCheck["status"], string> = {
    pass: "\u2713",
    warn: "\u26A0",
    fail: "\u2717",
  };

  const lines: string[] = [
    "Goose Doctor Report",
    `Date: ${new Date().toISOString()}`,
    "=".repeat(60),
  ];

  for (const check of report.checks) {
    const icon = STATUS_ICONS[check.status];
    lines.push("");
    lines.push(
      `${icon} [${check.status.toUpperCase()}] ${check.label} (${check.id})`,
    );
    lines.push(`  Message: ${check.message}`);
    if (check.path) lines.push(`  Path: ${check.path}`);
    if (check.bridgePath) lines.push(`  Bridge path: ${check.bridgePath}`);
    if (check.fixUrl) lines.push(`  Fix URL: ${check.fixUrl}`);
    if (check.fixCommand) lines.push(`  Fix command: ${check.fixCommand}`);
    if (check.rawOutput) {
      lines.push("  --- raw output ---");
      for (const line of check.rawOutput.split("\n")) {
        lines.push(`  ${line}`);
      }
      lines.push("  --- end raw output ---");
    }
  }

  lines.push("");
  lines.push("=".repeat(60));
  return lines.join("\n");
}

export function DoctorSettings() {
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const mountedRef = useRef(true);

  const runChecks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await runDoctor();
      if (mountedRef.current) setReport(result);
    } catch (e) {
      console.error("[Doctor] Failed to run checks:", e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    runChecks();
    return () => {
      mountedRef.current = false;
    };
  }, [runChecks]);

  const toolChecks =
    report?.checks.filter((c) => !c.id.startsWith("ai-agent-")) ?? [];
  const agentChecks =
    report?.checks.filter((c) => c.id.startsWith("ai-agent-")) ?? [];

  async function copyDebugInfo() {
    if (!report) return;
    await navigator.clipboard.writeText(formatDebugReport(report));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 pr-8">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Stethoscope className="h-4 w-4" />
            Doctor
          </h3>
          <p className="mt-1 text-sm text-foreground-secondary">
            Verify required tools and agent availability for Goose.
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {report && !loading && (
            <button
              type="button"
              onClick={copyDebugInfo}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground-secondary transition-colors hover:bg-background-secondary hover:text-foreground"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <ClipboardCopy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy details"}
            </button>
          )}

          {!loading && (
            <button
              type="button"
              onClick={runChecks}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground-secondary transition-colors hover:bg-background-secondary hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-run
            </button>
          )}
        </div>
      </div>

      <div className="my-4 border-t" />

      {loading ? (
        <div className="flex min-h-[160px] items-center justify-center gap-2 text-sm text-foreground-secondary">
          <Loader2 className="h-5 w-5 animate-spin" />
          Running checks...
        </div>
      ) : report ? (
        <div className="space-y-6">
          <div className="mx-auto w-full max-w-xl space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
              Tools
            </h4>
            <div className="space-y-2">
              {toolChecks.map((check) => (
                <DoctorCheckRow
                  key={check.id}
                  check={check}
                  onFixed={runChecks}
                />
              ))}
            </div>
          </div>

          {agentChecks.length > 0 && (
            <div className="mx-auto w-full max-w-xl space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
                Agents
              </h4>
              <div className="space-y-2">
                {agentChecks.map((check) => (
                  <DoctorCheckRow
                    key={check.id}
                    check={check}
                    onFixed={runChecks}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-[160px] items-center justify-center text-sm text-foreground-secondary">
          No checks are available yet.
        </div>
      )}
    </div>
  );
}
