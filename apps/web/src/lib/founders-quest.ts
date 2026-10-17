export const FOUNDERS = [
  { name: 'Rebanto Nath', classYear: 2027, firstCommit: '9177f5968ceaf86d62459328b24f9439a9c99f27' },
  { name: 'Sreyas Sabbani', classYear: 2027, firstCommit: '91151ddca339cd3167dac066c1b7f9ada7766f3a' },
  { name: 'Kirill McQuillin', classYear: 2027, firstCommit: '54f10381e76fc5c73b8fb5e8a742b25e5e5ec625' },
  { name: 'Viraj Das', classYear: 2028, firstCommit: 'b47bd12591d0943ee2276d1a2be738d014467903' },
  { name: 'Daivik Lakkisetty', classYear: 2029, firstCommit: '908ba13b82bce084e8d7332aab8c280800c11705' },
] as const;

export const FIRST_PROJECT_COMMIT = FOUNDERS[3].firstCommit;
export const commitUrl = (hash: string) => `https://github.com/virajdas/ia-app/commit/${hash}`;

export const QUEST_CLUES = [
  'In Profile & Settings → What’s new, tap the app version five times.',
  'Every story starts somewhere. Ours began on March 2. Turn the calendar back to that day.',
  'Your school day has a progress bar. Something is riding it.',
] as const;
