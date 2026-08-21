const validHost = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*|\d{1,3}(?:\.\d{1,3}){3}|\[[0-9a-fA-F:]+\])(?::\d{1,5})?$/;

function firstHeaderValue(value: string | null) {
  return value?.split(',')[0]?.trim() || null;
}

export function getPublicAuthOrigin(request: Request) {
  const forwardedHost = firstHeaderValue(request.headers.get('x-forwarded-host'));
  const host = forwardedHost ?? request.headers.get('host') ?? new URL(request.url).host;
  if (!validHost.test(host)) return null;

  const forwardedProtocol = firstHeaderValue(request.headers.get('x-forwarded-proto'));
  if (forwardedProtocol && forwardedProtocol !== 'http' && forwardedProtocol !== 'https') {
    return null;
  }

  const protocol = forwardedProtocol ?? new URL(request.url).protocol.replace(/:$/, '');

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return null;
  }
}

export function isSameOriginAuthRequest(request: Request) {
  const publicOrigin = getPublicAuthOrigin(request);
  if (!publicOrigin) return false;

  const origin = request.headers.get('origin');

  // Non-browser callers may omit Origin. Better Auth still applies its own
  // cookie, Fetch Metadata, and trusted-origin checks downstream.
  if (!origin) return true;

  try {
    return new URL(origin).origin === publicOrigin;
  } catch {
    return false;
  }
}

export async function withPublicAuthUrl(request: Request) {
  const publicOrigin = getPublicAuthOrigin(request);
  if (!publicOrigin) return null;

  const incomingUrl = new URL(request.url);
  const publicUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, publicOrigin);
  const init: RequestInit = {
    method: request.method,
    headers: request.headers,
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const body = await request.arrayBuffer();
    if (body.byteLength > 0) init.body = body;
  }

  return new Request(publicUrl, init);
}
