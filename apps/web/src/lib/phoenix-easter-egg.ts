const PHOENIX_SEQUENCE = 'phoenix';
const MAX_KEY_GAP_MS = 5_000;
const MAX_TAP_GAP_MS = 1_500;
const TAPS_TO_FIND = 5;

/** Keeps the discovery out of text fields and ordinary app shortcuts. */
export function isPhoenixEasterEggKey(event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'target'>) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.key.length !== 1) return false;
  const target = event.target;
  if (target instanceof Element) {
    if (target.closest('input, textarea, select, [contenteditable]')) return false;
  }
  return true;
}

export function createPhoenixEasterEggMatcher() {
  let progress = 0;
  let lastKeyAt = 0;

  return (key: string, now: number): boolean => {
    if (now - lastKeyAt > MAX_KEY_GAP_MS) progress = 0;
    lastKeyAt = now;

    const letter = key.toLowerCase();
    progress = letter === PHOENIX_SEQUENCE[progress]
      ? progress + 1
      : letter === PHOENIX_SEQUENCE[0]
        ? 1
        : 0;

    if (progress !== PHOENIX_SEQUENCE.length) return false;
    progress = 0;
    return true;
  };
}

/** A touch-friendly discovery on an existing page control. */
export function createEasterEggTapMatcher() {
  let taps = 0;
  let lastTapAt = 0;

  return (now: number): boolean => {
    taps = now - lastTapAt <= MAX_TAP_GAP_MS ? taps + 1 : 1;
    lastTapAt = now;
    if (taps < TAPS_TO_FIND) return false;
    taps = 0;
    return true;
  };
}
