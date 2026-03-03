'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsApi } from '@/lib/api';
import { getUser, hasRole } from '@/lib/auth';
import { format } from 'date-fns';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Plus, MapPin, Clock, Check, X, AlertCircle } from 'lucide-react';

function EventCard({ event, onApprove, onReject, onCancel, user }: any) {
  const isAdmin = hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const isSponsor = hasRole(user, 'SPONSOR');
  const statusColors: Record<string, string> = {
    PUBLISHED: 'badge-green',
    PENDING_APPROVAL: 'badge-yellow',
    DRAFT: 'badge-gray',
    CANCELLED: 'badge-red',
  };
  return (
    <div className="card hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={statusColors[event.status] || 'badge-gray'}>{event.status.replace(/_/g, ' ')}</span>
            <span className="badge-blue">{event.type}</span>
            {event.club && <span className="badge-gray">{event.club.name}</span>}
          </div>
          <Link href={`/events/${event.id}`}>
            <h3 className="font-semibold text-white/90 hover:text-accent-400 transition-colors">{event.title}</h3>
          </Link>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-white/40">
            <span className="flex items-center gap-1"><Clock size={11} /> {format(new Date(event.startAt), 'EEE, MMM d · h:mm a')}</span>
            {event.location && <span className="flex items-center gap-1"><MapPin size={11} /> {event.location}</span>}
          </div>
        </div>
        {event.status === 'PENDING_APPROVAL' && isSponsor && (
          <div className="flex gap-2">
            <button onClick={() => onApprove(event.id)} className="btn-primary py-1 px-2 text-xs flex items-center gap-1"><Check size={12}/> Approve</button>
            <button onClick={() => onReject(event.id)} className="btn-secondary py-1 px-2 text-xs flex items-center gap-1 text-red-400"><X size={12}/> Reject</button>
          </div>
        )}
        {event.status === 'PUBLISHED' && (isAdmin || event.authorId === user?.id) && (
          <button onClick={() => onCancel(event.id)} className="text-white/30 hover:text-red-400 text-xs transition-colors">Cancel</button>
        )}
      </div>
    </div>
  );
}

export default function EventsPage() {
  const user = getUser();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', location: '', startAt: '', endAt: '', clubId: '' });
  const canCreate = user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF', 'STUDENT_LEADER');

  const { data: events, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventsApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => eventsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); setShowNew(false); toast.success('Event created'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => eventsApi.approve(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); toast.success('Approved'); },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => eventsApi.reject(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); toast.success('Rejected'); },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => eventsApi.cancel(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); toast.success('Cancelled'); },
  });

  const upcoming = (events || []).filter((e: any) => e.status === 'PUBLISHED' && new Date(e.startAt) >= new Date());
  const pending = (events || []).filter((e: any) => e.status === 'PENDING_APPROVAL');
  const past = (events || []).filter((e: any) => e.status === 'PUBLISHED' && new Date(e.startAt) < new Date());

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Events</h1>
            <p className="text-white/45 text-sm">School and club events</p>
          </div>
          {canCreate && (
            <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={16} /> New Event
            </button>
          )}
        </div>

        {showNew && canCreate && (
          <div className="card mb-6">
            <h2 className="font-semibold text-white mb-4">Create Event</h2>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ ...form, clubId: form.clubId || undefined, endAt: form.endAt || undefined }); }} className="space-y-3">
              <input className="input" placeholder="Event title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              <textarea className="input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
              <input className="input" placeholder="Location (optional)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/45 mb-1 block">Start *</label>
                  <input type="datetime-local" className="input" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} required />
                </div>
                <div>
                  <label className="text-xs text-white/45 mb-1 block">End (optional)</label>
                  <input type="datetime-local" className="input" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
                </div>
              </div>
              {hasRole(user, 'STUDENT_LEADER') && (
                <input className="input" placeholder="Club ID (for club events)" value={form.clubId} onChange={(e) => setForm({ ...form, clubId: e.target.value })} />
              )}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary" disabled={createMutation.isPending}>Create Event</button>
                <button type="button" onClick={() => setShowNew(false)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {pending.length > 0 && (
          <div className="mb-6">
            <h2 className="font-semibold text-white/70 mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
              <AlertCircle size={16} className="text-amber-400" /> Pending Approval ({pending.length})
            </h2>
            <div className="space-y-3">
              {pending.map((ev: any) => <EventCard key={ev.id} event={ev} user={user} onApprove={(id: string) => approveMutation.mutate(id)} onReject={(id: string) => rejectMutation.mutate(id)} onCancel={(id: string) => cancelMutation.mutate(id)} />)}
            </div>
          </div>
        )}

        <div className="mb-6">
          <h2 className="font-semibold text-white/70 mb-3 text-sm uppercase tracking-wider">Upcoming Events</h2>
          {isLoading ? <p className="text-white/35 text-sm">Loading…</p> :
           upcoming.length === 0 ? <p className="text-white/35 text-sm text-center py-8">No upcoming events</p> :
           <div className="space-y-3">{upcoming.map((ev: any) => <EventCard key={ev.id} event={ev} user={user} onApprove={(id: string) => approveMutation.mutate(id)} onReject={(id: string) => rejectMutation.mutate(id)} onCancel={(id: string) => cancelMutation.mutate(id)} />)}</div>}
        </div>

        {past.length > 0 && (
          <div>
            <h2 className="font-semibold text-white/70 mb-3 text-sm uppercase tracking-wider">Past Events</h2>
            <div className="space-y-3">{past.slice(0, 5).map((ev: any) => <EventCard key={ev.id} event={ev} user={user} onApprove={() => {}} onReject={() => {}} onCancel={() => {}} />)}</div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
