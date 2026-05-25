import type { Id } from '~/apps/convex/src/_generated/dataModel';

type UploadClient = {
  generateUploadUrl: () => Promise<string>;
};

export async function uploadFileToConvex(
  convex: UploadClient,
  file: File,
): Promise<Id<'_storage'>> {
  const uploadUrl = await convex.generateUploadUrl();
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });

  if (!response.ok) {
    throw new Error('Failed to upload file');
  }

  const json = (await response.json()) as { storageId: Id<'_storage'> };
  return json.storageId;
}
