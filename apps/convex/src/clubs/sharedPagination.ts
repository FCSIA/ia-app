export const MAX_SHARED_MESSAGE_PAGE_SIZE = 50;

export function boundedSharedMessagePageSize(requested: number) {
  if (!Number.isFinite(requested)) return 30;
  return Math.max(1, Math.min(MAX_SHARED_MESSAGE_PAGE_SIZE, Math.floor(requested)));
}
