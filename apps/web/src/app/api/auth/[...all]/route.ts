import { handler } from '@/lib/auth-server';

export const GET = handler.GET;

export async function POST(request: Request) {
  const pathname = new URL(request.url).pathname;
  if (pathname.endsWith('/admin/impersonate-user')) {
    const reason = request.headers.get('x-ia-impersonation-reason')?.trim();
    if (!reason) {
      return Response.json({ message: 'A reason is required.' }, { status: 400 });
    }
  }
  return handler.POST(request);
}
