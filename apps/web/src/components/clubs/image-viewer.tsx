'use client';

import { ExternalLink, Share } from 'lucide-react';
import Lightbox, { IconButton, useLightboxState } from 'yet-another-react-lightbox';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/counter.css';
import { useTouchPrimary } from '@/hooks/use-touch-primary';
import { useToast } from '@/hooks/use-toast';
import { canShareFile, shareFile, shareUrl } from '@/lib/share';

declare module 'yet-another-react-lightbox' {
  interface Labels {
    Share?: string;
    'Open original'?: string;
  }
}

export type ViewerImage = {
  src: string;
  fileName: string;
  mimeType?: string;
};

// Each image is fetched once when it comes on screen, so Share can hand the
// file itself to the share sheet inside the tap. Until it arrives, or where
// the fetch fails, Share falls back to the link.
const imageFiles = new Map<string, File | null>();
const imageFilesLoading = new Set<string>();

function prefetchImageFile(image: ViewerImage | undefined) {
  if (!image || imageFiles.has(image.src) || imageFilesLoading.has(image.src)) return;
  imageFilesLoading.add(image.src);
  void fetch(image.src)
    .then((response) => (response.ok ? response.blob() : null))
    .then((blob) =>
      blob
        ? new File([blob], image.fileName, { type: image.mimeType || blob.type || 'image/png' })
        : null,
    )
    .catch(() => null)
    .then((file) => {
      imageFiles.set(image.src, file);
      imageFilesLoading.delete(image.src);
    });
}

function ShareImageButton({ images }: { images: ViewerImage[] }) {
  const { currentIndex } = useLightboxState();
  const image = images[currentIndex];
  const { toast } = useToast();

  if (!image) return null;

  return (
    <IconButton
      label="Share"
      icon={Share}
      onClick={() => {
        // Decided synchronously: the share sheet needs the tap's activation.
        const file = imageFiles.get(image.src);
        const sharing =
          file && canShareFile(file)
            ? shareFile(file, { title: image.fileName })
            : shareUrl({ title: image.fileName, url: image.src });
        sharing.then(
          (result) => {
            if (result === 'copied') toast({ title: 'Image link copied' });
          },
          () => toast({ title: "Couldn't share the image", variant: 'destructive' }),
        );
      }}
    />
  );
}

function OpenOriginalButton({ images }: { images: ViewerImage[] }) {
  const { currentIndex } = useLightboxState();
  const image = images[currentIndex];
  if (!image) return null;
  return (
    <IconButton
      label="Open original"
      icon={ExternalLink}
      onClick={() => window.open(image.src, '_blank', 'noopener,noreferrer')}
    />
  );
}

/**
 * Full-screen viewer for chat images: swipe between a message's images, pinch
 * or double-tap to zoom, and pull down to close, without leaving the app.
 */
export function ImageViewer({
  images,
  index,
  open,
  onClose,
}: {
  images: ViewerImage[];
  index: number;
  open: boolean;
  onClose: () => void;
}) {
  const isTouchPrimary = useTouchPrimary();
  const single = images.length <= 1;

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index}
      slides={images.map((image) => ({ src: image.src, alt: image.fileName }))}
      plugins={single ? [Zoom] : [Zoom, Counter]}
      carousel={{ finite: true, preload: 1, padding: 0, spacing: 16 }}
      animation={{ fade: 200, swipe: 260, zoom: 220 }}
      controller={{ closeOnPullDown: true, closeOnBackdropClick: true }}
      on={{
        entering: () => prefetchImageFile(images[index]),
        view: ({ index: viewed }) => prefetchImageFile(images[viewed]),
      }}
      zoom={{ maxZoomPixelRatio: 3, scrollToZoom: true }}
      toolbar={{
        buttons: [
          <ShareImageButton key="share" images={images} />,
          <OpenOriginalButton key="open" images={images} />,
          'close',
        ],
      }}
      render={{
        // Touch has pinch and swipe; the buttons are for pointers.
        buttonZoom: isTouchPrimary ? () => null : undefined,
        buttonPrev: single || isTouchPrimary ? () => null : undefined,
        buttonNext: single || isTouchPrimary ? () => null : undefined,
      }}
      labels={{ Close: 'Close viewer' }}
      styles={{
        // Under the app's toasts, so a "copied" toast stays visible.
        root: {
          '--yarl__portal_zindex': 90,
          '--yarl__color_backdrop': 'rgb(0 0 0 / 0.94)',
          '--yarl__counter_top': 'env(safe-area-inset-top, 0px)',
          '--yarl__counter_left': 'env(safe-area-inset-left, 0px)',
        },
        // Clear of the status bar and notch in the installed app.
        toolbar: {
          top: 'env(safe-area-inset-top, 0px)',
          right: 'env(safe-area-inset-right, 0px)',
        },
      }}
    />
  );
}
