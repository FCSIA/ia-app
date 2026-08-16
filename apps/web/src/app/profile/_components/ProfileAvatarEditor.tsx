'use client';

import { useState } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import { EditableAvatar } from '@/components/ui/editable-avatar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { AppUser } from '@/lib/auth';
import { uploadUserImage } from '@/lib/upload-user-image';

function initialsOf(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function ProfileAvatarEditor({ user }: { user: AppUser }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const saveUserImage = useAction(api.users.me.saveUserImage);
  const clearUserImage = useMutation(api.users.me.clearUserImage);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Not an image',
        description: 'Pick a JPG, PNG, or WebP file.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      await uploadUserImage(
        { generateUploadUrl: () => generateUploadUrl({ purpose: "USER_IMAGE" }) },
        (args) => saveUserImage(args),
        'avatar',
        file,
      );
      toast({ title: 'Profile picture updated' });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : 'Upload failed',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    try {
      await clearUserImage({ kind: 'avatar' });
      toast({ title: 'Profile picture removed' });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : 'Failed to remove picture',
        variant: 'destructive',
      });
    }
  }

  const initials = initialsOf(user.firstName, user.lastName);
  const alt = `${user.firstName} ${user.lastName}`;

  return (
    <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
      <DialogTrigger asChild>
        <Avatar
          asChild
          className="size-16 cursor-pointer rounded-2xl border border-border/60 bg-background shadow-sm transition-shadow hover:ring-2 hover:ring-ring/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <button type="button" aria-label="Edit profile picture">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={alt} /> : null}
            <AvatarFallback className="rounded-2xl bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-xl text-white">
              {initials}
            </AvatarFallback>
          </button>
        </Avatar>
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Profile picture</DialogTitle>
          <DialogDescription>Choose a new picture or remove the current one.</DialogDescription>
        </DialogHeader>
        <EditableAvatar
          alt={alt}
          canEdit
          variant="inline"
          className="size-16 rounded-2xl"
          fallback={initials}
          fallbackClassName="rounded-2xl bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-xl text-white"
          imageUrl={user.avatarUrl}
          loading={uploading}
          onRemove={() => {
            setEditorOpen(false);
            void handleRemove();
          }}
          onUpload={(file) => {
            setEditorOpen(false);
            void handleFile(file);
          }}
          removeLabel="Remove profile picture"
          uploadLabel="Change profile picture"
        />
      </DialogContent>
    </Dialog>
  );
}
