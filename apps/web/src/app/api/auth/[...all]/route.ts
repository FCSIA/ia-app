import { handler } from '@/lib/auth-server';
import { isSameOriginAuthRequest, withPublicAuthUrl } from '@/lib/auth-origin';

export async function GET(request: Request) {
  const publicRequest = await withPublicAuthUrl(request);
  if (!publicRequest) {
    return Response.json({ code: 'INVALID_HOST', message: 'Invalid auth host.' }, { status: 400 });
  }

  return handler.GET(publicRequest);
}

export async function POST(request: Request) {
  if (!isSameOriginAuthRequest(request)) {
    return Response.json(
      { code: 'INVALID_ORIGIN', message: 'Auth requests must come from this site.' },
      { status: 403 },
    );
  }

  const publicRequest = await withPublicAuthUrl(request);
  if (!publicRequest) {
    return Response.json({ code: 'INVALID_HOST', message: 'Invalid auth host.' }, { status: 400 });
  }

  return handler.POST(publicRequest);
}
