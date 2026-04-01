import { useState, useCallback, useRef } from "react";
import { Camera, X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useAvatarSrc } from "@/shared/hooks/useAvatarSrc";
import { savePersonaAvatar, savePersonaAvatarBytes } from "@/shared/api/agents";
import { open } from "@tauri-apps/plugin-dialog";
import type { Avatar } from "@/shared/types/agents";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg"];

interface AvatarDropZoneProps {
  personaId: string;
  avatar: Avatar | null | undefined;
  onChange: (avatar: Avatar | null) => void;
  disabled?: boolean;
}

export function AvatarDropZone({
  personaId,
  avatar,
  onChange,
  disabled = false,
}: AvatarDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragDepthRef = useRef(0);

  const avatarSrc = useAvatarSrc(avatar);

  /** Save a file dropped via HTML5 drag-and-drop (File object, no path). */
  const processFile = useCallback(
    async (file: File) => {
      setError(null);

      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !IMAGE_EXTENSIONS.includes(ext)) {
        setError("Unsupported image type");
        return;
      }

      setIsUploading(true);
      try {
        const buffer = await file.arrayBuffer();
        const bytes = Array.from(new Uint8Array(buffer));
        const filename = await savePersonaAvatarBytes(personaId, bytes, ext);

        onChange({ type: "local", value: filename });
      } catch (err) {
        console.error("Failed to save avatar:", err);
        setError("Failed to save avatar");
      } finally {
        setIsUploading(false);
      }
    },
    [personaId, onChange],
  );

  /** Save a file selected via the native file picker (has a path). */
  const processPath = useCallback(
    async (filePath: string) => {
      setError(null);

      const ext = filePath.split(".").pop()?.toLowerCase();
      if (!ext || !IMAGE_EXTENSIONS.includes(ext)) {
        setError("Unsupported image type");
        return;
      }

      setIsUploading(true);
      try {
        const filename = await savePersonaAvatar(personaId, filePath);

        onChange({ type: "local", value: filename });
      } catch (err) {
        console.error("Failed to save avatar:", err);
        setError("Failed to save avatar");
      } finally {
        setIsUploading(false);
      }
    },
    [personaId, onChange],
  );

  // Standard HTML5 drag-and-drop (works when dragDropEnabled is false)
  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;

      dragDepthRef.current += 1;
      setIsDragOver(true);
    },
    [disabled],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;

      e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;

      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsDragOver(false);
      }
    },
    [disabled],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragDepthRef.current = 0;
      setIsDragOver(false);
      if (disabled) return;

      // File drop (from OS)
      const file = e.dataTransfer.files[0];
      if (file) {
        void processFile(file);
        return;
      }

      // URL drop (from browser)
      const url =
        e.dataTransfer.getData("text/uri-list") ||
        e.dataTransfer.getData("text/plain");
      if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
        setError(null);
        onChange({ type: "url", value: url });
      }
    },
    [disabled, processFile, onChange],
  );

  const handleClick = useCallback(async () => {
    if (disabled || isUploading) return;

    const selected = await open({
      title: "Choose avatar image",
      filters: [
        {
          name: "Image",
          extensions: IMAGE_EXTENSIONS,
        },
      ],
      multiple: false,
    });

    if (selected) {
      processPath(selected);
    }
  }, [disabled, isUploading, processPath]);

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setError(null);
      onChange(null);
    },
    [onChange],
  );

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <button
          type="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Drop an image or click to upload avatar"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          className={cn(
            "flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 bg-background-secondary shadow-sm transition-all",
            isDragOver
              ? "scale-105 border-accent bg-accent/15 shadow-md ring-4 ring-accent/20"
              : "border-border hover:border-border-primary/50 hover:bg-background-tertiary",
            disabled && "opacity-70 cursor-not-allowed",
            isUploading && "animate-pulse",
          )}
        >
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt="Avatar preview"
              className="h-full w-full rounded-full object-cover"
              onError={() => setError("Failed to load image")}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-foreground-secondary/50">
              <Camera className="h-5 w-5" />
            </div>
          )}
        </button>

        {/* Clear button */}
        {avatar && !disabled && (
          <button
            type="button"
            aria-label="Remove avatar"
            onClick={handleClear}
            className={cn(
              "absolute -top-0.5 -right-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full",
              "bg-background border border-border text-foreground-secondary shadow-sm",
              "hover:bg-background-secondary hover:text-foreground transition-colors",
            )}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {error && (
        <span className="text-[10px] text-foreground-danger">{error}</span>
      )}
    </div>
  );
}
