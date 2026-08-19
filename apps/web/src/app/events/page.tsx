'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { format } from 'date-fns';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Plus, MapPin, Clock, Check, X, AlertCircle, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search';
import { Textarea } from '@/components/ui/textarea';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { filterBySearchQuery } from '@/lib/search';


function EventCard({ event, onApprove, onReject, onCancel, user, hydrated }: any) {
  const isAdmin = hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const isAuthor = event.authorId === user?.id || event.authorId === user?._id;

  return (
    <Card className="hover:-translate-y-0.5 transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Badge
                variant={event.status === 'PUBLISHED' ? 'solid' : event.status === 'CANCELLED' ? 'solid' : 'solid'}
                className={event.status === 'PUBLISHED' ? 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 border-transparent' : event.status === 'PENDING_APPROVAL' ? 'bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 border-transparent' : ''}
              >
                {event.status.replace(/_/g, ' ')}
              </Badge>
              <Badge
                variant="solid"
                className={event.club ? 'text-blue-500 border-blue-500/30 bg-blue-500/10' : ''}
              >
                {event.club?.name || 'General'}
              </Badge>
            </div>
            <Link href={`/events/${event._id}`}>
              <h3 className="font-semibold text-foreground/90 hover:text-accent-500 transition-colors">{event.title}</h3>
            </Link>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock size={12} /> {hydrated ? format(new Date(event.startAt), 'EEE, MMM d · h:mm a') : '—'}
              </span>
              {event.location && <span className="flex items-center gap-1"><MapPin size={12} /> {event.location}</span>}
            </div>
          </div>
          {event.status === 'PENDING_APPROVAL' && (
            <div className="flex gap-2 flex-shrink-0">
              <Button size="sm" leadingIcon={Check} onClick={() => onApprove(event._id)} className="h-8">Approve</Button>
              <Button size="sm" variant="primary" leadingIcon={X} onClick={() => onReject(event._id)} className="h-8">Reject</Button>
            </div>
          )}
          {event.status === 'PUBLISHED' && (isAdmin || isAuthor) && (
            <Button variant="ghost" size="sm" onClick={() => onCancel(event._id)} className="text-red-500 hover:text-red-400 hover:bg-red-500/10 h-8">Cancel</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function EventsPage() {
  const user = useCurrentUser();
  const [hydrated, setHydrated] = useState(false);
  const { toast } = useToast();
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [form, setForm] = useState({ title: '', description: '', location: '', startAt: '', endAt: '', clubId: '' });
  const canCreateGeneral = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF');

  useEffect(() => {
    setHydrated(true);
  }, []);

  const events = useQuery(api.events.events.list, hydrated && !!user ? {} : 'skip');
  const isLoading = events === undefined;

  const myClubs = useQuery(
    api.clubs.management.getMyClubs,
    hydrated && !!user ? {} : 'skip',
  );

  const pendingApprovals =
    useQuery(
      api.events.approvals.listPendingForSponsor,
      hydrated && !!user ? {} : 'skip',
    ) ?? [];

  const availableClubs = useMemo(
    () =>
      [
        ...((myClubs?.memberOf || []).filter(
          (club) => club.role === 'LEADER' || club.role === 'SPONSOR',
        )),
        ...(myClubs?.sponsoring || []),
      ].filter(
        (club, index, list) =>
          list.findIndex((item) => item._id === club._id) === index,
      ),
    [myClubs],
  );

  const canCreate = hydrated && !!user && (canCreateGeneral || availableClubs.length > 0);
  const selectedClubId =
    form.clubId || (!canCreateGeneral ? (availableClubs[0]?._id ?? '') : '');

  const createEvent = useMutation(api.events.events.create);
  const approveEvent = useMutation(api.events.approvals.approveEvent);
  const rejectEvent = useMutation(api.events.approvals.rejectEvent);
  const cancelEvent = useMutation(api.events.events.cancel);

  const [createPending, setCreatePending] = useState(false);

  const handleCreate = async () => {
    if (!form.startAt) {
      toast({ title: 'Start date is required', variant: 'destructive' });
      return;
    }
    if (!canCreateGeneral && !selectedClubId) {
      toast({ title: 'Choose a club for this event', variant: 'destructive' });
      return;
    }
    setCreatePending(true);
    try {
      await createEvent({
        title: form.title,
        description: form.description || undefined,
        location: form.location || undefined,
        startAt: new Date(form.startAt).getTime(),
        endAt: form.endAt ? new Date(form.endAt).getTime() : undefined,
        clubId: selectedClubId ? (selectedClubId as Id<'clubs'>) : undefined,
      });
      setShowNew(false);
      toast({ title: 'Event created' });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Failed',
        variant: 'destructive',
      });
    } finally {
      setCreatePending(false);
    }
  };

  const handleApprove = async (eventId: Id<'events'>) => {
    try {
      await approveEvent({ eventId });
      toast({ title: 'Approved' });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Failed',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (eventId: Id<'events'>) => {
    try {
      await rejectEvent({ eventId });
      toast({ title: 'Rejected' });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Failed',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = async (eventId: Id<'events'>) => {
    try {
      await cancelEvent({ eventId });
      toast({ title: 'Cancelled' });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Failed',
        variant: 'destructive',
      });
    }
  };

  const now = hydrated ? new Date() : null;
  const eventList = events ?? [];
  const upcoming = eventList.filter((e) => e.status === 'PUBLISHED' && (!now || e.startAt >= now.getTime()));
  const pending = pendingApprovals;
  const past = now
    ? eventList.filter((e) => e.status === 'PUBLISHED' && e.startAt < now.getTime())
    : [];

  const filterEvents = (list: any[]) => {
    return filterBySearchQuery(list, deferredSearch, (event) => [
      event.title,
      event.description,
      event.location,
      event.club?.name,
    ]);
  };

  const filteredUpcoming = useMemo(() => filterEvents(upcoming), [upcoming, deferredSearch]);
  const filteredPending = useMemo(() => filterEvents(pending), [pending, deferredSearch]);
  const filteredPast = useMemo(() => filterEvents(past), [past, deferredSearch]);

  const hasResults = filteredUpcoming.length > 0 || filteredPending.length > 0 || filteredPast.length > 0;
  const isSearching = deferredSearch.trim() !== '';

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Events</h1>
          </div>
          {canCreate && (
            <Button onClick={() => setShowNew(true)} leadingIcon={Plus}>
              New Event
            </Button>
          )}
        </div>

        <div className="mb-6">
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search events by title, location, or club..."
          />
        </div>

        {showNew && canCreate && (
          <Card className="mb-6">
            <CardHeader className="pb-3 border-b mb-4">
              <CardTitle className="text-lg">Create Event</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!form.startAt) {
                    toast({ title: 'Start date is required', variant: 'destructive' });
                    return;
                  }
                  void handleCreate();
                }}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <Input placeholder="Event title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={255} required />
                  {form.title.length >= 255 && (
                    <p className="text-xs text-destructive ml-1">Maximum length of 255 characters reached.</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={255} rows={3} />
                  {form.description.length >= 255 && (
                    <p className="text-xs text-destructive ml-1">Maximum length of 255 characters reached.</p>
                  )}
                </div>
                <Input placeholder="Location (optional)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Start *</label>
                    <DateTimePicker
                      value={form.startAt}
                      onChange={(startAt) => setForm({ ...form, startAt })}
                      buttonClassName="w-full"
                      disabledDays={
                        form.endAt
                          ? (date) => format(date, 'yyyy-MM-dd') > form.endAt.slice(0, 10)
                          : undefined
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block font-medium">End (optional)</label>
                    <DateTimePicker
                      value={form.endAt}
                      onChange={(endAt) => setForm({ ...form, endAt })}
                      buttonClassName="w-full"
                      disabledDays={
                        form.startAt
                          ? (date) => format(date, 'yyyy-MM-dd') < form.startAt.slice(0, 10)
                          : undefined
                      }
                      allowClear
                    />
                  </div>
                </div>
                {availableClubs.length > 0 ? (
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground mb-1.5 block font-medium">
                      {canCreateGeneral ? 'Club event (optional)' : 'Choose a club'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {canCreateGeneral ? (
                        <Button
                          type="button"
                          variant={selectedClubId ? 'tertiary' : 'primary'}
                          className="rounded-full"
                          onClick={() => setForm({ ...form, clubId: '' })}
                        >
                          General
                        </Button>
                      ) : null}
                      {availableClubs.map((club) => (
                        <Button
                          key={club._id}
                          type="button"
                          variant={selectedClubId === club._id ? 'primary' : 'tertiary'}
                          className="rounded-full"
                          onClick={() => setForm({ ...form, clubId: club._id })}
                        >
                          {club.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="flex gap-2 pt-4 border-t border-border mt-4">
                  <Button type="submit" disabled={createPending}>Create Event</Button>
                  <Button type="button" variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {!hasResults && isSearching ? (
          <Card className="text-center py-16 border-dashed">
            <Search size={40} className="mx-auto mb-3 opacity-30 text-muted-foreground" />
            <p className="font-medium">No events match your search</p>
            <p className="text-sm text-muted-foreground mt-1">Try a different title, location, or club name.</p>
            <Button variant="ghost" size="sm" onClick={() => setSearch('')} className="mt-2 font-semibold text-accent-500">
              Clear search
            </Button>
          </Card>
        ) : (
          <>
            {filteredPending.length > 0 && (
              <div className="mb-6">
                <h2 className="font-semibold text-muted-foreground mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <AlertCircle size={16} className="text-amber-500" /> Pending Approval ({filteredPending.length})
                </h2>
                <div className="space-y-4">
                  {filteredPending.map((ev) => <EventCard key={ev._id} event={ev} user={user} hydrated={hydrated} onApprove={handleApprove} onReject={handleReject} onCancel={handleCancel} />)}
                </div>
              </div>
            )}

            <div className="mb-8">
              <h2 className="font-semibold text-muted-foreground mb-4 text-sm uppercase tracking-wider">Upcoming Events</h2>
              {isLoading ? <p className="text-muted-foreground text-sm">Loading…</p> :
                filteredUpcoming.length === 0 ? (
                  <Card className="text-center py-12 border-dashed">
                    <CardContent className="pt-6">
                      <p className="text-muted-foreground">{isSearching ? 'No upcoming events match search' : 'No upcoming events'}</p>
                    </CardContent>
                  </Card>
                ) :
                  <div className="space-y-4">{filteredUpcoming.map((ev) => <EventCard key={ev._id} event={ev} user={user} hydrated={hydrated} onApprove={handleApprove} onReject={handleReject} onCancel={handleCancel} />)}</div>}
            </div>

            {filteredPast.length > 0 && (
              <div>
                <h2 className="font-semibold text-muted-foreground mb-4 text-sm uppercase tracking-wider">Past Events</h2>
                <div className="space-y-4">
                  {filteredPast.map((ev) => <EventCard key={ev._id} event={ev} user={user} hydrated={hydrated} onApprove={() => { }} onReject={() => { }} onCancel={() => { }} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
