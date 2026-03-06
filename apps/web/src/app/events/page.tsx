'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsApi } from '@/lib/api';
import { getUser, hasRole } from '@/lib/auth';
import { format } from 'date-fns';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Plus, MapPin, Clock, Check, X, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

function EventCard({ event, onApprove, onReject, onCancel, user }: any) {
  const isAdmin = hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const isSponsor = hasRole(user, 'SPONSOR');

  return (
    <Card className="hover:-translate-y-0.5 transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Badge
                variant={event.status === 'PUBLISHED' ? 'default' : event.status === 'CANCELLED' ? 'destructive' : 'secondary'}
                className={event.status === 'PUBLISHED' ? 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 border-transparent' : event.status === 'PENDING_APPROVAL' ? 'bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 border-transparent' : ''}
              >
                {event.status.replace(/_/g, ' ')}
              </Badge>
              <Badge variant="outline" className="text-blue-500 border-blue-500/30 bg-blue-500/10">
                {event.type}
              </Badge>
              {event.club && <Badge variant="secondary">{event.club.name}</Badge>}
            </div>
            <Link href={`/events/${event.id}`}>
              <h3 className="font-semibold text-foreground/90 hover:text-accent-500 transition-colors">{event.title}</h3>
            </Link>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Clock size={12} /> {format(new Date(event.startAt), 'EEE, MMM d · h:mm a')}</span>
              {event.location && <span className="flex items-center gap-1"><MapPin size={12} /> {event.location}</span>}
            </div>
          </div>
          {event.status === 'PENDING_APPROVAL' && isSponsor && (
            <div className="flex gap-2 flex-shrink-0">
              <Button size="sm" onClick={() => onApprove(event.id)} className="h-8 flex items-center gap-1"><Check size={14} /> Approve</Button>
              <Button size="sm" variant="destructive" onClick={() => onReject(event.id)} className="h-8 flex items-center gap-1"><X size={14} /> Reject</Button>
            </div>
          )}
          {event.status === 'PUBLISHED' && (isAdmin || event.authorId === user?.id) && (
            <Button variant="ghost" size="sm" onClick={() => onCancel(event.id)} className="text-red-500 hover:text-red-400 hover:bg-red-500/10 h-8">Cancel</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function EventsPage() {
  const user = getUser();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', location: '', startAt: '', endAt: '', clubId: '' });
  const canCreate = user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF', 'STUDENT_LEADER');

  const { data: events, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventsApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => eventsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); setShowNew(false); toast({ title: 'Event created' }); },
    onError: (e: any) => toast({ title: e.response?.data?.message || 'Failed', variant: 'destructive' }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => eventsApi.approve(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); toast({ title: 'Approved' }); },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => eventsApi.reject(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); toast({ title: 'Rejected' }); },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => eventsApi.cancel(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); toast({ title: 'Cancelled' }); },
  });

  const upcoming = (events || []).filter((e: any) => e.status === 'PUBLISHED' && new Date(e.startAt) >= new Date());
  const pending = (events || []).filter((e: any) => e.status === 'PENDING_APPROVAL');
  const past = (events || []).filter((e: any) => e.status === 'PUBLISHED' && new Date(e.startAt) < new Date());

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Events</h1>
            <p className="text-muted-foreground text-sm">School and club events</p>
          </div>
          {canCreate && (
            <Button onClick={() => setShowNew(true)} className="flex items-center gap-2">
              <Plus size={16} /> New Event
            </Button>
          )}
        </div>

        {showNew && canCreate && (
          <Card className="mb-6">
            <CardHeader className="pb-3 border-b mb-4">
              <CardTitle className="text-lg">Create Event</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ ...form, clubId: form.clubId || undefined, endAt: form.endAt || undefined }); }} className="space-y-4">
                <Input placeholder="Event title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
                <Input placeholder="Location (optional)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Start *</label>
                    <Input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} required />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block font-medium">End (optional)</label>
                    <Input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
                  </div>
                </div>
                {hasRole(user, 'STUDENT_LEADER') && (
                  <Input placeholder="Club ID (for club events)" value={form.clubId} onChange={(e) => setForm({ ...form, clubId: e.target.value })} />
                )}
                <div className="flex gap-2 pt-4 border-t border-border mt-4">
                  <Button type="submit" disabled={createMutation.isPending}>Create Event</Button>
                  <Button type="button" variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {pending.length > 0 && (
          <div className="mb-6">
            <h2 className="font-semibold text-muted-foreground mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
              <AlertCircle size={16} className="text-amber-500" /> Pending Approval ({pending.length})
            </h2>
            <div className="space-y-4">
              {pending.map((ev: any) => <EventCard key={ev.id} event={ev} user={user} onApprove={(id: string) => approveMutation.mutate(id)} onReject={(id: string) => rejectMutation.mutate(id)} onCancel={(id: string) => cancelMutation.mutate(id)} />)}
            </div>
          </div>
        )}

        <div className="mb-8">
          <h2 className="font-semibold text-muted-foreground mb-4 text-sm uppercase tracking-wider">Upcoming Events</h2>
          {isLoading ? <p className="text-muted-foreground text-sm">Loading…</p> :
            upcoming.length === 0 ? (
              <Card className="text-center py-12 border-dashed">
                <CardContent className="pt-6">
                  <p className="text-muted-foreground">No upcoming events</p>
                </CardContent>
              </Card>
            ) :
              <div className="space-y-4">{upcoming.map((ev: any) => <EventCard key={ev.id} event={ev} user={user} onApprove={(id: string) => approveMutation.mutate(id)} onReject={(id: string) => rejectMutation.mutate(id)} onCancel={(id: string) => cancelMutation.mutate(id)} />)}</div>}
        </div>

        {past.length > 0 && (
          <div>
            <h2 className="font-semibold text-muted-foreground mb-4 text-sm uppercase tracking-wider">Past Events</h2>
            <div className="space-y-4">
              {past.slice(0, 5).map((ev: any) => <EventCard key={ev.id} event={ev} user={user} onApprove={() => { }} onReject={() => { }} onCancel={() => { }} />)}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
