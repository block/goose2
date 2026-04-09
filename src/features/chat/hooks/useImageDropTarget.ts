import { useCallback, useRef, useState, type DragEvent } from "react";

interface UseImageDropTargetOptions {
  disabled: boolean;
  isStreaming: boolean;
  onDropImage: (file: File) => void;
  /** Called for non-image files with their absolute path (Tauri file drop). */
  onDropFile?: (path: string) => void;
}

function hasDraggedFiles(dataTransfer: DataTransfer) {
  return (
    Array.from(dataTransfer.items).some(
      (item) => item.kind === "file" || item.type.startsWith("image/"),
    ) || Array.from(dataTransfer.types).includes("Files")
  );
}

export function useImageDropTarget({
  disabled,
  isStreaming,
  onDropImage,
  onDropFile,
}: UseImageDropTargetOptions) {
  const [isImageDragOver, setIsImageDragOver] = useState(false);
  const dragDepthRef = useRef(0);

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (disabled || isStreaming || !hasDraggedFiles(e.dataTransfer)) {
        return;
      }

      e.preventDefault();
      dragDepthRef.current += 1;
      setIsImageDragOver(true);
    },
    [disabled, isStreaming],
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (disabled || isStreaming || !hasDraggedFiles(e.dataTransfer)) {
        return;
      }

      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setIsImageDragOver(true);
    },
    [disabled, isStreaming],
  );

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();

      if (!isImageDragOver) {
        return;
      }

      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsImageDragOver(false);
      }
    },
    [isImageDragOver],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      dragDepthRef.current = 0;
      setIsImageDragOver(false);

      if (disabled || isStreaming) {
        return;
      }

      const allFiles = Array.from(e.dataTransfer.files);
      if (allFiles.length === 0) return;

      e.preventDefault();

      for (const file of allFiles) {
        if (file.type.startsWith("image/")) {
          onDropImage(file);
        } else if (onDropFile) {
          // For non-image files, use the file path if available (Tauri provides it).
          // The webkitRelativePath or name is the best we can get in a browser context.
          // In Tauri, the full path is available via the File object.
          const path = (file as File & { path?: string }).path ?? file.name;
          if (path) {
            onDropFile(path);
          }
        }
      }
    },
    [disabled, isStreaming, onDropImage, onDropFile],
  );

  return {
    isImageDragOver,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
