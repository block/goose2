import { revealItemInDir } from "@tauri-apps/plugin-opener";

type Platform = "mac" | "windows" | "linux";

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "mac";
  if (ua.includes("win")) return "windows";
  return "linux";
}

const platformLabels: Record<Platform, string> = {
  mac: "Reveal in Finder",
  windows: "Reveal in Explorer",
  linux: "Reveal in File Manager",
};

export const platform = detectPlatform();
export const revealLabel = platformLabels[platform];

export async function revealInFileManager(path: string): Promise<void> {
  await revealItemInDir(path);
}
