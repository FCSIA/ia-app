'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MessageSquareText, X } from 'lucide-react';
import { useAction, useMutation, useQuery } from '@/lib/convex-react';
import { formatDistanceToNow } from 'date-fns';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame } from '@/components/layout/page-frame';
import { Card, CardGroup, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileInput } from '@/components/ui/file-input';
import { useToast } from '@/hooks/use-toast';
import { uploadFileToConvex } from '@/lib/convex-upload';
import { api } from '~/apps/convex/src/_generated/api';
import { APP_VERSION, RELEASE_CHANNEL, formatVersion } from '@ia/devlog';
import { CARD_SURFACE_FOREGROUND } from '@/lib/surface-classes';

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
  const myFeedback = useQuery(api.moderation.reports.listMyFeedback) ?? [];
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
        appVersion: formatVersion(APP_VERSION, RELEASE_CHANNEL),
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
        <CardGroup border="outlined" className={`overflow-hidden border-border bg-card ${CARD_SURFACE_FOREGROUND}`}>
          <Card className="bg-transparent">
            <CardContent className="px-4 py-4 md:p-6">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MessageSquareText className="size-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">Share feedback</h1>
                  <p className="mt-1 text-sm leading-6 text-foreground/85">
                    Send a thought, feature request, improvement idea, or concern. ANYTHING! Don&apos;t like a particular look for some icon? Want a feature for your particular club? Let us know!! Website maintainers will be quick to respond to your concerns.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardGroup>

        <CardGroup border="outlined" className={`overflow-hidden border-border bg-card ${CARD_SURFACE_FOREGROUND}`}>
          <Card className="bg-transparent">
            <CardHeader className="pb-3 border-b border-border/40 mb-4">
              <CardTitle className="text-lg font-semibold text-foreground">What would you like to share?</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <Textarea
              aria-label="Share your feedback"
              placeholder="Share an idea, request, concern, or other feedback..."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={MAX_FEEDBACK_CHARACTERS}
              rows={7}
              className="border-border/80 bg-background/75 text-foreground placeholder:text-foreground/65 focus-visible:bg-background/90"
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
              <p className="text-xs text-foreground/80">Up to 3 images, 5 MB each. PNG, JPEG, GIF, or WebP.</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-foreground/80">
                {message.length}/{MAX_FEEDBACK_CHARACTERS}
              </p>
              <Button type="submit" disabled={!trimmedMessage || isSubmitting} loading={isSubmitting}>
                Send feedback
              </Button>
            </div>
            <p className="text-xs leading-5 text-foreground/80">
              We&apos;ll include your app version,{' '}
              <Link href="/profile?section=whats-new" className="font-medium text-foreground underline underline-offset-4">
                {formatVersion(APP_VERSION, RELEASE_CHANNEL)}
              </Link>
              , with this feedback.
            </p>
          </form>
            </CardContent>
          </Card>
        </CardGroup>

        <CardGroup border="outlined" className={`overflow-hidden border-border bg-card ${CARD_SURFACE_FOREGROUND}`}>
          <Card className="bg-transparent">
            <CardHeader className="pb-3 border-b border-border/40 mb-4">
              <CardTitle className="text-lg font-semibold text-foreground">Your feedback</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
          {myFeedback.length === 0 ? (
            <p className="text-sm text-foreground/85">Your submitted feedback and staff responses will appear here.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {myFeedback.map((feedback) => (
                <article key={feedback._id} className="p-3">
                  <p className="whitespace-pre-wrap text-sm text-foreground">{feedback.reason}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {feedback.status.toLowerCase()} · {formatDistanceToNow(new Date(feedback.createdAt), { addSuffix: true })}
                  </p>
                  {feedback.reviewNote ? (
                    <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-sm text-foreground">
                      {feedback.reviewNote}
                    </div>
                  ) : null}
                  {feedback.responses.map((response) => (
                    <div key={response._id} className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-sm">
                      <p className="text-xs font-medium text-muted-foreground">School staff</p>
                      <p className="mt-1 whitespace-pre-wrap text-foreground">{response.body}</p>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-foreground/80">Staff responses are one-way; submit a new feedback item for anything else.</p>
            </CardContent>
          </Card>
        </CardGroup>
      </PageFrame>
    </AppShell>
  );
}
