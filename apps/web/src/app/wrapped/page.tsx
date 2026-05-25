'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery as useConvexQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '~/apps/convex/src/_generated/api';
import gsap from 'gsap';
import {
  AtSign,
  Beaker,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Flame,
  Hash,
  Heart,
  Laptop,
  Lock,
  MessageCircle,
  MessageSquare,
  Moon,
  Puzzle,
  Quote,
  Rocket,
  Smile,
  Sparkles,
  Star,
  Stethoscope,
  Sun,
  Trophy,
  Users,
  Volume2,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { WrappedSummary } from '@/lib/api';
import { getUser, hasRole } from '@/lib/auth';
import {
  computeWrappedAvailability,
  formatCountdown,
  schoolYearLabel,
} from '@/lib/wrapped';

type Slide = {
  key: string;
  kind: 'intro' | 'stat' | 'name' | 'outro' | 'pathway' | 'word' | 'emoji';
  eyebrow: string;
  value: string;
  /** If set, `value` is a number; enables count-up animation. */
  numericValue?: number;
  caption?: string;
  icon: LucideIcon;
  gradient: string;
  /** Swappable decorative background per slide. */
  graphic: 'orbs' | 'grid' | 'rings' | 'blobs' | 'confetti' | 'stars' | 'waves';
  /** Lucide icons scattered across the background. */
  scatterIcons: LucideIcon[];
  /** Optional tag chips shown under the caption (e.g. pathway badges). */
  chips?: string[];
};

function shortYear(startYear: number) {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

const PATHWAY_THEME: Record<
  'HEALTH_SCIENCE' | 'INFORMATION_TECHNOLOGY' | 'ENGINEERING',
  { gradient: string; icon: LucideIcon; scatter: LucideIcon[]; label: string }
> = {
  HEALTH_SCIENCE: {
    gradient: 'from-emerald-500 via-green-600 to-teal-700',
    icon: Stethoscope,
    scatter: [Heart, Stethoscope, Beaker, Sparkles],
    label: 'Health Science',
  },
  INFORMATION_TECHNOLOGY: {
    gradient: 'from-sky-500 via-blue-600 to-indigo-700',
    icon: Laptop,
    scatter: [Laptop, Cpu, Hash, Zap],
    label: 'Information Technology',
  },
  ENGINEERING: {
    gradient: 'from-amber-500 via-yellow-500 to-orange-600',
    icon: Wrench,
    scatter: [Wrench, Cpu, Sparkles, Flame],
    label: 'Engineering',
  },
};

function formatHour(hour: number): string {
  // 0 → 12 AM, 13 → 1 PM, etc.
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? 'AM' : 'PM';
  return `${h12} ${suffix}`;
}

function hourVibe(hour: number): { label: string; icon: LucideIcon } {
  if (hour >= 5 && hour < 11) return { label: 'Morning person', icon: Sun };
  if (hour >= 11 && hour < 17) return { label: 'Midday operator', icon: Sun };
  if (hour >= 17 && hour < 22) return { label: 'Evening chatter', icon: Sparkles };
  return { label: 'Night owl', icon: Moon };
}

function formatDateLabel(dateKey: string): string {
  // dateKey is YYYY-MM-DD; render as "Friday, April 3"
  const [y, m, d] = dateKey.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function buildSlides(summary: WrappedSummary, displayName: string): Slide[] {
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
      ? `${summary.topMentioned.firstName} ${summary.topMentioned.lastName}`
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

// ─── Background graphics ────────────────────────────────────────────────────

function Graphic({ kind }: { kind: Slide['graphic'] }) {
  if (kind === 'orbs') return <OrbsGraphic />;
  if (kind === 'grid') return <GridGraphic />;
  if (kind === 'rings') return <RingsGraphic />;
  if (kind === 'blobs') return <BlobsGraphic />;
  if (kind === 'confetti') return <ConfettiGraphic />;
  if (kind === 'stars') return <StarsGraphic />;
  return <WavesGraphic />;
}

function OrbsGraphic() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.orb').forEach((orb, i) => {
        gsap.to(orb, {
          x: `+=${gsap.utils.random(-40, 40)}`,
          y: `+=${gsap.utils.random(-40, 40)}`,
          scale: gsap.utils.random(0.8, 1.3),
          duration: gsap.utils.random(6, 12),
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          delay: i * 0.2,
        });
      });
    }, ref);
    return () => ctx.revert();
  }, []);
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="orb absolute top-[12%] left-[8%] size-64 rounded-full bg-white/25 blur-3xl" />
      <div className="orb absolute top-[40%] right-[12%] size-96 rounded-full bg-black/20 blur-3xl" />
      <div className="orb absolute bottom-[10%] left-[30%] size-80 rounded-full bg-white/15 blur-3xl" />
      <div className="orb absolute top-[60%] left-[60%] size-72 rounded-full bg-white/20 blur-3xl" />
    </div>
  );
}

