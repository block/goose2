import { useState } from "react";
import { ImageLightbox } from "@/shared/ui/ImageLightbox";

export function ClickableImage({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`View ${alt}`}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-48 max-w-xs rounded-lg object-contain"
        />
      </button>
      <ImageLightbox src={src} alt={alt} open={open} onOpenChange={setOpen} />
    </>
  );
}
