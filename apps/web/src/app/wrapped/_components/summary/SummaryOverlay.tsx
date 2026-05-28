'use client';

import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import {
  AtSign,
  Hash,
  MessageSquare,
  Puzzle,
  Sparkles,
  Star,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { WrappedSummary } from '../../_lib/types';
import { shortYear } from '../../_lib/utils';

export function SummaryOverlay({ summary }: { summary: WrappedSummary }) {
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
    {
      icon: Sparkles,
      label: 'Credits',
      value: `${summary.flexCredits}/${summary.flexCreditsRequired}`,
    },
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
