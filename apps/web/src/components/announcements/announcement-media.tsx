'use client';

import { Expand, Link as LinkIcon, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileInput } from '@/components/ui/file-input';
import { Input } from '@/components/ui/input';
import { AnimatedGif } from '@/components/media/animated-gif';

const ImageViewer = dynamic(
  () =>
    import('@/components/media/image-viewer').then(
      (module) => module.ImageViewer,
    ),
  { ssr: false },
);

export const MAX_ANNOUNCEMENT_IMAGES = 3;
export const MAX_ANNOUNCEMENT_EMBEDS = 3;
export const MAX_ANNOUNCEMENT_IMAGE_BYTES = 5 * 1024 * 1024;
export const ANNOUNCEMENT_IMAGE_ACCEPT =
  'image/png,image/jpeg,image/gif,image/webp';

const acceptedImageTypes = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

type AnnouncementMediaInputProps = {
  images: File[];
  embedUrls: string[];
  disabled?: boolean;
  onImagesChange: (images: File[]) => void;
  onEmbedUrlsChange: (embedUrls: string[]) => void;
  onError: (message: string) => void;
};

export function AnnouncementMediaInput({
  images,
  embedUrls,
  disabled,
  onImagesChange,
  onEmbedUrlsChange,
  onError,
}: AnnouncementMediaInputProps) {
  const [embedUrl, setEmbedUrl] = useState('');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <FileInput
          accept={ANNOUNCEMENT_IMAGE_ACCEPT}
          label="Add image"
          disabled={disabled || images.length >= MAX_ANNOUNCEMENT_IMAGES}
          onFileSelect={(file) => {
            if (!acceptedImageTypes.has(file.type)) {
              onError('Choose a PNG, JPEG, GIF, or WebP image');
              return;
            }
            if (file.size > MAX_ANNOUNCEMENT_IMAGE_BYTES) {
              onError('Each image must be 5 MB or smaller');
              return;
            }
            onImagesChange([...images, file]);
          }}
        />
        <span className="text-xs text-muted-foreground">
          {images.length}/{MAX_ANNOUNCEMENT_IMAGES} images
        </span>
      </div>

      {images.length > 0 ? (
        <div
          className="flex flex-wrap gap-2"
          aria-label="Selected announcement images"
        >
          {images.map((image, index) => (
            <div
              key={`${image.name}-${image.lastModified}-${index}`}
              className="flex max-w-full items-center gap-2 rounded-md border bg-muted/20 px-2 py-1.5 text-xs"
            >
              <span className="max-w-48 truncate">{image.name}</span>
              <Button
                type="button"
                size="icon-compact"
                variant="ghost"
                aria-label={`Remove ${image.name}`}
                disabled={disabled}
                onClick={() =>
                  onImagesChange(
                    images.filter((_, currentIndex) => currentIndex !== index),
                  )
                }
              >
                <X />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Input
          type="url"
          value={embedUrl}
          aria-label="Add an HTTPS link embed"
          placeholder="Paste an HTTPS link to embed"
          disabled={disabled || embedUrls.length >= MAX_ANNOUNCEMENT_EMBEDS}
          onChange={(event) => setEmbedUrl(event.target.value)}
        />
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          disabled={
            disabled ||
            !embedUrl.trim() ||
            embedUrls.length >= MAX_ANNOUNCEMENT_EMBEDS
          }
          onClick={() => {
            if (!/^https:\/\//i.test(embedUrl.trim())) {
              onError('Embedded links must use HTTPS');
              return;
            }
            onEmbedUrlsChange([...embedUrls, embedUrl.trim()]);
            setEmbedUrl('');
          }}
        >
          Add link
        </Button>
      </div>
      {embedUrls.length > 0 ? (
        <div className="space-y-1.5" aria-label="Embedded links">
          {embedUrls.map((url, index) => (
            <div
              key={url}
              className="flex min-w-0 items-center gap-2 rounded-md border bg-muted/20 px-2 py-1.5 text-xs"
            >
              <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{url}</span>
              <Button
                type="button"
                size="icon-compact"
                variant="ghost"
                aria-label={`Remove embedded link ${index + 1}`}
                disabled={disabled}
                onClick={() =>
                  onEmbedUrlsChange(
                    embedUrls.filter(
                      (_, currentIndex) => currentIndex !== index,
                    ),
                  )
                }
              >
                <X />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AnnouncementMedia({
  images = [],
  embedUrls = [],
}: {
  images?: Array<{ _id: string; url: string; mimeType: string; size: number }>;
  embedUrls?: string[];
}) {
  const [viewer, setViewer] = useState<{ index: number; open: boolean } | null>(
    null,
  );
  if (images.length === 0 && embedUrls.length === 0) return null;
  return (
    <div className="space-y-3">
      {images.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {images.map((image, index) =>
            image.mimeType.toLowerCase().split(';', 1)[0] === 'image/gif' ? (
              <div key={image._id} className="group relative">
                <AnimatedGif
                  src={image.url}
                  name={`Announcement image ${index + 1}`}
                  maxHeight={512}
                  fullWidth
                  active={!viewer?.open}
                  className="my-0 overflow-hidden rounded-lg border bg-muted/20"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  aria-label={`Open announcement image ${index + 1}`}
                  className="absolute right-2 top-2"
                  onClick={() => setViewer({ index, open: true })}
                >
                  <Expand />
                </Button>
              </div>
            ) : (
              <button
                key={image._id}
                type="button"
                aria-label={`Open announcement image ${index + 1}`}
                className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setViewer({ index, open: true })}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={`Announcement image ${index + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="max-h-[32rem] w-full rounded-lg border bg-muted/20 object-contain"
                />
              </button>
            ),
          )}
        </div>
      ) : null}
      {embedUrls.length > 0 ? (
        <div className="grid gap-2">
          {embedUrls.map((url) => {
            const hostname = new URL(url).hostname;
            return (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm transition-colors hover:bg-hover"
              >
                <LinkIcon className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {hostname}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  Open link
                </span>
              </a>
            );
          })}
        </div>
      ) : null}
      {viewer ? (
        <ImageViewer
          images={images.map((image, index) => ({
            src: image.url,
            fileName: `Announcement image ${index + 1}`,
            mimeType: image.mimeType,
          }))}
          index={viewer.index}
          open={viewer.open}
          onClose={() =>
            setViewer((current) => current && { ...current, open: false })
          }
        />
      ) : null}
    </div>
  );
}
