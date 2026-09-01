'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';

const VIEWPORT_SIZE = 288;
const OUTPUT_SIZE = 512;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

type AvatarCropDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string | null;
  fileName?: string;
  onConfirm: (file: File) => void | Promise<void>;
  confirming?: boolean;
};

function clampPan(
  pan: { x: number; y: number },
  zoom: number,
  baseScale: number,
  natural: { width: number; height: number },
): { x: number; y: number } {
  const w = natural.width * baseScale * zoom;
  const h = natural.height * baseScale * zoom;
  const maxX = Math.max(0, (w - VIEWPORT_SIZE) / 2);
  const maxY = Math.max(0, (h - VIEWPORT_SIZE) / 2);
  return {
    x: Math.max(-maxX, Math.min(maxX, pan.x)),
    y: Math.max(-maxY, Math.min(maxY, pan.y)),
  };
}

export function AvatarCropDialog({
  open,
  onOpenChange,
  imageSrc,
  fileName = 'avatar.jpg',
  onConfirm,
  confirming = false,
}: AvatarCropDialogProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; origin: { x: number; y: number } }>({
    active: false,
    startX: 0,
    startY: 0,
    origin: { x: 0, y: 0 },
  });

  // Reset when a new image is opened.
  useEffect(() => {
    if (open) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setLoaded(false);
      setNatural(null);
    }
  }, [imageSrc, open]);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    const w = el.naturalWidth;
    const h = el.naturalHeight;
    if (!w || !h) return;
    setNatural({ width: w, height: h });
    const scale = Math.max(VIEWPORT_SIZE / w, VIEWPORT_SIZE / h);
    setBaseScale(scale);
    setPan({ x: 0, y: 0 });
    setLoaded(true);
  }, []);

  const clampedPan = natural ? clampPan(pan, zoom, baseScale, natural) : pan;
  // Clamp lazily after zoom changes.
  useEffect(() => {
    if (!natural) return;
    const next = clampPan(pan, zoom, baseScale, natural);
    if (next.x !== pan.x || next.y !== pan.y) setPan(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, baseScale, natural]);

  const w = natural ? natural.width * baseScale * zoom : 0;
  const h = natural ? natural.height * baseScale * zoom : 0;
  const imgStyle = loaded
    ? {
        width: w,
        height: h,
        left: VIEWPORT_SIZE / 2 - w / 2 + clampedPan.x,
        top: VIEWPORT_SIZE / 2 - h / 2 + clampedPan.y,
      }
    : undefined;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!loaded || confirming) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        origin: { ...clampedPan },
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [clampedPan, confirming, loaded],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current.active || !natural) return;
      e.preventDefault();
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const next = clampPan(
        { x: dragRef.current.origin.x + dx, y: dragRef.current.origin.y + dy },
        zoom,
        baseScale,
        natural,
      );
      setPan(next);
    },
    [baseScale, natural, zoom],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current.active = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }, []);

  const handleZoomChange = useCallback(
    (value: number | [number, number]) => {
      const v = Array.isArray(value) ? value[0] : value;
      setZoom(Math.round(v * 20) / 20);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!imageSrc || !natural || !imgRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const scaleFactor = OUTPUT_SIZE / VIEWPORT_SIZE;
    const drawW = w * scaleFactor;
    const drawH = h * scaleFactor;
    const drawX = (VIEWPORT_SIZE / 2 - w / 2 + clampedPan.x) * scaleFactor;
    const drawY = (VIEWPORT_SIZE / 2 - h / 2 + clampedPan.y) * scaleFactor;
    // JPEG needs an opaque background; match page background rather than black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    // Use the loaded image element; drawImage respects natural pixels.
    ctx.drawImage(imgRef.current, drawX, drawY, drawW, drawH);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92),
    );
    if (!blob) return;
    const baseName = fileName.replace(/\.[^.]+$/, '') || 'avatar';
    const file = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
    await onConfirm(file);
  }, [clampedPan.x, clampedPan.y, fileName, h, imageSrc, natural, onConfirm, w]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="gap-0">
        <DialogHeader>
          <DialogTitle>Adjust picture</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div
            ref={viewportRef}
            className="relative mx-auto shrink-0 touch-none select-none overflow-hidden rounded-2xl border border-border bg-muted"
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE, cursor: loaded ? 'grab' : 'default' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            aria-label="Crop preview, drag to reposition"
            role="application"
          >
            {imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Preview"
                draggable={false}
                onLoad={handleImageLoad}
                className="absolute max-w-none select-none"
                style={imgStyle}
              />
            ) : null}
            {!loaded ? (
              <div className="absolute inset-0 grid place-items-center bg-muted">
                <span className="text-xs text-muted-foreground">Loading…</span>
              </div>
            ) : null}
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/10">
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <span
                    key={i}
                    className="border border-white/10"
                    style={{
                      borderLeftWidth: i % 3 === 0 ? 0 : 1,
                      borderTopWidth: i < 3 ? 0 : 1,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <Slider
            size="compact"
            value={zoom}
            onChange={handleZoomChange}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.05}
            label="Zoom"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            disabled={!loaded || confirming}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={!loaded || confirming} loading={confirming}>
            Save picture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