function GridGraphic() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.15]"
      style={{
        backgroundImage:
          'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
        backgroundSize: '80px 80px',
        maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
      }}
    />
  );
}

function RingsGraphic() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.to('.ring', {
        rotate: 360,
        duration: 40,
        ease: 'none',
        repeat: -1,
        transformOrigin: 'center',
      });
      gsap.to('.ring-reverse', {
        rotate: -360,
        duration: 60,
        ease: 'none',
        repeat: -1,
        transformOrigin: 'center',
      });
    }, ref);
    return () => ctx.revert();
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <svg viewBox="0 0 800 800" className="w-[180%] max-w-none opacity-30">
        <g className="ring" style={{ transformOrigin: '400px 400px' }}>
          <circle cx="400" cy="400" r="320" stroke="white" strokeWidth="1" fill="none" />
          <circle cx="400" cy="400" r="280" stroke="white" strokeWidth="1" fill="none" strokeDasharray="4 12" />
        </g>
        <g className="ring-reverse" style={{ transformOrigin: '400px 400px' }}>
          <circle cx="400" cy="400" r="220" stroke="white" strokeWidth="1" fill="none" strokeDasharray="2 10" />
          <circle cx="400" cy="400" r="160" stroke="white" strokeWidth="1" fill="none" />
        </g>
        <g className="ring" style={{ transformOrigin: '400px 400px' }}>
          <circle cx="400" cy="400" r="100" stroke="white" strokeWidth="1" fill="none" strokeDasharray="6 6" />
        </g>
      </svg>
    </div>
  );
}

function BlobsGraphic() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.to('.blob', {
        rotate: 360,
        duration: 30,
        ease: 'none',
        repeat: -1,
        transformOrigin: 'center',
        stagger: 2,
      });
    }, ref);
    return () => ctx.revert();
  }, []);
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        viewBox="0 0 600 600"
        className="blob absolute -top-32 -left-32 size-[50rem] opacity-30"
      >
        <path
          fill="white"
          d="M421.5,316Q391,382,325,410Q259,438,192,410Q125,382,112,316Q99,250,122,191Q145,132,208,116Q271,100,332,121Q393,142,421,196Q449,250,421.5,316Z"
        />
      </svg>
      <svg
        viewBox="0 0 600 600"
        className="blob absolute -bottom-48 -right-48 size-[60rem] opacity-25"
      >
        <path
          fill="black"
          d="M441.5,316Q411,382,342,409Q273,436,206,408Q139,380,118,315Q97,250,118,184Q139,118,207,99Q275,80,339,108Q403,136,429,193Q455,250,441.5,316Z"
        />
      </svg>
    </div>
  );
}

function ConfettiGraphic() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.confetti').forEach((el) => {
        gsap.to(el, {
          y: `+=${gsap.utils.random(-80, 80)}`,
          x: `+=${gsap.utils.random(-40, 40)}`,
          rotate: `+=${gsap.utils.random(-180, 180)}`,
          duration: gsap.utils.random(4, 9),
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
      });
    }, ref);
    return () => ctx.revert();
  }, []);
  const pieces = Array.from({ length: 36 });
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((_, i) => (
        <span
          key={i}
          className="confetti absolute block rounded-sm bg-white/70"
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            width: `${6 + Math.random() * 10}px`,
            height: `${6 + Math.random() * 14}px`,
            opacity: 0.35 + Math.random() * 0.5,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
    </div>
  );
}

