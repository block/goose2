import { useCallback, useRef, useState, type DragEvent } from "react";

interface UseImageDropTargetOptions {
  disabled: boolean;
  isStreaming: boolean;
  onDropFile: (file: File) => void;
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

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith("image/"),
      );
      if (files.length === 0) {
        return;
      }

      e.preventDefault();
      for (const file of files) {
        onDropFile(file);
      }
    },
    [disabled, isStreaming, onDropFile],
  );

  return {
    isImageDragOver,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
