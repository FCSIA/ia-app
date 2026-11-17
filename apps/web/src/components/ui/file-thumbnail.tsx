"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useShape } from "@/lib/shape-context";

// ─── File thumbnail ───────────────────────────────────────────────────────
// Read-only square preview of a File. Images use object-cover via
// `URL.createObjectURL`; the optional PDF renderer supplies its first page. While a preview is
// resolving a spinner is shown. Self-contained (border + surface + sizing) so
// it can be reused both inside the composer's preview row and to render
// already-sent attachments in a chat transcript.
interface FileThumbnailProps {
  file: File;
  /** Side length of the square thumbnail in pixels. */
  size: number;
  className?: string;
  /** Optional enhancement. The base image/file preview has no PDF dependency. */
  renderPdf?: (file: File, width: number, signal: AbortSignal) => Promise<string>;
}

function FileThumbnail({ file, size, className, renderPdf }: FileThumbnailProps) {
  const shape = useShape();
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";

  // Create blob URL inside an effect (NOT useMemo) so the cleanup-revoke
  // and the URL-creation stay in sync. In React 18 StrictMode dev, a
  // useMemo-created URL gets revoked by the simulated effect-cleanup but
  // useMemo doesn't re-run on the simulated re-mount (no re-render happens),
  // leaving the DOM with a stale, revoked `blob:` URL — broken image.
  // Putting both in the same effect means the simulated re-mount creates a
  // fresh URL and updates state. The one-frame "before URL" state is
  // covered by the bg-accent (no fallback icon shown for images), so the
  // transition is visually clean.
  const [imagePreview, setImagePreview] = useState<{ file: File; url: string } | null>(null);
  const imageUrl = imagePreview?.file === file ? imagePreview.url : null;
  useEffect(() => {
    if (!isImage) {
      // Clear stale state if the `file` prop swaps type on the same mount —
      // otherwise a revoked blob URL would keep winning over the new preview.
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImagePreview({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [isImage, file]);

  // PDFs need async rendering — loading flash is unavoidable for the first
  // ~100–300ms while pdfjs loads. Falls back to the generic icon on error
  // (corrupt/password-protected file, unavailable worker).
  const [pdfPreview, setPdfPreview] = useState<{ file: File; size: number; url: string } | null>(null);
  const pdfUrl = pdfPreview?.file === file && pdfPreview.size === size ? pdfPreview.url : null;
  const [pdfError, setPdfError] = useState(false);
  useEffect(() => {
    setPdfError(false);
    setPdfPreview(null);
    if (!isPdf || !renderPdf) return;
    const controller = new AbortController();
    renderPdf(file, size, controller.signal)
      .then((url) => {
        if (!controller.signal.aborted) setPdfPreview({ file, size, url });
      })
      .catch(() => {
        if (!controller.signal.aborted) setPdfError(true);
      });
    return () => {
      controller.abort();
    };
  }, [file, isPdf, size, renderPdf]);

  const previewUrl = imageUrl ?? pdfUrl;
  // Spinner only while a preview is genuinely pending; anything that can't
  // produce one (failed PDF, unsupported type) gets the generic icon instead.
  const isPending = (isImage && !imageUrl) || (isPdf && !!renderPdf && !pdfUrl && !pdfError);

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden bg-accent border border-border",
        shape.bg,
        className
      )}
      style={{ width: size, height: size }}
    >
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={file.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : isPending ? (
        // Circular spinner while we wait for the preview to be ready.
        // Used for both images (brief URL-creation gap) and PDFs (longer
        // pdfjs render). The thin ring is mostly subtle (border-border)
        // with one quadrant accented (border-t-muted-foreground) so the
        // `animate-spin` rotation reads as a moving arc.
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-6 h-6 rounded-full border-2 border-border border-t-muted-foreground animate-spin motion-reduce:animate-none"
            aria-label="Loading preview"
            role="status"
          />
        </div>
      ) : (
        // Generic document glyph for files with no renderable preview.
        // Inline SVG (not the icon system) so the thumbnail stays
        // self-contained for registry consumers.
        <div
          className="absolute inset-0 flex items-center justify-center text-muted-foreground"
          role="img"
          aria-label={file.name}
        >
          <svg
            width={Math.max(16, size * 0.35)}
            height={Math.max(16, size * 0.35)}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5" />
          </svg>
        </div>
      )}
    </div>
  );
}

export { FileThumbnail };
export type { FileThumbnailProps };
