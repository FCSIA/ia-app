import type { Id } from '~/apps/convex/src/_generated/dataModel';

type UploadClient = {
  generateUploadUrl: () => Promise<{
    uploadUrl: string;
    uploadIntentId: Id<'uploadIntents'>;
  }>;
};

export type ConvexUploadResult = {
  storageId: Id<'_storage'>;
  uploadIntentId: Id<'uploadIntents'>;
};

export async function uploadFileToConvex(
  convex: UploadClient,
  file: File,
): Promise<ConvexUploadResult> {
  const { uploadUrl, uploadIntentId } = await convex.generateUploadUrl();
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });

  if (!response.ok) {
    throw new Error('Failed to upload file');
  }

  const json = (await response.json()) as { storageId: Id<'_storage'> };
  return { storageId: json.storageId, uploadIntentId };
}
