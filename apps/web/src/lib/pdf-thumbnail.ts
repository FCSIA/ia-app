// ─── Lazy pdfjs loader ────────────────────────────────────────────────────
// Imports pdfjs-dist on first PDF, caches the module, and points the worker
// at the same-origin worker copied from the installed version before builds.
type PdfjsModule = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfjsModule> | null = null;
let pdfWorkerSrc = "/pdf-assets/pdf.worker.min.mjs";

export function setPdfWorkerSrc(src: string) {
  pdfWorkerSrc = src;
  // Already loaded: retarget it, so the next PDF uses the new worker.
  void pdfjsPromise?.then(
    (mod) => { mod.GlobalWorkerOptions.workerSrc = src; },
    () => {}, // The renderer owns reporting a failed lazy import.
  );
}

async function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist")
      .then((mod) => {
        mod.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
        return mod;
      })
      .catch((error) => {
        pdfjsPromise = null; // A failed lazy load must not poison future retries.
        throw error;
      });
  }
  return pdfjsPromise;
}

export async function renderPdfFirstPage(file: File, targetWidth: number, signal?: AbortSignal): Promise<string> {
  const pdfjs = await loadPdfjs();
  signal?.throwIfAborted();
  const buffer = await file.arrayBuffer();
  signal?.throwIfAborted();
  const loading = pdfjs.getDocument({ data: buffer });
  let cancelRender: (() => void) | undefined;
  let destruction: Promise<void> | undefined;
  const destroy = () => destruction ??= loading.destroy();
  const abort = () => {
    cancelRender?.();
    void destroy().catch(() => {});
  };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const pdf = await loading.promise;
    signal?.throwIfAborted();
    const page = await pdf.getPage(1);
    signal?.throwIfAborted();
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: (targetWidth * 2) / baseViewport.width });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const task = page.render({ canvas, viewport });
    cancelRender = () => task.cancel();
    await task.promise;
    signal?.throwIfAborted();
    return canvas.toDataURL("image/png");
  } finally {
    signal?.removeEventListener("abort", abort);
    await destroy();
  }
}
