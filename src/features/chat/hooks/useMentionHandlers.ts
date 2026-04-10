import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listFilesForMentions } from "@/shared/api/system";
import type { Persona } from "@/shared/types/agents";
import {
  useMentionDetection,
  type FileMentionItem,
  type MentionItem,
} from "../ui/MentionAutocomplete";
import { useArtifactPolicyContext } from "./ArtifactPolicyContext";

interface MentionHandlersOptions {
  personas: Persona[];
  projectWorkingDirs?: string[] | undefined;
  text: string;
  setText: (value: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onPersonaChange?: ((id: string | null) => void) | undefined;
}

function basename(path: string): string {
  const parts = path.split(/[\\/]+/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function normalizeRoots(roots: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (roots ?? [])
        .map((root) => root.trim())
        .filter((root) => root.length > 0),
    ),
  );
}

function toDisplayPath(path: string, roots: string[]): string {
  const normalizedPath = path.replace(/\\/g, "/");
  for (const root of roots) {
    const normalizedRoot = root.replace(/\\/g, "/").replace(/\/+$/, "");
    const prefix = `${normalizedRoot}/`;
    if (normalizedPath.startsWith(prefix)) {
      const relative = normalizedPath.slice(prefix.length);
      const rootName = basename(normalizedRoot);
      return `${rootName}/${relative}`;
    }
  }
  return path;
}

function sameStringArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Combines persona + file mention detection, filtering, and selection handlers.
 * Keeps ChatInput under the file-size limit by centralising mention logic.
 */
export function useMentionHandlers({
  personas,
  projectWorkingDirs,
  text,
  setText,
  textareaRef,
  onPersonaChange,
}: MentionHandlersOptions) {
  const { getAllSessionArtifacts } = useArtifactPolicyContext();
  const normalizedProjectRoots = useMemo(
    () => normalizeRoots(projectWorkingDirs),
    [projectWorkingDirs],
  );
  const rootsKey = useMemo(
    () => normalizedProjectRoots.join("\n"),
    [normalizedProjectRoots],
  );
  const [projectFilePaths, setProjectFilePaths] = useState<string[]>([]);
  const loadedRootsKeyRef = useRef<string>("");

  useEffect(() => {
    if (!rootsKey) {
      loadedRootsKeyRef.current = "";
      setProjectFilePaths([]);
      return;
    }
    if (loadedRootsKeyRef.current === rootsKey) {
      return;
    }

    loadedRootsKeyRef.current = rootsKey;
    setProjectFilePaths([]);
    let cancelled = false;

    void listFilesForMentions(normalizedProjectRoots)
      .then((paths) => {
        if (cancelled) return;
        setProjectFilePaths((prev) =>
          sameStringArray(prev, paths) ? prev : paths,
        );
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to load project files for mentions:", error);
        setProjectFilePaths((prev) => (prev.length === 0 ? prev : []));
      });

    return () => {
      cancelled = true;
    };
  }, [rootsKey, normalizedProjectRoots]);

  const fileMentionItems: FileMentionItem[] = useMemo(() => {
    const dedup = new Map<string, FileMentionItem>();

    for (const artifact of getAllSessionArtifacts()) {
      const key = artifact.resolvedPath.trim().toLowerCase();
      if (!key || dedup.has(key)) continue;
      dedup.set(key, {
        resolvedPath: artifact.resolvedPath,
        displayPath: artifact.displayPath,
        filename: artifact.filename,
        kind: artifact.kind,
      });
    }

    for (const path of projectFilePaths) {
      const key = path.trim().toLowerCase();
      if (!key || dedup.has(key)) continue;
      dedup.set(key, {
        resolvedPath: path,
        displayPath: toDisplayPath(path, normalizedProjectRoots),
        filename: basename(path),
        kind: "file",
      });
    }

    return Array.from(dedup.values());
  }, [getAllSessionArtifacts, projectFilePaths, normalizedProjectRoots]);

  const {
    mentionOpen,
    mentionQuery,
    mentionStartIndex,
    mentionSelectedIndex,
    detectMention,
    closeMention,
    navigateMention,
    confirmMention,
  } = useMentionDetection(personas, fileMentionItems);

  // ---- selection handlers ------------------------------------------------

  const handlePersonaMentionSelect = useCallback(
    (persona: Persona) => {
      const before = text.slice(0, mentionStartIndex);
      const after = text.slice(mentionStartIndex + 1 + mentionQuery.length);
      const newText = `${before}${after}`.replace(/\s{2,}/g, " ");
      setText(newText);
      closeMention();
      onPersonaChange?.(persona.id);

      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          ta.style.height = "auto";
          ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
          const cursorPos = Math.min(before.length, newText.length);
          ta.setSelectionRange(cursorPos, cursorPos);
        }
      });
    },
    [
      text,
      mentionStartIndex,
      mentionQuery,
      closeMention,
      onPersonaChange,
      setText,
      textareaRef,
    ],
  );

  const handleFileMentionSelect = useCallback(
    (file: FileMentionItem) => {
      const before = text.slice(0, mentionStartIndex);
      const after = text.slice(mentionStartIndex + 1 + mentionQuery.length);
      const inserted = file.resolvedPath;
      const newText = `${before}${inserted} ${after}`.replace(/\s{2,}/g, " ");
      setText(newText);
      closeMention();

      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          ta.style.height = "auto";
          ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
          const cursorPos = before.length + inserted.length + 1;
          ta.setSelectionRange(cursorPos, cursorPos);
        }
      });
    },
    [text, mentionStartIndex, mentionQuery, closeMention, setText, textareaRef],
  );

  const handleMentionConfirm = useCallback(
    (item: MentionItem) => {
      if (item.type === "persona") {
        handlePersonaMentionSelect(item.persona);
      } else {
        handleFileMentionSelect(item.file);
      }
    },
    [handlePersonaMentionSelect, handleFileMentionSelect],
  );

  return {
    fileMentionItems,
    mentionOpen,
    mentionQuery,
    mentionStartIndex,
    mentionSelectedIndex,
    detectMention,
    closeMention,
    navigateMention,
    confirmMention,
    handlePersonaMentionSelect,
    handleFileMentionSelect,
    handleMentionConfirm,
  };
}
