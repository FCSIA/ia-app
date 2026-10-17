'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useAction, useMutation, useQuery } from '@/lib/convex-react';
import { formatDistanceToNow } from 'date-fns';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { BugHunterTag } from '@/components/recognition/bug-hunter-tag';
import { FileInput } from '@/components/ui/file-input';
import { useToast } from '@/hooks/use-toast';
import { uploadFileToConvex } from '@/lib/convex-upload';
import { api } from '~/apps/convex/src/_generated/api';
import { APP_VERSION, RELEASE_CHANNEL, formatVersion } from '@ia/devlog';
import { CARD_SURFACE_FOREGROUND } from '@/lib/surface-classes';
import { useShape } from '@/lib/shape-context';
import { cn } from '@/lib/utils';

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
  const [feedbackKind, setFeedbackKind] = useState<'BUG' | 'OTHER'>('OTHER');
  const [images, setImages] = useState<SelectedImage[]>([]);
  const imageUrls = useRef(new Set<string>());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitReport = useMutation(api.moderation.reports.submit);
  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const finalizeFeedbackImage = useAction(api.uploads.files.finalizeFeedbackImage);
  const myFeedback = useQuery(api.moderation.reports.listMyFeedback);
  const bugReward = useQuery(api.moderation.bugRewards.myReward);
  const shape = useShape();
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
        feedbackKind,
        imageUploadIds,
        appVersion: formatVersion(APP_VERSION, RELEASE_CHANNEL),
      });
      setMessage('');
      setFeedbackKind('OTHER');
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
    <AppShell headerSlot={<h1 className="text-lg font-semibold tracking-tight text-foreground">Feedback</h1>}>
      <PageFrame className="max-w-2xl gap-8">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-3">
            <label htmlFor="feedback-message" className="text-sm font-semibold text-foreground">
              What would you like to change?
            </label>
            <label htmlFor="feedback-kind" className="text-sm font-medium text-foreground">Feedback type</label>
            <Select value={feedbackKind} onValueChange={(value) => setFeedbackKind(value as 'BUG' | 'OTHER')}>
              <SelectTrigger id="feedback-kind" placeholder="Choose feedback type" />
              <SelectContent>
                <SelectItem value="OTHER" index={0}>Idea or other feedback</SelectItem>
                <SelectItem value="BUG" index={1}>Bug report</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Only bugs confirmed by a developer count toward Bug Hunter tags.</p>
            <Textarea
              id="feedback-message"
              placeholder="Describe an issue or suggest an improvement…"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={MAX_FEEDBACK_CHARACTERS}
              rows={7}
              required
              disabled={isSubmitting}
              aria-describedby="feedback-character-count"
            />
          </div>
          {images.length > 0 ? (
            <div className="flex flex-wrap gap-3" aria-label="Attached images">
              {images.map((image, index) => (
                <div key={image.previewUrl} className="relative size-20 overflow-hidden rounded-md bg-muted">
                  <img src={image.previewUrl} alt={image.file.name} className="size-full object-cover" />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="secondary"
                    aria-label={`Remove ${image.file.name}`}
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FileInput
              accept="image/png,image/jpeg,image/gif,image/webp"
              label={images.length ? `Attach image (${images.length}/${MAX_FEEDBACK_IMAGES})` : 'Attach image'}
              disabled={images.length >= MAX_FEEDBACK_IMAGES || isSubmitting}
              onFileSelect={addImage}
              aria-describedby="feedback-image-limits"
            />
            <p id="feedback-character-count" className="text-xs tabular-nums text-muted-foreground">
              {message.length}/{MAX_FEEDBACK_CHARACTERS}
            </p>
          </div>
          <p id="feedback-image-limits" className="text-xs text-muted-foreground">
            Up to 3 images, 5 MB each · PNG, JPEG, GIF, WebP
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Version{' '}
              <Link href="/profile?section=whats-new" className="underline underline-offset-4">
                {formatVersion(APP_VERSION, RELEASE_CHANNEL)}
              </Link>{' '}
              included
            </p>
            <Button type="submit" disabled={!trimmedMessage || isSubmitting} loading={isSubmitting}>
              Send feedback
            </Button>
          </div>
        </form>

        <section className="flex flex-col gap-3" aria-labelledby="feedback-history-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="feedback-history-title" className="text-sm font-semibold text-foreground">Your feedback</h2>
            {bugReward ? <BugHunterTag user={{ approvedBugCount: bugReward.approvedCount, bugTagColor: bugReward.color }} /> : null}
          </div>
          {myFeedback === undefined ? (
            <p className="text-sm text-muted-foreground" role="status">Loading feedback…</p>
          ) : myFeedback.length === 0 ? (
            <p className="text-sm text-muted-foreground">No feedback submitted yet.</p>
          ) : (
            <div className={cn('divide-y divide-border/30 border border-border/50 bg-card', CARD_SURFACE_FOREGROUND, shape.mergedBg)}>
              {myFeedback.map((feedback) => (
                <article key={feedback._id} className="flex min-w-0 flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <p>{feedback.status === 'PENDING' ? 'Awaiting review' : feedback.status === 'RESOLVED' ? 'Resolved' : 'Closed'}</p>
                    <time dateTime={new Date(feedback.createdAt).toISOString()}>
                      {formatDistanceToNow(new Date(feedback.createdAt), { addSuffix: true })}
                    </time>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground">{feedback.reason}</p>
                  {feedback.feedbackKind === 'BUG' ? (
                    <p className="text-xs text-muted-foreground">{feedback.bugApprovedAt ? 'Developer-approved bug' : 'Bug awaiting developer approval'}</p>
                  ) : null}
                  {feedback.reviewNote ? (
                    <div className="border-l-2 border-border/50 pl-3 text-sm">
                      <p className="font-medium text-foreground">Review update</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{feedback.reviewNote}</p>
                    </div>
                  ) : null}
                  {feedback.responses.map((response) => (
                    <div key={response._id} className="border-l-2 border-border/50 pl-3 text-sm">
                      <p className="font-medium text-foreground">School staff</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{response.body}</p>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          )}
        </section>
      </PageFrame>
    </AppShell>
  );
}
