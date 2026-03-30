import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { clearServerConfigCache } from "@/shared/api";

interface SidecarInfo {
  url: string;
  port: number;
  pid: number | null;
  secret_key: string;
  healthy: boolean;
}

type SidecarStatus = "starting" | "running" | "error" | "stopped";

interface UseSidecarReturn {
  status: SidecarStatus;
  url: string | null;
  secretKey: string | null;
  error: string | null;
  restart: () => Promise<void>;
}

export function useSidecar(): UseSidecarReturn {
  const [status, setStatus] = useState<SidecarStatus>("starting");
  const [url, setUrl] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const start = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;

    setStatus("starting");
    setError(null);
    clearServerConfigCache();

    try {
      const info = await invoke<SidecarInfo>("start_sidecar", {});
      setUrl(info.url);
      setSecretKey(info.secret_key);
      setStatus("running");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStatus("error");
      startedRef.current = false;
    }
  }, []);

  const restart = useCallback(async () => {
    startedRef.current = false;
    clearServerConfigCache();
    setStatus("starting");
    setError(null);

    try {
      await invoke("stop_sidecar");
    } catch {
      // Ignore stop errors
    }

    try {
      const info = await invoke<SidecarInfo>("start_sidecar", {});
      setUrl(info.url);
      setSecretKey(info.secret_key);
      setStatus("running");
      startedRef.current = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    start();
    return () => {
      invoke("stop_sidecar").catch(() => {});
    };
  }, [start]);

  return { status, url, secretKey, error, restart };
}
