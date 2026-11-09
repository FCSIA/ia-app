// Where to send someone after they sign in. Only same-site paths are allowed,
// so a crafted /login?next= link can't send people to another site.
export const RETURN_PATH_PARAM = 'next';

export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  if (/[\u0000-\u001f]/.test(value)) return null;
  try {
    const url = new URL(value, 'https://example.invalid');
    if (url.origin !== 'https://example.invalid' || url.pathname === '/login') return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
