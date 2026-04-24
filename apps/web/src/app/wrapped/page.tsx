'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AtSign,
  ChevronLeft,
  ChevronRight,
  Hash,
  MessageSquare,
  Puzzle,
  Sparkles,
  Star,
  Trophy,
  Users,
} from 'lucide-react';
import { wrappedApi, type WrappedSummary } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';

type Slide = {
  key: string;
  icon: typeof Star;
  title: string;
  /** Big hero text: a number, a name, or a phrase. */
  value: string;
  /** Secondary line rendered under the value. */
  caption?: string;
  /** Gradient class-string applied to the slide background. */
  gradient: string;
};

function shortYear(startYear: number) {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

function buildSlides(
  summary: WrappedSummary,
  displayName: string,
): Slide[] {
  const year = shortYear(summary.schoolYearStart);
  const messages = summary.messagesSent;
  const avgPerWeek = Math.max(1, Math.round(messages / 40));

  return [
    {
      key: 'intro',
      icon: Star,
      title: `${year} Wrapped`,
      value: displayName,
      caption: 'A look back at your year. Tap through →',
      gradient: 'from-fuchsia-500 via-purple-600 to-indigo-700',
    },
    {
      key: 'messages',
      icon: MessageSquare,
      title: 'You sent',
      value: messages.toLocaleString(),
      caption:
        messages === 0
          ? 'No messages this year. Room to grow!'
          : `messages across club channels — about ${avgPerWeek.toLocaleString()} a week.`,
      gradient: 'from-rose-500 via-orange-500 to-amber-500',
    },
    {
      key: 'credits',
      icon: Sparkles,
      title: 'Flex Friday credits',
      value: `${summary.flexCredits} / ${summary.flexCreditsRequired}`,
      caption:
        summary.flexCredits >= summary.flexCreditsRequired
          ? 'All credits earned. Lock it in.'
          : `${Math.max(0, summary.flexCreditsRequired - summary.flexCredits)} to go.`,
      gradient: 'from-emerald-500 via-teal-500 to-cyan-600',
    },
    {
      key: 'channels',
      icon: Hash,
      title: 'Channels you showed up in',
      value: summary.channelsEngaged.toLocaleString(),
      caption:
        summary.channelsEngaged === 0
          ? 'No channels yet — pick a club and jump in.'
          : 'distinct channels you posted in this year.',
      gradient: 'from-sky-500 via-blue-600 to-indigo-700',
    },
    {
      key: 'friends',
      icon: Users,
      title: 'New friendships',
      value: summary.friends.toLocaleString(),
      caption:
        summary.friends === 0
          ? 'No new friends added. Maybe this is the year.'
          : 'friends added to your schedule this year.',
      gradient: 'from-pink-500 via-rose-500 to-red-500',
    },
    {
      key: 'clubs',
      icon: Puzzle,
      title: 'Clubs you called home',
      value: summary.clubs.toLocaleString(),
      caption:
        summary.clubs === 0
          ? 'Not in any clubs yet — so many to choose from.'
          : summary.clubs === 1
            ? 'club you were part of.'
            : 'clubs you were part of.',
      gradient: 'from-violet-500 via-purple-600 to-fuchsia-600',
    },
    {
      key: 'top-channel',
      icon: Trophy,
      title: 'Your top channel',
      value: summary.topChannel ? `#${summary.topChannel.channelName}` : 'No favorite yet',
      caption: summary.topChannel
        ? `${summary.topChannel.messages.toLocaleString()} messages in ${summary.topChannel.clubName}.`
        : 'Post in a channel and it will show up here.',
      gradient: 'from-amber-500 via-yellow-500 to-orange-600',
    },
    {
      key: 'top-mention',
      icon: AtSign,
      title: 'You @-mentioned most',
      value: summary.topMentioned
        ? `${summary.topMentioned.firstName} ${summary.topMentioned.lastName}`
        : 'Nobody yet',
      caption: summary.topMentioned
        ? `${summary.topMentioned.mentions.toLocaleString()} mentions. They probably owe you a reply.`
        : 'Try @-mentioning a friend to start a conversation.',
      gradient: 'from-cyan-500 via-sky-600 to-blue-700',
    },
    {
      key: 'outro',
      icon: Star,
      title: `That was ${year}`,
      value: displayName,
      caption: 'See you next year. Share the best slide with a friend.',
      gradient: 'from-fuchsia-500 via-purple-600 to-indigo-700',
    },
  ];
}

export default function WrappedPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const user = mounted ? getUser() : null;
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'You';

  const { data, isLoading, error } = useQuery({
    queryKey: ['wrapped', 'me'],
    queryFn: () => wrappedApi.getMine().then((r) => r.data),
    enabled: mounted,
  });

  const slides = useMemo(
    () => (data ? buildSlides(data, displayName) : []),
    [data, displayName],
  );
  const [index, setIndex] = useState(0);

  const go = (dir: -1 | 1) => {
    setIndex((i) => Math.max(0, Math.min(slides.length - 1, i + dir)));
  };

  useEffect(() => {
    if (slides.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slides.length]);

  if (!mounted || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-muted-foreground text-sm">Loading your year…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto mt-16 space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Wrapped isn't ready</h1>
        <p className="text-muted-foreground text-sm">
          We couldn't load your year summary. Try again in a bit.
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  const slide = slides[index];
  const Icon = slide.icon;
  const atStart = index === 0;
  const atEnd = index === slides.length - 1;

  return (
    <div className="relative">
      {/* Full-bleed slide */}
      <div
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${slide.gradient} text-white shadow-2xl transition-[background] duration-700`}
        style={{ minHeight: 'min(80vh, 720px)' }}
      >
        {/* decorative blobs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-white/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 size-[28rem] rounded-full bg-black/20 blur-3xl"
        />

        {/* progress dots */}
        <div className="absolute top-6 left-0 right-0 flex justify-center gap-1.5 px-6">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1 flex-1 max-w-[48px] rounded-full transition-all ${
                i === index
                  ? 'bg-white'
                  : i < index
                    ? 'bg-white/70'
                    : 'bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
        </div>

        {/* slide content */}
        <div
          key={slide.key}
          className="relative flex flex-col items-start justify-center gap-6 px-8 py-20 sm:px-16 sm:py-24 motion-safe:animate-[fadeUp_0.5s_ease-out]"
          style={{ minHeight: 'min(80vh, 720px)' }}
        >
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.25em] text-white/80">
            <Icon size={16} /> {slide.title}
          </div>
          <div className="text-6xl sm:text-8xl font-black leading-none tracking-tight drop-shadow-sm">
            {slide.value}
          </div>
          {slide.caption && (
            <div className="max-w-xl text-lg sm:text-xl text-white/90 font-medium">
              {slide.caption}
            </div>
          )}
          <div className="mt-auto pt-6 text-xs uppercase tracking-widest text-white/70">
            {shortYear(data.schoolYearStart)} · IA Wrapped
          </div>
        </div>

        {/* nav buttons */}
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={atStart}
          aria-label="Previous slide"
          className="absolute inset-y-0 left-0 flex w-16 items-center justify-center text-white/70 transition hover:bg-black/10 hover:text-white disabled:cursor-not-allowed disabled:text-white/20 disabled:hover:bg-transparent"
        >
          <ChevronLeft size={32} />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={atEnd}
          aria-label="Next slide"
          className="absolute inset-y-0 right-0 flex w-16 items-center justify-center text-white/70 transition hover:bg-black/10 hover:text-white disabled:cursor-not-allowed disabled:text-white/20 disabled:hover:bg-transparent"
        >
          <ChevronRight size={32} />
        </button>
      </div>

      {/* footer summary grid (visible after last slide on large screens) */}
      {atEnd && (
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryStat icon={MessageSquare} label="Messages" value={data.messagesSent} />
          <SummaryStat icon={Sparkles} label="Flex credits" value={data.flexCredits} />
          <SummaryStat icon={Hash} label="Channels" value={data.channelsEngaged} />
          <SummaryStat icon={Users} label="Friends" value={data.friends} />
          <SummaryStat icon={Puzzle} label="Clubs" value={data.clubs} />
          <SummaryStat
            icon={Trophy}
            label="Top channel"
            value={data.topChannel ? `#${data.topChannel.channelName}` : '—'}
          />
          <SummaryStat
            icon={AtSign}
            label="Most @-ed"
            value={
              data.topMentioned
                ? `${data.topMentioned.firstName} ${data.topMentioned.lastName}`
                : '—'
            }
          />
          <SummaryStat icon={Star} label="Year" value={shortYear(data.schoolYearStart)} />
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function SummaryStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Star;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon size={12} /> {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-foreground truncate">{value}</div>
    </div>
  );
}
