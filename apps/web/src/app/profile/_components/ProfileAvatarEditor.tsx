'use client';

import { useState } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import { EditableAvatar } from '@/components/ui/editable-avatar';
import { useToast } from '@/hooks/use-toast';
import type { AppUser } from '@/lib/auth';
import { uploadUserImage } from '@/lib/upload-user-image';

function initialsOf(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function ProfileAvatarEditor({ user }: { user: AppUser }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
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

  return (
    <EditableAvatar
      alt={`${user.firstName} ${user.lastName}`}
      canEdit
      className="size-16 rounded-2xl"
      fallback={initialsOf(user.firstName, user.lastName)}
      fallbackClassName="rounded-2xl bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-xl text-white"
      imageUrl={user.avatarUrl}
      loading={uploading}
      onRemove={() => void handleRemove()}
      onUpload={(file) => void handleFile(file)}
      removeLabel="Remove profile picture"
      uploadLabel="Change profile picture"
    />
  );
}
