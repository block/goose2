import { useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/ui/badge";
import { ImageLightbox } from "@/shared/ui/ImageLightbox";

// ---------------------------------------------------------------------------
// PastedImageThumb — thumbnail preview for pasted/dropped images
// ---------------------------------------------------------------------------

export function PastedImageThumb({
  objectUrl,
  index,
  onRemove,
}: {
  objectUrl: string;
  index: number;
  onRemove: (index: number) => void;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { t } = useTranslation("chat");

  return (
    <>
      <div className="group relative inline-block">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="block cursor-pointer rounded-lg"
          aria-label={t("attachments.view", { index: index + 1 })}
        >
          <img
            src={objectUrl}
            alt={t("attachments.alt", { index: index + 1 })}
            className="h-16 w-16 rounded-lg object-cover border border-border"
          />
        </button>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          aria-label={t("attachments.remove")}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>
      <ImageLightbox
        src={objectUrl}
        alt={t("attachments.alt", { index: index + 1 })}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// FileAttachmentChips — badge chips for non-image file attachments
// ---------------------------------------------------------------------------

export function FileAttachmentChips({
  files,
  onRemove,
}: {
  files: string[];
  onRemove: (index: number) => void;
}) {
  const { t } = useTranslation("chat");
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {files.map((path, i) => {
        const name = path.split("/").pop() ?? path;
        return (
          <Badge key={path} variant="secondary" className="gap-1 pr-1 text-xs">
            <span className="max-w-[160px] truncate">{name}</span>
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="rounded-sm p-0.5 hover:bg-foreground/10"
              aria-label={t("attachments.remove")}
            >
              <X className="size-3" />
            </button>
          </Badge>
        );
      })}
    </div>
  );
}
