export function getErrorMessage(error: any, fallback = 'Something went wrong.') {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message.join('\n');
  if (typeof message === 'string') return message;
  return fallback;
}
