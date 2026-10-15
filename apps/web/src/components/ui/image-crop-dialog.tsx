'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';

const VIEWPORT_WIDTH = 288;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

type CropDimensions = {
  width: number;
  height: number;
};

type ImageCropDialogProps = {
  aspectRatio?: number;
  confirming?: boolean;
  fileName?: string;
  imageSrc: string | null;
  onConfirm: (file: File) => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  outputWidth?: number;
  saveLabel?: string;
  title?: string;
};

function clampPan(
  pan: { x: number; y: number },
  zoom: number,
  baseScale: number,
  natural: CropDimensions,
  viewport: CropDimensions,
): { x: number; y: number } {
  const width = natural.width * baseScale * zoom;
  const height = natural.height * baseScale * zoom;
  const maxX = Math.max(0, (width - viewport.width) / 2);
  const maxY = Math.max(0, (height - viewport.height) / 2);
  return {
    x: Math.max(-maxX, Math.min(maxX, pan.x)),
    y: Math.max(-maxY, Math.min(maxY, pan.y)),
  };
}

export function ImageCropDialog({
  aspectRatio = 1,
  confirming = false,
  fileName = 'image.jpg',
  imageSrc,
  onConfirm,
  onOpenChange,
  open,
  outputWidth = 512,
  saveLabel = 'Save picture',
  title = 'Adjust picture',
}: ImageCropDialogProps) {
  const cropAspectRatio = aspectRatio > 0 ? aspectRatio : 1;
  const viewport = useMemo(
    () => ({
      width: VIEWPORT_WIDTH,
      height: Math.round(VIEWPORT_WIDTH / cropAspectRatio),
    }),
    [cropAspectRatio],
  );
  const output = useMemo(
    () => ({
      width: outputWidth,
      height: Math.round(outputWidth / cropAspectRatio),
    }),
    [cropAspectRatio, outputWidth],
  );
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState<CropDimensions | null>(null);
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origin: { x: number; y: number };
  }>({
    active: false,
    startX: 0,
    startY: 0,
    origin: { x: 0, y: 0 },
  });

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setLoaded(false);
    setNatural(null);
  }, [imageSrc, open]);

  const handleImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const image = event.currentTarget;
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      if (!width || !height) return;
      setNatural({ width, height });
      setBaseScale(Math.max(viewport.width / width, viewport.height / height));
      setPan({ x: 0, y: 0 });
      setLoaded(true);
    },
    [viewport.height, viewport.width],
  );

  const clampedPan = natural
    ? clampPan(pan, zoom, baseScale, natural, viewport)
    : pan;

  useEffect(() => {
    if (!natural) return;
    const next = clampPan(pan, zoom, baseScale, natural, viewport);
    if (next.x !== pan.x || next.y !== pan.y) setPan(next);
  }, [baseScale, natural, pan, viewport, zoom]);

  const width = natural ? natural.width * baseScale * zoom : 0;
  const height = natural ? natural.height * baseScale * zoom : 0;
  const imageStyle = loaded
    ? {
        width,
        height,
        left: viewport.width / 2 - width / 2 + clampedPan.x,
        top: viewport.height / 2 - height / 2 + clampedPan.y,
      }
    : undefined;

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!loaded || confirming) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      dragRef.current = {
        active: true,
        startX: event.clientX,
        startY: event.clientY,
        origin: { ...clampedPan },
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [clampedPan, confirming, loaded],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!dragRef.current.active || !natural) return;
      event.preventDefault();
      setPan(
        clampPan(
          {
            x: dragRef.current.origin.x + event.clientX - dragRef.current.startX,
            y: dragRef.current.origin.y + event.clientY - dragRef.current.startY,
          },
          zoom,
          baseScale,
          natural,
          viewport,
        ),
      );
    },
    [baseScale, natural, viewport, zoom],
  );

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    dragRef.current.active = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may have been released outside the crop surface.
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!imageSrc || !natural || !imageRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = output.width;
    canvas.height = output.height;
    const context = canvas.getContext('2d');
    if (!context) return;
    const scaleFactor = output.width / viewport.width;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(
      imageRef.current,
      (viewport.width / 2 - width / 2 + clampedPan.x) * scaleFactor,
      (viewport.height / 2 - height / 2 + clampedPan.y) * scaleFactor,
      width * scaleFactor,
      height * scaleFactor,
    );
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    );
    if (!blob) return;
    const baseName = fileName.replace(/\.[^.]+$/, '') || 'image';
    await onConfirm(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }));
  }, [clampedPan.x, clampedPan.y, fileName, height, imageSrc, natural, onConfirm, output.height, output.width, viewport.height, viewport.width, width]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="gap-0">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div
            className="relative mx-auto shrink-0 touch-none select-none overflow-hidden rounded-2xl border border-border bg-muted"
            style={{
              width: viewport.width,
              height: viewport.height,
              cursor: loaded ? 'grab' : 'default',
            }}
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
                ref={imageRef}
                src={imageSrc}
                alt="Preview"
                draggable={false}
                onLoad={handleImageLoad}
                className="absolute max-w-none select-none"
                style={imageStyle}
              />
            ) : null}
            {!loaded ? (
              <div className="absolute inset-0 grid place-items-center bg-muted">
                <span className="text-xs text-muted-foreground">Loading…</span>
              </div>
            ) : null}
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/10">
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }).map((_, index) => (
                  <span
                    key={index}
                    className="border border-white/10"
                    style={{
                      borderLeftWidth: index % 3 === 0 ? 0 : 1,
                      borderTopWidth: index < 3 ? 0 : 1,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <Slider
            size="compact"
            value={zoom}
            onChange={(value) => setZoom(Math.round((Array.isArray(value) ? value[0] : value) * 20) / 20)}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.05}
            label="Zoom"
            formatValue={(value) => `${Math.round(value * 100)}%`}
            disabled={!loaded || confirming}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={confirming}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={!loaded || confirming} loading={confirming}>
            {saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
