export const FOUNDERS = [
  { name: 'Rebanto Nath', classYear: 2027, firstCommit: '9177f5968ceaf86d62459328b24f9439a9c99f27', firstCommitSubject: 'Refactor: Convert GradeLevel to Int and update UI for FCS Innovation Academy' },
  { name: 'Sreyas Sabbani', classYear: 2027, firstCommit: '91151ddca339cd3167dac066c1b7f9ada7766f3a', firstCommitSubject: 'chore: upgrade mobile app to Expo SDK 54' },
  { name: 'Kirill McQuillin', classYear: 2027, firstCommit: '54f10381e76fc5c73b8fb5e8a742b25e5e5ec625', firstCommitSubject: 'Refactor UI to use Shadcn components and upgrade Tailwind CSS to v4' },
  { name: 'Viraj Das', classYear: 2028, firstCommit: 'b47bd12591d0943ee2276d1a2be738d014467903', firstCommitSubject: 'Initial commit' },
  { name: 'Daivik Lakkisetty', classYear: 2029, firstCommit: '908ba13b82bce084e8d7332aab8c280800c11705', firstCommitSubject: 'SQLite migration, role fixes, admin report features, permission enforcement' },
] as const;

export const QUEST_KEY_DISPLAY_MS = 2 * 60 * 1_000;

export function visibleQuestKeyCount(
  progress: { keys: readonly string[]; completedAt: number | null } | undefined,
  now: number,
) {
  if (!progress) return 0;
  if (progress.completedAt !== null && now >= progress.completedAt + QUEST_KEY_DISPLAY_MS) return 0;
  return progress.keys.length;
}

export const QUEST_CLUES = [
  'The app remembers its beginnings. Look closely at the version in Profile & Settings → What’s new, then open what appears.',
  'Every story starts somewhere. Ours began on March 2. Turn the calendar back to that day, and wake what is waiting there.',
  'Your school day has a progress bar. Something is riding it.',
] as const;
