'use client';

import Link from 'next/link';
import {
  CalendarDays,
  ClipboardList,
  Megaphone,
  MessageSquare,
  Shield,
  Ticket,
  Users,
} from 'lucide-react';
import { Panel } from '@/components/layout/page-frame';
import { useCurrentUser, hasRole } from '@/lib/auth';

type Action = {
  label: string;
  href: string;
  Icon: React.ElementType;
  roles?: Parameters<typeof hasRole>[1][];
};

const ALL_ACTIONS: Action[] = [
  { label: 'Schedule', href: '/schedule', Icon: ClipboardList },
  { label: 'Announcements', href: '/announcements', Icon: Megaphone },
  { label: 'Events', href: '/events', Icon: Ticket },
  { label: 'Calendar', href: '/calendar', Icon: CalendarDays },
  { label: 'Clubs', href: '/clubs', Icon: Users },
  { label: 'Notifications', href: '/notifications', Icon: MessageSquare },
  { label: 'Admin console', href: '/admin', Icon: Shield, roles: ['ADMIN', 'SUPER_ADMIN'] },
];

export function QuickActionsWidget() {
  const user = useCurrentUser();

  const actions = ALL_ACTIONS.filter(
    (action) => !action.roles || (user && hasRole(user, ...action.roles)),
  );

  return (
    <Panel title="Quick actions" description="Jump to the places you use the most.">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {actions.map(({ label, href, Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col items-start gap-2 rounded-[1.4rem] border border-border/70 bg-muted/20 p-4 transition hover:-translate-y-0.5 hover:border-border hover:bg-muted/60"
          >
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
              <Icon className="size-4" />
            </div>
            <span className="text-sm font-medium text-foreground">{label}</span>
          </Link>
        ))}
      </div>
    </Panel>
  );
}