function StarsGraphic() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.twinkle').forEach((el, i) => {
        gsap.to(el, {
          opacity: gsap.utils.random(0.2, 1),
          scale: gsap.utils.random(0.6, 1.4),
          duration: gsap.utils.random(1.4, 3.2),
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          delay: i * 0.08,
        });
      });
    }, ref);
    return () => ctx.revert();
  }, []);
  const stars = Array.from({ length: 60 });
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((_, i) => (
        <span
          key={i}
          className="twinkle absolute block size-1 rounded-full bg-white"
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            opacity: 0.2 + Math.random() * 0.6,
          }}
        />
      ))}
    </div>
  );
}

function WavesGraphic() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.to('.wave', {
        x: '-50%',
        duration: 18,
        ease: 'none',
        repeat: -1,
      });
    }, ref);
    return () => ctx.revert();
  }, []);
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        viewBox="0 0 1600 400"
        preserveAspectRatio="none"
        className="wave absolute bottom-0 left-0 w-[200%] h-[40%] opacity-25"
      >
        <path
          fill="white"
          d="M0,200 C200,100 400,300 600,200 C800,100 1000,300 1200,200 C1400,100 1600,300 1600,200 L1600,400 L0,400 Z"
        />
      </svg>
      <svg
        viewBox="0 0 1600 400"
        preserveAspectRatio="none"
        className="wave absolute bottom-0 left-0 w-[200%] h-[30%] opacity-15"
        style={{ transform: 'translateX(-25%)' }}
      >
        <path
          fill="black"
          d="M0,200 C200,300 400,100 600,200 C800,300 1000,100 1200,200 C1400,300 1600,100 1600,200 L1600,400 L0,400 Z"
        />
      </svg>
    </div>
  );
}

// ─── Scattered icons layer ──────────────────────────────────────────────────

