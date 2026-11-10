type StorageArea = 'local' | 'session';

function area(kind: StorageArea): Storage | null {
  const scope = globalThis as { localStorage?: Storage; sessionStorage?: Storage };
  try {
    return (kind === 'local' ? scope.localStorage : scope.sessionStorage) ?? null;
  } catch {
    return null;
  }
}

/**
 * Web Storage that never throws: private browsing, blocked cookies and quota
 * errors read as an empty value and a failed write.
 */
export function readStorage(key: string, kind: StorageArea = 'local'): string | null {
  try {
    return area(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string, kind: StorageArea = 'local'): boolean {
  try {
    const storage = area(kind);
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key: string, kind: StorageArea = 'local'): boolean {
  try {
    const storage = area(kind);
    if (!storage) return false;
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** The parsed value, or null when it is missing, unreadable or not JSON. */
export function readStoredJson(key: string, kind: StorageArea = 'local'): unknown {
  const raw = readStorage(key, kind);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeStoredJson(key: string, value: unknown, kind: StorageArea = 'local'): boolean {
  return writeStorage(key, JSON.stringify(value), kind);
}

/** A stable id kept under `key`; null when it can't be read back or saved. */
export function getOrCreateStoredId(key: string, create: () => string, kind: StorageArea = 'local'): string | null {
  const existing = readStorage(key, kind);
  if (existing) return existing;
  const created = create();
  return writeStorage(key, created, kind) ? created : null;
}
