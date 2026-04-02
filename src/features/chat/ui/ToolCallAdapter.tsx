import { useState, useEffect, useRef } from "react";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
  getStatusBadge,
} from "@/shared/ui/ai-elements/tool";
import { toolStatusMap } from "../lib/toolStatusMap";
import type { ToolCallStatus } from "@/shared/types/messages";

interface ToolCallAdapterProps {
  name: string;
  arguments: Record<string, unknown>;
  status: ToolCallStatus;
  result?: string;
  isError?: boolean;
  displayLabel?: string;
  flat?: boolean;
}

function useElapsedTime(status: ToolCallStatus) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (status === "executing") {
      startRef.current = Date.now();
      setElapsed(0);
      const interval = setInterval(() => {
        if (startRef.current) {
          setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
        }
      }, 1000);
      return () => clearInterval(interval);
    }
    startRef.current = null;
  }, [status]);

  return elapsed;
}

export function ToolCallAdapter({
  name,
  arguments: args,
  status,
  result,
  isError,
  displayLabel,
  flat,
}: ToolCallAdapterProps) {
  const elapsed = useElapsedTime(status);
  const state = toolStatusMap[status];

  const baseTitle = displayLabel ?? name;
  const title =
    status === "executing" && elapsed >= 3
      ? `${baseTitle} (${elapsed}s)`
      : baseTitle;

  if (flat) {
    return (
      <div className="w-full">
        <span className="font-medium text-sm text-muted-foreground">
          {title}
        </span>
        {getStatusBadge(state)}
        <div className="space-y-4 py-2">
          {Object.keys(args).length > 0 && <ToolInput input={args} />}
          <ToolOutput
            output={isError ? undefined : result}
            errorText={isError ? result : undefined}
            hideLabel
          />
        </div>
      </div>
    );
  }

  return (
    <Tool>
      <ToolHeader
        type="dynamic-tool"
        toolName={name}
        title={title}
        state={state}
        showIcon={false}
        className="text-muted-foreground"
      />
      <ToolContent>
        {Object.keys(args).length > 0 && <ToolInput input={args} />}
        <ToolOutput
          output={isError ? undefined : result}
          errorText={isError ? result : undefined}
          hideLabel
        />
      </ToolContent>
    </Tool>
  );
}
