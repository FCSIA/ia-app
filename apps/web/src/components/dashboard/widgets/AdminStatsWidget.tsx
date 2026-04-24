'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, AlertTriangle, Flag, Shield, Users } from 'lucide-react';
import { Panel } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { moderationApi, auditApi } from '@/lib/api';

function Stat({
  label,
  value,
  Icon,
  tone,
  href,
}: {
  label: string;
  value: number | string;
  Icon: React.ElementType;
  tone: 'primary' | 'amber' | 'emerald' | 'sky';
  href?: string;
}) {
  const toneMap: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    amber: 'bg-amber-500/10 text-amber-500',
    emerald: 'bg-emerald-500/10 text-emerald-500',
    sky: 'bg-sky-500/10 text-sky-500',
  };

  const content = (
    <div className="flex items-center gap-3 rounded-[1.4rem] border border-border/70 bg-muted/20 px-4 py-4 transition hover:-translate-y-0.5 hover:border-border hover:bg-muted/60">
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${toneMap[tone]}`}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export function AdminStatsWidget() {
  const { data: reports = [] } = useQuery({
    queryKey: ['moderation', 'reports'],
    queryFn: () => moderationApi.getReports().then((r) => r.data),
  });

  const { data: keywords = [] } = useQuery({
    queryKey: ['moderation', 'keywords'],
    queryFn: () => moderationApi.getKeywords().then((r) => r.data),
  });

  const { data: audit = [] } = useQuery({
    queryKey: ['audit', 'recent'],
    queryFn: () => auditApi.getAll({ limit: 10, offset: 0 }).then((r) => r.data),
  });

  const pendingReports = (reports as any[]).filter((r) => r.status === 'PENDING').length;
  const activeKeywords = (keywords as any[]).filter((k) => k.isActive).length;
  const auditCount = (audit as any[]).length;

  return (
    <Panel
      title="Instance pulse"
      action={
        <Button asChild variant="ghost" className="rounded-2xl">
          <Link href="/admin">
            Admin console
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat
          label="Pending reports"
          value={pendingReports}
          Icon={Flag}
          tone="amber"
          href="/admin"
        />
        <Stat
          label="Active keywords"
          value={activeKeywords}
          Icon={Shield}
          tone="primary"
          href="/admin"
        />
        <Stat
          label="Recent audit events"
          value={auditCount}
          Icon={AlertTriangle}
          tone="sky"
          href="/admin"
        />
        <Stat label="Quick link" value="Users" Icon={Users} tone="emerald" href="/admin" />
      </div>
    </Panel>
  );
}
