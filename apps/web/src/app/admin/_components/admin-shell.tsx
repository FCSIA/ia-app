'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChartLine, ContactRound, FileText, MessageSquareText, MessageSquareWarning, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip } from '@/components/ui/tooltip';
import type { AdminTabId } from '../_hooks/use-admin-tab';

type AdminShellProps = { activeTab: AdminTabId; onTabChange: (tab: AdminTabId) => void; isSuperAdmin: boolean; canManageWrapped: boolean; pendingReports: number; children: ReactNode };
export function AdminShell({ activeTab, onTabChange, isSuperAdmin, canManageWrapped, pendingReports, children }: AdminShellProps) {
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams?.toString() ?? '');
  params.delete('tab');
  const suffix = params.size ? `?${params}` : '';
  const sections = [
    { id: 'users' as const, label: 'Users', group: 'People', icon: Users, visible: true },
    { id: 'schedule' as const, label: 'Student roster', group: 'People', icon: ContactRound, visible: isSuperAdmin },
    { id: 'administrator-roster' as const, label: 'Admin roster', group: 'People', icon: ShieldCheck, visible: isSuperAdmin },
    { id: 'moderation' as const, label: pendingReports ? `Reports (${pendingReports})` : 'Reports', group: 'Safety', icon: MessageSquareWarning, visible: true },
    { id: 'feedback' as const, label: 'Feedback', group: 'Safety', icon: MessageSquareText, visible: isSuperAdmin },
    { id: 'wrapped' as const, label: 'Wrapped', group: 'Insights', icon: Sparkles, visible: canManageWrapped },
    { id: 'analytics' as const, label: 'Analytics', group: 'Insights', icon: ChartLine, visible: isSuperAdmin },
    { id: 'audit' as const, label: 'Audit log', group: 'Insights', icon: FileText, visible: true },
  ].filter((section) => section.visible);
  return <div className="admin-shell flex h-full min-h-0 min-w-0 w-full flex-1 flex-col gap-3 lg:flex-row lg:gap-5">
    <div className="shrink-0 lg:hidden"><Select value={activeTab} onValueChange={(value) => onTabChange(value as AdminTabId)}><SelectTrigger aria-label="Admin section" /><SelectContent>{sections.map((section, index) => <SelectItem key={section.id} index={index} value={section.id}>{section.label}</SelectItem>)}</SelectContent></Select></div>
    <nav aria-label="Admin sections" className="hidden w-14 shrink-0 border-r border-border/60 pr-2 lg:flex xl:w-52">
      <ScrollArea className="min-h-0 w-full"><div className="flex flex-col gap-1 py-1">{sections.map((section, index) => <div key={section.id}>
        {index === 0 || section.group !== sections[index - 1]?.group ? <p className="hidden px-3 pb-1 pt-4 text-xs text-muted-foreground xl:block">{section.group}</p> : null}
        <div className="hidden xl:block"><Button asChild variant="ghost" className="w-full justify-start" active={activeTab === section.id} leadingIcon={section.icon} aria-current={activeTab === section.id ? 'page' : undefined}><Link href={`/admin/${section.id}${suffix}`}>{section.label}</Link></Button></div>
        <div className="xl:hidden"><Tooltip content={section.label} side="right"><Button asChild variant="ghost" size="icon" active={activeTab === section.id} aria-label={section.label} aria-current={activeTab === section.id ? 'page' : undefined}><Link href={`/admin/${section.id}${suffix}`}><section.icon /></Link></Button></Tooltip></div>
      </div>)}</div></ScrollArea>
    </nav>
    <div className="flex min-h-0 min-w-0 flex-1">{children}</div>
  </div>;
}
