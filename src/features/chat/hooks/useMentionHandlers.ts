import { useCallback, useMemo } from "react";
import type { Persona } from "@/shared/types/agents";
import {
  useMentionDetection,
  type FileMentionItem,
  type MentionItem,
} from "../ui/MentionAutocomplete";
import { useArtifactPolicyContext } from "./ArtifactPolicyContext";

interface MentionHandlersOptions {
  personas: Persona[];
  text: string;
  setText: (value: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onPersonaChange?: ((id: string | null) => void) | undefined;
}

/**
 * Combines persona + file mention detection, filtering, and selection handlers.
 * Keeps ChatInput under the file-size limit by centralising mention logic.
 */
export function useMentionHandlers({
  personas,
  text,
  setText,
  textareaRef,
  onPersonaChange,
}: MentionHandlersOptions) {
  const { getAllSessionArtifacts } = useArtifactPolicyContext();

  const fileMentionItems: FileMentionItem[] = useMemo(
    () =>
      getAllSessionArtifacts().map((a) => ({
        resolvedPath: a.resolvedPath,
        displayPath: a.displayPath,
        filename: a.filename,
        kind: a.kind,
      })),
    [getAllSessionArtifacts],
  );

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
