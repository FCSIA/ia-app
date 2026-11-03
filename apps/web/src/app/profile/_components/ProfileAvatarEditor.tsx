'use client';

import { displayName } from '~/apps/shared/user-name';

import { useEffect, useState } from 'react';
import { useAction, useMutation } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import { EditableAvatar } from '@/components/ui/editable-avatar';
import { ImageCropDialog } from '@/components/ui/image-crop-dialog';
import { UserAvatar } from '@/components/ui/user-avatar';
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

export function ProfileAvatarEditor({ user }: { user: AppUser }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const saveUserImage = useAction(api.users.me.saveUserImage);
  const clearUserImage = useMutation(api.users.me.clearUserImage);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    setAvatarUrl(user.avatarUrl);
  }, [user.avatarUrl]);

  function handleSelectFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Not an image',
        description: 'Pick a JPG, PNG, or WebP file.',
        variant: 'destructive',
      });
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setPendingFile(file);
    setPreviewUrl(url);
    setEditorOpen(false);
    setCropOpen(true);
  }

  async function handleCropConfirm(croppedFile: File) {
    setUploading(true);
    try {
      const updatedUser = await uploadUserImage(
        { generateUploadUrl: () => generateUploadUrl({ purpose: "USER_IMAGE" }) },
        (args) => saveUserImage(args),
        'avatar',
        croppedFile,
      );
      setAvatarUrl(updatedUser.avatarUrl);
      toast({ title: 'Profile picture updated' });
      setCropOpen(false);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPendingFile(null);
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : 'Upload failed',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  }

  function handleCropOpenChange(next: boolean) {
    setCropOpen(next);
    if (!next) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPendingFile(null);
    }
  }

  async function handleRemove() {
    try {
      const updatedUser = await clearUserImage({ kind: 'avatar' });
      setAvatarUrl(updatedUser.avatarUrl);
      toast({ title: 'Profile picture removed' });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : 'Failed to remove picture',
        variant: 'destructive',
      });
    }
  }

  const person = { ...user, avatarUrl };

  return (
    <>
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label="Edit profile picture"
            className="w-fit shrink-0 cursor-pointer rounded-full transition-shadow hover:ring-2 hover:ring-ring/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            <UserAvatar person={person} className="size-16" />
          </button>
        </DialogTrigger>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Profile picture</DialogTitle>
            <DialogDescription>Choose a new picture or remove the current one.</DialogDescription>
          </DialogHeader>
          <EditableAvatar
            alt={displayName(user)}
            canEdit
            variant="inline"
            className="size-16"
            person={person}
            imageUrl={avatarUrl}
            loading={uploading}
            onRemove={() => {
              setEditorOpen(false);
              void handleRemove();
            }}
            onUpload={(file) => handleSelectFile(file)}
            removeLabel="Remove profile picture"
            uploadLabel="Change profile picture"
          />
        </DialogContent>
      </Dialog>
      <ImageCropDialog
        open={cropOpen}
        onOpenChange={handleCropOpenChange}
        imageSrc={previewUrl}
        fileName={pendingFile?.name}
        onConfirm={handleCropConfirm}
        confirming={uploading}
      />
    </>
  );
}
