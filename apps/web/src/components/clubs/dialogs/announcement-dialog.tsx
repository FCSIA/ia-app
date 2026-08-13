'use client';

import { useState } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { AnnouncementMediaInput } from '@/components/announcements/announcement-media';
import { uploadFileToConvex } from '@/lib/convex-upload';

type Props = {
  clubId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  directPost?: boolean;
};

export function AnnouncementDialog({ clubId, open, onOpenChange, directPost = false }: Props) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [allowComments, setAllowComments] = useState(false);
  const [pending, setPending] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [embedUrls, setEmbedUrls] = useState<string[]>([]);
  const createAnnouncement = useMutation(api.announcements.feed.create);
  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const finalizeAnnouncementImage = useAction(api.uploads.files.finalizeAnnouncementImage);

  const handleSubmit = async () => {
    setPending(true);
    try {
      const imageUploadIds = await Promise.all(images.map(async (file) => {
        const { storageId, uploadIntentId } = await uploadFileToConvex(
          { generateUploadUrl: () => generateUploadUrl({ purpose: 'ANNOUNCEMENT_IMAGE' }) },
          file,
        );
        return (await finalizeAnnouncementImage({ storageId, uploadIntentId })).imageUploadId;
      }));
      await createAnnouncement({
      title: title.trim(),
      body: body.trim(),
      allowComments,
      targetType: 'CLUB',
      clubId: clubId as Id<'clubs'>,
      targetGrades: [],
      targetMajorPathways: [],
      targetMinorPathways: [],
      isAdminGeneral: false,
      imageUploadIds,
      embedUrls,
      });
        toast({ title: directPost ? 'Announcement posted' : 'Announcement submitted' });
        setTitle('');
        setBody('');
        setAllowComments(false);
        setImages([]);
        setEmbedUrls([]);
        onOpenChange(false);
    } catch (error) {
        toast({
          title: error instanceof Error ? error.message : 'Failed to post announcement',
          variant: 'destructive',
        });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{directPost ? 'Post announcement' : 'Propose announcement'}</DialogTitle>
          <DialogDescription>
            {directPost
              ? 'Send an update directly to club members.'
              : 'Student leader proposals go to sponsors for approval.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ann-title">Title</Label>
            <Input
              id="ann-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Meeting recap, sponsor note, schedule change"
            />
          </div>

          <AnnouncementMediaInput
            images={images}
            embedUrls={embedUrls}
            disabled={pending}
            onImagesChange={setImages}
            onEmbedUrlsChange={setEmbedUrls}
            onError={(title) => toast({ title, variant: 'destructive' })}
          />

          <div className="space-y-1.5">
            <Label htmlFor="ann-body">Body</Label>
            <Textarea
              id="ann-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={6}
              placeholder="Write the update…"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={allowComments}
              onToggle={() => setAllowComments((current) => !current)}
            />
            Allow comments
          </label>
        </div>

        <DialogFooter>
          <Button variant="tertiary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={pending || !title.trim() || !body.trim()}
          >
            {pending
              ? directPost
                ? 'Posting…'
                : 'Submitting…'
              : directPost
                ? 'Post'
                : 'Submit for review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
