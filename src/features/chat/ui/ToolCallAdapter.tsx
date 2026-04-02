import { useState, useEffect, useRef } from "react";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/shared/ui/ai-elements/tool";
import { toolStatusMap } from "../lib/toolStatusMap";
import type { ToolCallStatus } from "@/shared/types/messages";

interface ToolCallAdapterProps {
  name: string;
  arguments: Record<string, unknown>;
  status: ToolCallStatus;
  result?: string;
  isError?: boolean;
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
}: ToolCallAdapterProps) {
  const elapsed = useElapsedTime(status);
  const state = toolStatusMap[status];

  const title =
    status === "executing" && elapsed >= 3 ? `${name} (${elapsed}s)` : name;

  return (
    <Tool>
      <ToolHeader
        type="dynamic-tool"
        toolName={name}
        title={title}
        state={state}
      />
      <ToolContent>
        {Object.keys(args).length > 0 && <ToolInput input={args} />}
        <ToolOutput
          output={isError ? undefined : result}
          errorText={isError ? result : undefined}
        />
      </ToolContent>
    </Tool>
  );
}
