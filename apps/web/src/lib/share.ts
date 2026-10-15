export type ShareUrlResult = 'shared' | 'copied' | 'cancelled';

type ShareUrlOptions = {
  title?: string;
  text?: string;
  url: string;
};

function copyWithExecCommand(value: string) {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}

/**
 * Copies text, falling back to the legacy copy command where the async
 * clipboard is unavailable or refused. Call it inside the user's tap or click.
 */
export async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    if (!copyWithExecCommand(value)) {
      throw new Error('This browser could not copy the text.');
    }
  }
}

/**
 * Opens the native share sheet when available and falls back to copying the
 * URL for browsers without Web Share. Keep this call inside the user's click
 * handler so browsers retain the required transient activation.
 */
export async function shareUrl({ title, text, url }: ShareUrlOptions): Promise<ShareUrlResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  await copyText(url);
  return 'copied';
}

/** Whether this browser's share sheet accepts this file. */
export function canShareFile(file: File) {
  return typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [file] });
}

/**
 * Shares a file itself, so the iOS share sheet offers Save Image for
 * pictures. Check `canShareFile` first, inside the same tap.
 */
export async function shareFile(file: File, { title }: { title?: string } = {}): Promise<ShareUrlResult> {
  try {
    await navigator.share({ files: [file], title });
    return 'shared';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    throw error;
  }
}
