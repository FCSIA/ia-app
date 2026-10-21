import { displayName as profileName } from '~/apps/shared/user-name';
import {
  Star,
  Sparkles,
  Heart,
  Rocket,
  Zap,
  MessageSquare,
  MessageCircle,
  Volume2,
  Flame,
  Sun,
  Moon,
  Clock,
  CalendarDays,
  Quote,
  Hash,
  Trophy,
  Users,
  AtSign,
  Puzzle,
  Smile,
  type LucideIcon,
} from 'lucide-react';
import type { Slide, WrappedSummary } from './types';
import { PATHWAY_THEME } from './constants';

export function shortYear(startYear: number) {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export function formatHour(hour: number): string {
  // 0 → 12 AM, 13 → 1 PM, etc.
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? 'AM' : 'PM';
  return `${h12} ${suffix}`;
}

export function hourVibe(hour: number): { label: string; icon: LucideIcon } {
  if (hour >= 5 && hour < 11) return { label: 'Morning person', icon: Sun };
  if (hour >= 11 && hour < 17) return { label: 'Midday operator', icon: Sun };
  if (hour >= 17 && hour < 22) return { label: 'Evening chatter', icon: Sparkles };
  return { label: 'Night owl', icon: Moon };
}

export function formatDateLabel(dateKey: string): string {
  // dateKey is YYYY-MM-DD; render as "Friday, April 3"
  const [y, m, d] = dateKey.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function buildSlides(summary: WrappedSummary, displayName: string): Slide[] {
  const year = shortYear(summary.schoolYearStart);
  const avgPerWeek = Math.max(1, Math.round(summary.messagesSent / 40));
  const slides: Slide[] = [];

  // 1. Intro
  slides.push({
    key: 'intro',
    kind: 'intro',
    eyebrow: `${year} · IA Wrapped`,
    value: displayName,
    caption: 'Your year, in numbers. Tap through →',
    icon: Star,
    gradient: 'from-fuchsia-500 via-purple-600 to-indigo-700',
    graphic: 'confetti',
    scatterIcons: [Star, Sparkles, Heart, Rocket, Zap],
  });

  // 2. Messages
  slides.push({
    key: 'messages',
    kind: 'stat',
    eyebrow: 'You sent',
    value: summary.messagesSent.toLocaleString(),
    numericValue: summary.messagesSent,
    caption:
      summary.messagesSent === 0
        ? 'No messages yet — this is your blank canvas.'
        : `messages — about ${avgPerWeek.toLocaleString()} a week.`,
    icon: MessageSquare,
    gradient: 'from-rose-500 via-orange-500 to-amber-500',
    graphic: 'blobs',
    scatterIcons: [MessageSquare, MessageCircle, Volume2, Flame],
  });

  // 3. Peak hour — skip when there are no messages
  if (summary.peakHour && summary.peakHour.messages > 0) {
    const vibe = hourVibe(summary.peakHour.hour);
    const nightish = summary.peakHour.hour < 6 || summary.peakHour.hour >= 22;
    slides.push({
      key: 'peak-hour',
      kind: 'name',
      eyebrow: vibe.label,
      value: formatHour(summary.peakHour.hour),
      caption: `You were loudest at ${formatHour(summary.peakHour.hour)} — ${summary.peakHour.messages.toLocaleString()} messages land in that hour.`,
      icon: vibe.icon,
      gradient: nightish
        ? 'from-indigo-700 via-purple-800 to-slate-900'
        : 'from-orange-400 via-amber-500 to-rose-500',
      graphic: nightish ? 'stars' : 'rings',
      scatterIcons: nightish ? [Moon, Star, Clock, Sparkles] : [Sun, Clock, Sparkles, Zap],
    });
  }

  // 4. Most active day
  if (summary.mostActiveDay && summary.mostActiveDay.messages > 0) {
    slides.push({
      key: 'big-day',
      kind: 'name',
      eyebrow: 'Your loudest day',
      value: formatDateLabel(summary.mostActiveDay.date),
      caption: `${summary.mostActiveDay.messages.toLocaleString()} messages in a single day. Something was happening.`,
      icon: CalendarDays,
      gradient: 'from-pink-500 via-fuchsia-500 to-rose-600',
      graphic: 'confetti',
      scatterIcons: [CalendarDays, Flame, Star, Sparkles],
    });
  }

  // 5. Longest streak
  if (summary.longestStreak >= 2) {
    slides.push({
      key: 'streak',
      kind: 'stat',
      eyebrow: 'Your longest streak',
      value: summary.longestStreak.toLocaleString(),
      numericValue: summary.longestStreak,
      caption:
        summary.longestStreak >= 14
          ? 'consecutive days posting. Commitment.'
          : 'consecutive days you showed up in the chat.',
      icon: Flame,
      gradient: 'from-orange-500 via-red-500 to-rose-700',
      graphic: 'waves',
      scatterIcons: [Flame, Zap, Star, Rocket],
    });
  }

  // 6. Most used word
  if (summary.mostUsedWord && summary.mostUsedWord.count >= 3) {
    slides.push({
      key: 'word',
      kind: 'word',
      eyebrow: 'Your word of the year',
      value: `"${summary.mostUsedWord.word}"`,
      caption: `You said it ${summary.mostUsedWord.count.toLocaleString()} times. It's kind of your thing now.`,
      icon: Quote,
      gradient: 'from-violet-600 via-fuchsia-500 to-pink-500',
      graphic: 'blobs',
      scatterIcons: [Quote, MessageSquare, Sparkles],
    });
  }

  // 7. Channels
  slides.push({
    key: 'channels',
    kind: 'stat',
    eyebrow: 'Channels you showed up in',
    value: summary.channelsEngaged.toLocaleString(),
    numericValue: summary.channelsEngaged,
    caption:
      summary.channelsEngaged === 0
        ? 'Pick a club and say something.'
        : 'distinct channels you posted in this year.',
    icon: Hash,
    gradient: 'from-sky-500 via-blue-600 to-indigo-700',
    graphic: 'grid',
    scatterIcons: [Hash, MessageCircle, Volume2],
  });

  // 8. Top channel
  slides.push({
    key: 'top-channel',
    kind: 'name',
    eyebrow: 'Your top channel',
    value: summary.topChannel ? `#${summary.topChannel.channelName}` : 'No favorite yet',
    caption: summary.topChannel
      ? `${summary.topChannel.messages.toLocaleString()} messages in ${summary.topChannel.clubName}.`
      : 'Post in a channel and it will show up here.',
    icon: Trophy,
    gradient: 'from-amber-500 via-yellow-500 to-orange-600',
    graphic: 'rings',
    scatterIcons: [Trophy, Hash, Star, Flame],
  });

  // 9. Friends
  slides.push({
    key: 'friends',
    kind: 'stat',
    eyebrow: 'New friendships',
    value: summary.friends.toLocaleString(),
    numericValue: summary.friends,
    caption:
      summary.friends === 0
        ? 'No new friends yet — maybe this is the year.'
        : 'friends added to your schedule this year.',
    icon: Users,
    gradient: 'from-pink-500 via-rose-500 to-red-500',
    graphic: 'orbs',
    scatterIcons: [Heart, Users, Star],
  });

  // 10. Top mentioned
  slides.push({
    key: 'top-mention',
    kind: 'name',
    eyebrow: 'You @-mentioned most',
    value: summary.topMentioned
      ? profileName(summary.topMentioned)
      : 'Nobody yet',
    caption: summary.topMentioned
      ? `${summary.topMentioned.mentions.toLocaleString()} mentions. They probably owe you a reply.`
      : 'Try @-mentioning a friend to start a conversation.',
    icon: AtSign,
    gradient: 'from-cyan-500 via-sky-600 to-blue-700',
    graphic: 'blobs',
    scatterIcons: [AtSign, Users, Heart],
  });

  // 11. Clubs
  slides.push({
    key: 'clubs',
    kind: 'stat',
    eyebrow: 'Clubs you called home',
    value: summary.clubs.toLocaleString(),
    numericValue: summary.clubs,
    caption:
      summary.clubs === 0
        ? 'Not in any clubs yet — so many to choose from.'
        : summary.clubs === 1
          ? 'club. Specialist energy.'
          : 'clubs you were part of.',
    icon: Puzzle,
    gradient: 'from-violet-500 via-purple-600 to-fuchsia-600',
    graphic: 'waves',
    scatterIcons: [Puzzle, Rocket, Sparkles],
  });

  // 12. Pathway — themed per student's major
  if (summary.pathway.major) {
    const theme = PATHWAY_THEME[summary.pathway.major];
    const chips: string[] = [];
    if (summary.pathway.lanyardColor) chips.push(`${summary.pathway.lanyardColor} lanyard`);
    if (summary.pathway.peers > 0) chips.push(`${summary.pathway.peers.toLocaleString()} peers`);
    if (summary.pathwayFlexCredits > 0)
      chips.push(`${summary.pathwayFlexCredits} pathway workshops`);
    slides.push({
      key: 'pathway',
      kind: 'pathway',
      eyebrow: 'Your pathway',
      value: theme.label,
      caption:
        summary.pathway.minor && summary.pathway.minor !== summary.pathway.major
          ? `Minor: ${PATHWAY_THEME[summary.pathway.minor].label}. Cross-disciplinary energy.`
          : summary.pathwayFlexCredits > 0
            ? `You showed up to ${summary.pathwayFlexCredits} pathway-specific Flex workshops this year.`
            : 'Your home track. Lean in next year.',
      icon: theme.icon,
      gradient: theme.gradient,
      graphic: 'rings',
      scatterIcons: theme.scatter,
      chips,
    });
  }

  // 13. Flex credits
  slides.push({
    key: 'credits',
    kind: 'stat',
    eyebrow: 'Flex Friday credits',
    value: `${summary.flexCredits}`,
    numericValue: summary.flexCredits,
    caption:
      summary.flexCredits >= summary.flexCreditsRequired
        ? `All ${summary.flexCreditsRequired} credits earned. Magnet seal locked in.`
        : `of ${summary.flexCreditsRequired}. ${Math.max(0, summary.flexCreditsRequired - summary.flexCredits)} to go.`,
    icon: Sparkles,
    gradient: 'from-emerald-500 via-teal-500 to-cyan-600',
    graphic: 'rings',
    scatterIcons: [Sparkles, Star, Zap],
  });

  // 14. Reactions received
  if (summary.reactionsReceived > 0) {
    slides.push({
      key: 'reactions',
      kind: 'stat',
      eyebrow: summary.topEmoji
        ? `Reactions on your messages · favorite ${summary.topEmoji.emoji}`
        : 'Reactions on your messages',
      value: summary.reactionsReceived.toLocaleString(),
      numericValue: summary.reactionsReceived,
      caption: summary.topEmoji
        ? `People reacted ${summary.topEmoji.emoji} to your posts ${summary.topEmoji.count.toLocaleString()} times.`
        : 'People reacted to your posts this often.',
      icon: Smile,
      gradient: 'from-yellow-400 via-pink-500 to-rose-600',
      graphic: 'confetti',
      scatterIcons: [Heart, Smile, Star, Sparkles],
    });
  }

  // 15. Outro
  slides.push({
    key: 'outro',
    kind: 'outro',
    eyebrow: `That was ${year}`,
    value: displayName,
    caption: 'See you next year.',
    icon: Star,
    gradient: 'from-fuchsia-500 via-purple-600 to-indigo-700',
    graphic: 'stars',
    scatterIcons: [Star, Sparkles, Heart, Rocket],
  });

  return slides;
}
