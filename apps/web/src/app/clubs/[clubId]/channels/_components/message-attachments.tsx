'use client';

import { createContext, useContext } from 'react';
import dynamic from 'next/dynamic';
import { FileText } from 'lucide-react';
import type { ViewerImage } from '@/components/media/image-viewer';
import type { ClubChannelMessage } from '@/components/clubs/types';
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from '@/components/ui/attachment';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { AnimatedGif } from '@/components/media/animated-gif';
import { isGifAttachment } from '~/apps/shared/chat/gifs';
import { cn } from '@/lib/utils';
import {
  formatWebAttachmentSize,
  isWebPreviewableImage,
} from '~/apps/shared/chat/attachments';

type ClubChannelMessageAttachment = ClubChannelMessage['attachments'][number];

function getAttachmentDescription(attachment: ClubChannelMessageAttachment) {
  const extension = attachment.fileName.split('.').pop()?.trim().toUpperCase();
  return [
    extension || (isWebPreviewableImage(attachment.mimeType, attachment.fileName) ? 'Image' : 'File'),
    formatWebAttachmentSize(attachment.size),
  ]
    .filter(Boolean)
    .join(' · ');
}

// Loaded on first open, so the viewer costs the chat nothing until then.
export const ImageViewer = dynamic(
  () =>
    import('@/components/media/image-viewer').then(
      (module) => module.ImageViewer,
    ),
  { ssr: false },
);

export type ImageViewerRequest = { images: ViewerImage[]; index: number };

/**
 * Opens the channel's single image viewer. It lives outside the message rows,
 * so their gestures and context menu never see its events.
 */
export const ImageViewerContext = createContext<(request: ImageViewerRequest) => void>(
  () => {},
);

function toViewerImage(attachment: ClubChannelMessageAttachment): ViewerImage {
  return {
    src: attachment.fileUrl,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
  };
}

function MessageAttachmentCard({
  attachment,
  fillAvailableWidth = false,
  onOpenImage,
}: {
  attachment: ClubChannelMessageAttachment;
  fillAvailableWidth?: boolean;
  onOpenImage?: () => void;
}) {
  const href = attachment.fileUrl;
  const isImage = isWebPreviewableImage(attachment.mimeType, attachment.fileName);

  if (isGifAttachment(attachment)) {
    return <AnimatedGif key={href} src={href} name={attachment.fileName} />;
  }

  return (
    <Attachment
      size="sm"
      orientation={isImage ? 'vertical' : 'horizontal'}
      className={cn(
        isImage
          ? fillAvailableWidth
            ? 'w-full! max-w-full has-data-[slot=attachment-content]:w-full'
            : 'w-fit! max-w-[85vw] sm:max-w-[min(100%,42rem)] has-data-[slot=attachment-content]:w-full'
          : fillAvailableWidth
            ? 'w-full max-w-full'
            : 'max-w-72',
      )}
    >
      {isImage ? (
        <div className="max-h-[min(60vh,32rem)] max-w-full overflow-hidden rounded-t-lg bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={href}
            alt={attachment.fileName}
            className={cn(
              'block h-auto max-h-[min(60vh,32rem)] max-w-full object-contain',
              fillAvailableWidth ? 'w-full' : 'w-auto',
            )}
          />
        </div>
      ) : (
        <AttachmentMedia>
          <FileText />
        </AttachmentMedia>
      )}
      <AttachmentContent>
        <AttachmentTitle>{attachment.fileName}</AttachmentTitle>
        <AttachmentDescription>
          {getAttachmentDescription(attachment)}
        </AttachmentDescription>
      </AttachmentContent>
      {isImage && onOpenImage ? (
        <AttachmentTrigger
          aria-label={`View ${attachment.fileName}`}
          onClick={onOpenImage}
        />
      ) : (
        <AttachmentTrigger
          asChild
          aria-label={`Open ${attachment.fileName} in a new tab`}
        >
          <a href={href} target="_blank" rel="noreferrer" />
        </AttachmentTrigger>
      )}
    </Attachment>
  );
}

export function MessageAttachments({
  attachments,
}: {
  attachments: ClubChannelMessageAttachment[];
}) {
  const openImageViewer = useContext(ImageViewerContext);
  if (attachments.length === 0) return null;

  // The viewer pages through this message's images, starting at the one tapped.
  const images = attachments.filter((attachment) =>
    isWebPreviewableImage(attachment.mimeType, attachment.fileName),
  );
  const openImage = (attachment: ClubChannelMessageAttachment) =>
    isWebPreviewableImage(attachment.mimeType, attachment.fileName)
      ? () =>
          openImageViewer({
            images: images.map(toViewerImage),
            index: images.findIndex((image) => image._id === attachment._id),
          })
      : undefined;

  if (attachments.length === 1) {
    return (
      <AttachmentGroup className="mt-2 max-w-full gap-2 py-0">
        <MessageAttachmentCard
          attachment={attachments[0]}
          onOpenImage={openImage(attachments[0])}
        />
      </AttachmentGroup>
    );
  }

  return (
    <MessageAttachmentGallery attachments={attachments} openImage={openImage} />
  );
}

function MessageAttachmentGallery({
  attachments,
  openImage,
}: {
  attachments: ClubChannelMessageAttachment[];
  openImage: (
    attachment: ClubChannelMessageAttachment,
  ) => (() => void) | undefined;
}) {
  return (
    // Swiping the gallery pages through attachments; it never starts a reply
    // or opens the club navigation.
    <section
      className="mt-2 max-w-full"
      aria-label={`${attachments.length} message attachments`}
      data-message-gallery
      data-swipe-navigation-ignore
    >
      <Carousel
        opts={{ align: 'start', containScroll: 'trimSnaps' }}
        className="max-w-full"
        aria-label="Message attachments"
      >
        <CarouselContent className="ml-0">
          {attachments.map((attachment, index) => (
            <CarouselItem
              key={attachment._id}
              // Own compositing layer per slide: iOS Safari otherwise can skip
              // painting an image that is translated into view.
              className="pl-0 [backface-visibility:hidden] [transform:translateZ(0)]"
              aria-label={`${index + 1} of ${attachments.length}: ${attachment.fileName}`}
            >
              <MessageAttachmentCard
                attachment={attachment}
                fillAvailableWidth
                onOpenImage={openImage(attachment)}
              />
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* Inside the gallery: the default outside offset widened the chat
            past the screen and let it scroll sideways on phones. */}
        <CarouselPrevious
          aria-label="Previous attachment"
          className="left-2 bg-background/85 shadow-sm backdrop-blur disabled:hidden"
        />
        <CarouselNext
          aria-label="Next attachment"
          className="right-2 bg-background/85 shadow-sm backdrop-blur disabled:hidden"
        />
      </Carousel>
    </section>
  );
}