function ScatterIcons({ icons }: { icons: LucideIcon[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.scatter-icon').forEach((el, i) => {
        gsap.fromTo(
          el,
          { opacity: 0, scale: 0.4, rotate: gsap.utils.random(-60, 60) },
          {
            opacity: 0.35,
            scale: 1,
            rotate: 0,
            duration: 0.8,
            ease: 'back.out(1.6)',
            delay: 0.1 + i * 0.05,
          },
        );
        gsap.to(el, {
          y: `+=${gsap.utils.random(-20, 20)}`,
          rotate: `+=${gsap.utils.random(-15, 15)}`,
          duration: gsap.utils.random(3, 6),
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          delay: 0.8 + i * 0.1,
        });
      });
    }, ref);
    return () => ctx.revert();
  }, [icons]);

  // Distribute ~12 icons across the slide using positions that avoid the
  // central text block.
  const positions = [
    { top: '8%', left: '6%', size: 44 },
    { top: '14%', right: '10%', size: 56 },
    { top: '30%', left: '12%', size: 36 },
    { top: '42%', right: '6%', size: 48 },
    { bottom: '18%', left: '8%', size: 52 },
    { bottom: '10%', right: '14%', size: 40 },
    { top: '6%', left: '46%', size: 32 },
    { bottom: '8%', left: '52%', size: 36 },
    { top: '72%', left: '22%', size: 44 },
    { top: '24%', right: '30%', size: 34 },
    { bottom: '32%', right: '32%', size: 38 },
    { top: '56%', left: '4%', size: 30 },
  ];

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0">
      {positions.map((pos, i) => {
        const Icon = icons[i % icons.length];
        return (
          <Icon
            key={i}
            className="scatter-icon absolute text-white drop-shadow-md"
            style={{
              ...pos,
              width: pos.size,
              height: pos.size,
              opacity: 0,
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Slide view ─────────────────────────────────────────────────────────────

function SlideView({ slide, direction }: { slide: Slide; direction: 1 | -1 }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);
  const heroIconRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      // Slide-wide entrance: subtle push from direction.
      tl.fromTo(
        rootRef.current,
        { opacity: 0, x: direction * 60, scale: 0.98 },
        { opacity: 1, x: 0, scale: 1, duration: 0.6 },
      );

      // Eyebrow reveal with clip-path.
      tl.fromTo(
        '.slide-eyebrow',
        {
          opacity: 0,
          y: 20,
          clipPath: 'inset(0 100% 0 0)',
        },
        {
          opacity: 1,
          y: 0,
          clipPath: 'inset(0 0% 0 0)',
          duration: 0.55,
        },
        '-=0.35',
      );

      // Hero icon pop.
      if (heroIconRef.current) {
        tl.fromTo(
          heroIconRef.current,
          { opacity: 0, scale: 0, rotate: -60 },
          { opacity: 1, scale: 1, rotate: 0, duration: 0.5, ease: 'back.out(2)' },
          '-=0.4',
        );
      }

      // Hero value.
      tl.fromTo(
        '.slide-value',
        { opacity: 0, y: 40, letterSpacing: '-0.04em' },
        { opacity: 1, y: 0, letterSpacing: '-0.02em', duration: 0.7 },
        '-=0.3',
      );

      // Count-up for numeric slides.
      if (slide.numericValue != null && valueRef.current && slide.numericValue > 0) {
        const target = { v: 0 };
        const el = valueRef.current;
        tl.to(
          target,
          {
            v: slide.numericValue,
            duration: 1.4,
            ease: 'power2.out',
            onUpdate: () => {
              el.textContent = Math.round(target.v).toLocaleString();
            },
          },
          '-=0.5',
        );
      }

      // Caption fade.
      tl.fromTo(
        '.slide-caption',
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.55 },
        '-=0.4',
      );

      // Chips pop (pathway etc.).
      const chips = gsap.utils.toArray<HTMLElement>('.slide-chips > *');
      if (chips.length > 0) {
        tl.fromTo(
          chips,
          { opacity: 0, y: 10, scale: 0.8 },
          { opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.08, ease: 'back.out(2)' },
          '-=0.3',
        );
      }

      // Footer line.
      tl.fromTo(
        '.slide-footer',
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4 },
        '-=0.3',
      );
    }, rootRef);

    return () => ctx.revert();
  }, [slide.key, direction, slide.numericValue]);

  const HeroIcon = slide.icon;

  return (
    <div
      ref={rootRef}
      className={`absolute inset-0 flex flex-col items-start justify-center px-6 py-20 sm:px-14 md:px-20 lg:px-28 bg-gradient-to-br ${slide.gradient} text-white overflow-hidden`}
    >
      <Graphic kind={slide.graphic} />
      <ScatterIcons icons={slide.scatterIcons} />

      <div className="relative z-10 flex flex-col items-start gap-6 max-w-4xl w-full">
        <div
          ref={heroIconRef}
          className="flex size-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-lg border border-white/30"
        >
          <HeroIcon size={32} className="text-white" strokeWidth={2.25} />
        </div>

        <div className="slide-eyebrow text-sm sm:text-base font-semibold uppercase tracking-[0.3em] text-white/90">
          {slide.eyebrow}
        </div>

        <div
          ref={valueRef}
          className={`slide-value font-black leading-[0.95] tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.35)] ${
            // Long text slides get a smaller top size so they don't clip.
            slide.kind === 'name' || slide.kind === 'pathway' || slide.kind === 'word'
              ? slide.value.length > 18
                ? 'text-5xl sm:text-6xl md:text-7xl'
                : 'text-5xl sm:text-7xl md:text-8xl'
              : 'text-6xl sm:text-8xl md:text-9xl'
          }`}
          style={{
            fontFamily: 'var(--font-work-sans, inherit)',
            wordBreak:
              slide.kind === 'name' || slide.kind === 'pathway' || slide.kind === 'word'
                ? 'break-word'
                : 'normal',
          }}
        >
          {slide.numericValue != null && slide.numericValue > 0 ? '0' : slide.value}
        </div>

        {slide.caption && (
          <div className="slide-caption max-w-2xl text-xl sm:text-2xl md:text-3xl font-medium text-white/95 leading-snug">
            {slide.caption}
          </div>
        )}

        {slide.chips && slide.chips.length > 0 && (
          <div className="slide-chips flex flex-wrap gap-2 pt-1">
            {slide.chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-white/30 bg-white/15 backdrop-blur-sm px-3 py-1 text-xs sm:text-sm font-semibold text-white uppercase tracking-wider"
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        <div className="slide-footer mt-auto pt-6 text-xs uppercase tracking-[0.35em] text-white/70">
          IA Wrapped
        </div>
      </div>
    </div>
  );
}

// ─── Summary grid (rendered on final slide) ─────────────────────────────────

function SummaryOverlay({ summary }: { summary: WrappedSummary }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.summary-stat',
        { opacity: 0, y: 24, scale: 0.9 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.5,
          stagger: 0.07,
          ease: 'back.out(1.4)',
          delay: 0.6,
        },
      );
    }, ref);
    return () => ctx.revert();
  }, []);

  const stats: Array<{ icon: LucideIcon; label: string; value: string | number }> = [
    { icon: MessageSquare, label: 'Messages', value: summary.messagesSent.toLocaleString() },
    { icon: Sparkles, label: 'Credits', value: `${summary.flexCredits}/${summary.flexCreditsRequired}` },
    { icon: Hash, label: 'Channels', value: summary.channelsEngaged.toLocaleString() },
    { icon: Users, label: 'Friends', value: summary.friends.toLocaleString() },
    { icon: Puzzle, label: 'Clubs', value: summary.clubs.toLocaleString() },
    {
      icon: Trophy,
      label: 'Top channel',
      value: summary.topChannel ? `#${summary.topChannel.channelName}` : '—',
    },
    {
      icon: AtSign,
      label: 'Most @',
      value: summary.topMentioned
        ? `${summary.topMentioned.firstName} ${summary.topMentioned.lastName.charAt(0)}.`
        : '—',
    },
    { icon: Star, label: 'Year', value: shortYear(summary.schoolYearStart) },
  ];

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 w-[min(92vw,900px)] z-20"
    >
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="summary-stat rounded-xl border border-white/20 bg-white/10 backdrop-blur-md px-3 py-2 text-white"
              style={{ opacity: 0 }}
            >
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/70">
                <Icon size={10} /> {s.label}
              </div>
              <div className="mt-1 text-sm font-bold truncate">{s.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Locked screen (shown outside May for non-admins) ──────────────────────

function LockedScreen({ opensAt, schoolYear }: { opensAt: Date; schoolYear: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.fromTo(
        '.locked-icon',
        { scale: 0, rotate: -60, opacity: 0 },
        { scale: 1, rotate: 0, opacity: 1, duration: 0.7, ease: 'back.out(2)' },
      )
        .fromTo(
          '.locked-eyebrow',
          { opacity: 0, y: 20, clipPath: 'inset(0 100% 0 0)' },
          { opacity: 1, y: 0, clipPath: 'inset(0 0% 0 0)', duration: 0.5 },
          '-=0.3',
        )
        .fromTo(
          '.locked-title',
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.6 },
          '-=0.2',
        )
        .fromTo(
          '.locked-body',
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.5 },
          '-=0.3',
        )
        .fromTo(
          '.locked-countdown',
          { opacity: 0, scale: 0.9 },
          { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.4)' },
          '-=0.2',
        )
        .fromTo(
          '.locked-cta',
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.4 },
          '-=0.2',
        );

      // Continuous orbiting stars.
      gsap.utils.toArray<HTMLElement>('.locked-star').forEach((el, i) => {
        gsap.to(el, {
          rotate: 360,
          duration: 40 + i * 6,
          ease: 'none',
          repeat: -1,
          transformOrigin: 'center',
        });
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  const countdown = formatCountdown(opensAt, now);
  const opensLabel = opensAt.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[60] overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white"
    >
      {/* Decorative orbiting rings */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 800 800" className="locked-star w-[200%] max-w-none opacity-25">
          <circle cx="400" cy="400" r="320" stroke="white" strokeWidth="1" fill="none" strokeDasharray="4 12" />
        </svg>
        <svg viewBox="0 0 800 800" className="locked-star absolute w-[160%] max-w-none opacity-20">
          <circle cx="400" cy="400" r="260" stroke="white" strokeWidth="1" fill="none" />
        </svg>
        <svg viewBox="0 0 800 800" className="locked-star absolute w-[120%] max-w-none opacity-15">
          <circle cx="400" cy="400" r="200" stroke="white" strokeWidth="1" fill="none" strokeDasharray="2 10" />
        </svg>
      </div>

      {/* Starfield */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {Array.from({ length: 60 }).map((_, i) => (
          <span
            key={i}
            className="absolute block size-1 rounded-full bg-white animate-pulse"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              opacity: 0.2 + Math.random() * 0.6,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      {/* Close */}
      <Link
        href="/dashboard"
        aria-label="Close"
        className="absolute top-4 right-4 z-30 flex size-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md hover:bg-white/30 transition border border-white/20"
      >
        <X size={18} />
      </Link>

      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center max-w-2xl mx-auto">
        <div className="locked-icon mb-6 flex size-24 items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl">
          <Lock size={44} className="text-white" strokeWidth={2} />
        </div>

        <div className="locked-eyebrow text-xs sm:text-sm font-semibold uppercase tracking-[0.35em] text-white/70 mb-4">
          IA Wrapped · {schoolYearLabel(schoolYear)}
        </div>

        <h1
          className="locked-title text-5xl sm:text-7xl font-black leading-none tracking-tight mb-6"
          style={{ fontFamily: 'var(--font-work-sans, inherit)' }}
        >
          Come back in May.
        </h1>

        <p className="locked-body text-lg sm:text-xl text-white/80 mb-8 max-w-xl leading-snug">
          Wrapped unlocks once a year, just as the school year wraps up. Your stats are tracking
          in the background — the reveal waits for{' '}
          <span className="font-semibold text-white">{opensLabel}</span>.
        </p>

        <div className="locked-countdown flex items-baseline gap-3 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md px-6 py-4 mb-8">
          <Clock size={20} className="text-white/70" />
          <span className="text-xs uppercase tracking-widest text-white/60">Opens in</span>
          <span className="text-2xl sm:text-3xl font-bold tracking-tight">{countdown}</span>
        </div>

        <Link
          href="/dashboard"
          className="locked-cta rounded-full border border-white/30 bg-white/15 px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:bg-white/25 transition"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function WrappedPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const user = mounted ? getUser() : null;
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'You';
  const isAdmin = mounted && hasRole(user, 'ADMIN', 'SUPER_ADMIN');

  // Recompute availability each mount + tick every 60s so the countdown
  // decrements without a page refresh (and the gate flips open at 12:00 AM
  // May 1).
  const [nowTick, setNowTick] = useState(() => new Date());
  useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => setNowTick(new Date()), 60_000);
    return () => clearInterval(id);
  }, [mounted]);
  const availability = useMemo(() => computeWrappedAvailability(nowTick), [nowTick]);
  const gated = mounted && !availability.open && !isAdmin;

  const data = useConvexQuery(
    api.wrapped.snapshots.getMine,
    mounted && !gated ? {} : 'skip',
  ) as WrappedSummary | undefined;
  const isLoading = mounted && !gated && data === undefined;
  const error = null;

  const slides = useMemo(
    () => (data ? buildSlides(data, displayName) : []),
    [data, displayName],
  );
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const progressRef = useRef<HTMLDivElement>(null);

  const go = (dir: 1 | -1) => {
    setDirection(dir);
    setIndex((i) => Math.max(0, Math.min(slides.length - 1, i + dir)));
  };
  const jumpTo = (i: number) => {
    setDirection(i > index ? 1 : -1);
    setIndex(i);
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
      } else if (e.key === 'Escape') {
        window.location.href = '/dashboard';
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slides.length]);

  // Animate the active progress bar fill smoothly.
  useLayoutEffect(() => {
    if (!progressRef.current || slides.length === 0) return;
    const bars = progressRef.current.querySelectorAll<HTMLElement>('.progress-fill');
    bars.forEach((bar, i) => {
      gsap.to(bar, {
        width: i < index ? '100%' : i === index ? '100%' : '0%',
        duration: i === index ? 0.7 : 0.3,
        ease: 'power2.out',
      });
    });
  }, [index, slides.length]);

  // Not yet May and not an admin — render the locked teaser.
  if (gated) {
    return (
      <LockedScreen opensAt={availability.opensAt} schoolYear={availability.schoolYear} />
    );
  }

  if (!mounted || isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-fuchsia-500 via-purple-600 to-indigo-700 text-white">
        <div className="flex flex-col items-center gap-4">
          <Sparkles size={48} className="animate-pulse" />
          <div className="text-lg font-medium tracking-wide">Loading your year…</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-700 via-slate-800 to-black text-white p-6">
        <h1 className="text-2xl font-semibold">Wrapped isn&apos;t ready</h1>
        <p className="text-white/70 text-sm">We couldn&apos;t load your year summary.</p>
        <Link
          href="/dashboard"
          className="rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm font-medium backdrop-blur hover:bg-white/20 transition"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  const slide = slides[index];
  const atStart = index === 0;
  const atEnd = index === slides.length - 1;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-black">
      {/* Slide */}
      <SlideView key={slide.key} slide={slide} direction={direction} />

      {/* Progress bars */}
      <div
        ref={progressRef}
        className="pointer-events-auto absolute top-5 left-0 right-0 flex justify-center gap-1 px-6 z-30"
      >
        {slides.map((s, i) => (
          <button
            key={s.key}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => jumpTo(i)}
            className="group flex-1 max-w-[56px] h-1 rounded-full bg-white/25 hover:bg-white/40 overflow-hidden transition"
          >
            <span
              className="progress-fill block h-full bg-white rounded-full"
              style={{ width: i < index ? '100%' : '0%' }}
            />
          </button>
        ))}
      </div>

      {/* Close */}
      <Link
        href="/dashboard"
        aria-label="Close"
        className="absolute top-4 right-4 z-30 flex size-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md hover:bg-white/30 transition border border-white/20"
      >
        <X size={18} />
      </Link>

      {/* Nav buttons */}
      <button
        type="button"
        onClick={() => go(-1)}
        disabled={atStart}
        aria-label="Previous slide"
        className="absolute inset-y-0 left-0 z-20 flex w-16 sm:w-20 items-center justify-center text-white/60 transition hover:bg-gradient-to-r hover:from-black/20 hover:to-transparent hover:text-white disabled:pointer-events-none disabled:opacity-0"
      >
        <ChevronLeft size={36} />
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        disabled={atEnd}
        aria-label="Next slide"
        className="absolute inset-y-0 right-0 z-20 flex w-16 sm:w-20 items-center justify-center text-white/60 transition hover:bg-gradient-to-l hover:from-black/20 hover:to-transparent hover:text-white disabled:pointer-events-none disabled:opacity-0"
      >
        <ChevronRight size={36} />
      </button>

      {/* Summary grid on last slide */}
      {atEnd && <SummaryOverlay summary={data} />}

      {/* Tap zones (mobile) */}
      <button
        type="button"
        aria-label="Previous"
        onClick={() => go(-1)}
        className="absolute inset-y-0 left-0 w-1/3 z-10 sm:hidden"
      />
      <button
        type="button"
        aria-label="Next"
        onClick={() => go(1)}
        className="absolute inset-y-0 right-0 w-1/3 z-10 sm:hidden"
      />
    </div>
  );
}
