'use client';

import { useCallback, useEffect, useRef } from 'react';
import { exportToBlob } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useMutation } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';

/** Wait after the last local save before rendering a new list preview. */
const THUMBNAIL_DELAY_MS = 4_000;
const THUMBNAIL_MAX_CHARACTERS = 60_000;

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Debounced list-preview rendering for a board. Previews are best effort; the
 * board itself is already saved when one is scheduled.
 */
export function useWhiteboardThumbnail(
  boardId: Id<'clubWhiteboards'>,
  excalidrawAPI: ExcalidrawImperativeAPI | null,
) {
  const setThumbnail = useMutation(api.clubs.whiteboards.setThumbnail);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const render = useCallback(async () => {
    timer.current = null;
    if (!excalidrawAPI) return;
    const elements = excalidrawAPI.getSceneElements();
    if (elements.length === 0) return;
    const exportAt = async (maxWidthOrHeight: number) =>
      blobToDataUrl(
        await exportToBlob({
          elements,
          appState: { exportBackground: true, viewBackgroundColor: '#ffffff' },
          files: null,
          mimeType: 'image/webp',
          quality: 0.7,
          exportPadding: 24,
          maxWidthOrHeight,
        }),
      );
    try {
      // Dense boards can exceed the stored size at full preview width; a
      // half-size render is always small enough for the list card.
      let dataUrl = await exportAt(480);
      if (dataUrl.length > THUMBNAIL_MAX_CHARACTERS) dataUrl = await exportAt(240);
      if (dataUrl.length <= THUMBNAIL_MAX_CHARACTERS) {
        await setThumbnail({ boardId, dataUrl });
      }
    } catch {
      // Best effort: the next save schedules another attempt.
    }
  }, [boardId, excalidrawAPI, setThumbnail]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void render(), THUMBNAIL_DELAY_MS);
  }, [render]);
}
