'use client';

import { useRef, useState } from 'react';

/** File reads stay local; a replaced/cancelled read cannot restore a stale preview. */
export function useRosterCsvFile() {
  const revision = useRef(0);
  const [fileName, setFileName] = useState<string>();
  const [text, setText] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string>();
  const [inputKey, setInputKey] = useState(0);

  function clear() {
    revision.current += 1;
    setFileName(undefined);
    setText(null);
    setError(undefined);
    setIsReading(false);
    setInputKey((key) => key + 1);
  }

  async function selectFile(file: File | null) {
    clear();
    if (!file) return;
    const current = revision.current;
    setFileName(file.name);
    setIsReading(true);
    try {
      const contents = await file.text();
      if (current === revision.current) setText(contents);
    } catch (cause) {
      if (current === revision.current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not read this CSV. Choose it again.',
        );
    } finally {
      if (current === revision.current) setIsReading(false);
    }
  }

  return {
    fileName,
    text,
    isReading,
    error,
    setError,
    inputKey,
    clear,
    selectFile: (file: File | null) => void selectFile(file),
  };
}
