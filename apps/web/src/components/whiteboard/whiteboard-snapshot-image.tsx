'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type WhiteboardSnapshotImageProps = {
  /** Serialized Excalidraw elements, as stored on the server. */
  elements: string[];
  label: string;
  className?: string;
};

/**
 * Renders stored elements as a static image without mounting the editor, for
 * version previews and audit review.
 */
export function WhiteboardSnapshotImage({ elements, label, className }: WhiteboardSnapshotImageProps) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const target = container.current;
    if (!target) return;
    let cancelled = false;
    setFailed(false);
    if (elements.length === 0) {
      target.replaceChildren();
      return;
    }
    void (async () => {
      try {
        window.EXCALIDRAW_ASSET_PATH = '/excalidraw-assets/';
        const { exportToSvg, restoreElements } = await import('@excalidraw/excalidraw');
        const svg = await exportToSvg({
          elements: restoreElements(
            elements.map((data) => JSON.parse(data)),
            null,
          ),
          appState: { exportBackground: true, viewBackgroundColor: '#ffffff' },
          files: null,
          exportPadding: 16,
        });
        if (cancelled) return;
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', label);
        target.replaceChildren(svg);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [elements, label]);

  return (
    <div className={cn('relative overflow-hidden rounded-lg border bg-white', className)}>
      <div ref={container} className="size-full" />
      {elements.length === 0 || failed ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500">
          {failed ? 'This version could not be shown.' : 'Empty board'}
        </div>
      ) : null}
    </div>
  );
}
