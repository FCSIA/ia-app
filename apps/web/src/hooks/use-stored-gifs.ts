'use client';

import { useConvexAuth, useMutation, useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import { useGifRequests } from '~/apps/shared/chat/use-gif-requests';

export function useStoredGifs(urls: string[], enabled = true, poster = false) {
  const { isAuthenticated } = useConvexAuth();
  const active = enabled && isAuthenticated && urls.length > 0;
  const assets = useQuery(api.uploads.gifAssets.list, isAuthenticated && urls.length > 0 ? { urls, poster } : 'skip');
  const request = useMutation(api.uploads.gifAssets.request);
  return useGifRequests(urls, assets, request, active, poster);
}
