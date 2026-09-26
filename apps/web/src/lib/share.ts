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

export async function copyShareUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    return;
  } catch {
    if (!copyWithExecCommand(url)) {
      throw new Error('This browser could not copy the share link.');
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

  await copyShareUrl(url);
  return 'copied';
}
