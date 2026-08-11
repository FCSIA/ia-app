'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageSquareText, X } from 'lucide-react';
import { useAction, useMutation } from 'convex/react';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame, Panel } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileInput } from '@/components/ui/file-input';
import { useToast } from '@/hooks/use-toast';
import { uploadFileToConvex } from '@/lib/convex-upload';
import { api } from '~/apps/convex/src/_generated/api';

const MAX_FEEDBACK_CHARACTERS = 1_000;
const MAX_FEEDBACK_IMAGES = 3;
const MAX_FEEDBACK_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/gif', 'image/jpeg', 'image/png', 'image/webp']);

type SelectedImage = {
  file: File;
  previewUrl: string;
};

export default function ReportPage() {
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<SelectedImage[]>([]);
  const imageUrls = useRef(new Set<string>());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitReport = useMutation(api.moderation.reports.submit);
  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const finalizeFeedbackImage = useAction(api.uploads.files.finalizeFeedbackImage);
  const { toast } = useToast();
  const trimmedMessage = message.trim();

  useEffect(
    () => () => {
      imageUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  function addImage(file: File) {
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      toast({ title: 'Choose a PNG, JPEG, GIF, or WebP image', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_FEEDBACK_IMAGE_BYTES) {
      toast({ title: 'Each image must be 5 MB or smaller', variant: 'destructive' });
      return;
    }
    if (images.length >= MAX_FEEDBACK_IMAGES) {
      toast({ title: 'You can attach up to 3 images', variant: 'destructive' });
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    imageUrls.current.add(previewUrl);
    setImages((current) => [...current, { file, previewUrl }]);
  }

  function removeImage(index: number) {
    setImages((current) => {
      const image = current[index];
      if (image) {
        URL.revokeObjectURL(image.previewUrl);
        imageUrls.current.delete(image.previewUrl);
      }
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedMessage || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const imageUploadIds = await Promise.all(
        images.map(async ({ file }) => {
          const { storageId, uploadIntentId } = await uploadFileToConvex(
            { generateUploadUrl: () => generateUploadUrl({ purpose: 'FEEDBACK_IMAGE' }) },
            file,
          );
          const finalized = await finalizeFeedbackImage({ storageId, uploadIntentId });
          return finalized.imageUploadId;
        }),
      );
      await submitReport({
        contentType: 'GENERAL',
        contentId: 'report-page',
        reason: trimmedMessage,
        imageUploadIds,
      });
      setMessage('');
      setImages((current) => {
        current.forEach((image) => {
          URL.revokeObjectURL(image.previewUrl);
          imageUrls.current.delete(image.previewUrl);
        });
        return [];
      });
      toast({ title: 'Feedback sent', description: 'School staff will review it.' });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Unable to send feedback',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell>
      <PageFrame className="max-w-2xl">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageSquareText className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Share feedback</h1>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Send a thought, feature request, improvement idea, or concern. ANYTHING! Don&apos;t like a particular look for some icon? Want a feature for your particular club? Let us know!! Website maintainers will be quick to respond to your concerns.
            </p>
          </div>
        </div>

        <Panel title="What would you like to share?" tone="accent">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <Textarea
              aria-label="Share your feedback"
              placeholder="Share an idea, request, concern, or other feedback..."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={MAX_FEEDBACK_CHARACTERS}
              rows={7}
            />
            <div className="space-y-2">
              {images.length > 0 ? (
                <div className="flex flex-wrap gap-2" aria-label="Attached images">
                  {images.map((image, index) => (
                    <div key={image.previewUrl} className="relative size-20 overflow-hidden rounded-md border bg-muted">
                      <img src={image.previewUrl} alt={`Selected image ${index + 1}`} className="size-full object-cover" />
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="secondary"
                        aria-label={`Remove selected image ${index + 1}`}
                        className="absolute right-1 top-1"
                        disabled={isSubmitting}
                        onClick={() => removeImage(index)}
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
              <FileInput
                accept="image/png,image/jpeg,image/gif,image/webp"
                label="Attach image"
                disabled={images.length >= MAX_FEEDBACK_IMAGES || isSubmitting}
                onFileSelect={addImage}
              />
              <p className="text-xs text-muted-foreground">Up to 3 images, 5 MB each. PNG, JPEG, GIF, or WebP.</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {message.length}/{MAX_FEEDBACK_CHARACTERS}
              </p>
              <Button type="submit" disabled={!trimmedMessage || isSubmitting} loading={isSubmitting}>
                Send feedback
              </Button>
            </div>
          </form>
        </Panel>
      </PageFrame>
    </AppShell>
  );
}
