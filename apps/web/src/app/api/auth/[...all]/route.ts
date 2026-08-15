import { handler } from '@/lib/auth-server';

export const GET = handler.GET;

export async function POST(request: Request) {
  return handler.POST(request);
}
