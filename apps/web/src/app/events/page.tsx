'use client';

import { AppShell } from '@/components/layout/AppShell';
import { hasRole } from '@/lib/auth';
import { format } from 'date-fns';
import Link from 'next/link';
import { Plus, MapPin, Check, X, AlertCircle, Search, Calendar } from 'lucide-react';
import { Card, CardGroup, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search';
import { Textarea } from '@/components/ui/textarea';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { cn } from '@/lib/utils';
import { CARD_SURFACE_FOREGROUND } from '@/lib/surface-classes';
import { useEventsPage } from './use-events-page';


function EventCard({ event, onApprove, onReject, onCancel, user, hydrated }: any) {
  const isAdmin = hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const isAuthor = event.authorId === user?.id || event.authorId === user?._id;

  const statusStyle = event.status === 'PUBLISHED'
    ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/25'
    : event.status === 'PENDING_APPROVAL'
    ? 'bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/25'
    : event.status === 'CANCELLED'
    ? 'bg-red-500/15 text-red-500 border-red-500/30 hover:bg-red-500/25'
    : 'bg-muted text-muted-foreground';

  const clubStyle = event.club
    ? 'text-blue-500 border-blue-500/30 bg-blue-500/10'
    : 'text-muted-foreground border-border/30 bg-muted/20';

  return (
    <CardGroup border="outlined" className={cn(
      'overflow-hidden border-border bg-card',
      CARD_SURFACE_FOREGROUND,
    )}>
      <Card className="bg-transparent">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2.5">
                <Badge variant="solid" size="sm" className={cn(statusStyle)}>
                  {event.status.replace(/_/g, ' ')}
                </Badge>
                <Badge variant="solid" size="sm" className={cn(clubStyle)}>
                  {event.club?.name || 'General'}
                </Badge>
              </div>
              <Link href={`/events/${event._id}`} className="block">
                <h3 className="font-semibold text-foreground leading-snug hover:text-primary transition-colors group">
                  {event.title}
                </h3>
              </Link>
              <div className="flex flex-wrap items-center gap-3 mt-2.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar size={12} className="shrink-0" />
                  {hydrated ? format(new Date(event.startAt), 'EEE, MMM d · h:mm a') : '—'}
                </span>
                {event.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={12} className="shrink-0" />
                    {event.location}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
              {event.status === 'PENDING_APPROVAL' && (
                <div className="flex gap-2">
                  <Button size="sm" leadingIcon={Check} onClick={() => onApprove(event._id)} className="h-8 gap-1.5">
                    Approve
                  </Button>
                  <Button size="sm" variant="primary" leadingIcon={X} onClick={() => onReject(event._id)} className="h-8 gap-1.5">
                    Reject
                  </Button>
                </div>
              )}
              {event.status === 'PUBLISHED' && (isAdmin || isAuthor) && (
                <Button variant="ghost" size="sm" onClick={() => onCancel(event._id)} className="text-red-500 hover:text-red-400 hover:bg-red-500/10 h-8 gap-1.5" leadingIcon={X}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </CardGroup>
  );
}

export default function EventsPage() {
  const {
    user, hydrated, toast, showNew, setShowNew, search, setSearch, form, setForm,
    canCreateGeneral, canCreate, availableClubs, selectedClubId, createPending,
    handleCreate, handleApprove, handleReject, handleCancel, isLoading,
    filteredUpcoming, filteredPending, filteredPast, hasResults, isSearching,
  } = useEventsPage();

  return (
    <AppShell>
      <div className={cn(
        'relative isolate mx-auto max-w-3xl space-y-6',
        'before:pointer-events-none before:absolute before:-inset-3 before:-z-10',
        'before:rounded-2xl before:border before:border-border before:bg-card',
      )}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Events</h1>
          {canCreate && (
            <Button onClick={() => setShowNew(true)} leadingIcon={Plus}>
              New Event
            </Button>
          )}
        </div>

        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Search events by title, location, or club..."
          className="bg-background border-border focus:border-primary focus:ring-primary/20"
        />

        {showNew && canCreate && (
          <CardGroup border="outlined" className={cn('overflow-hidden bg-card border-border', CARD_SURFACE_FOREGROUND)}>
            <Card className="bg-transparent">
              <CardHeader className="pb-3 border-b border-border/40 mb-4">
                <CardTitle className="text-lg font-semibold">Create Event</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  <Input
                    placeholder="Event title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    maxLength={160}
                    required
                    className="border-border/60 focus:border-primary focus:ring-primary/20"
                  />
                  <Textarea
                    placeholder="Description"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    maxLength={2000}
                    rows={3}
                    className="border-border/60 focus:border-primary focus:ring-primary/20"
                  />
                  <Input
                    placeholder="Location (optional)"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="border-border/60 focus:border-primary focus:ring-primary/20"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Start *</label>
                      <DateTimePicker
                        value={form.startAt}
                        onChange={(startAt) => setForm({ ...form, startAt })}
                        buttonClassName="w-full border-border/60 focus:border-primary focus:ring-primary/20"
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
                        buttonClassName="w-full border-border/60 focus:border-primary focus:ring-primary/20"
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
                            className="rounded-full transition-colors duration-150"
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
                            className="rounded-full transition-colors duration-150"
                            onClick={() => setForm({ ...form, clubId: club._id })}
                          >
                            {club.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="flex gap-2 pt-4 border-t border-border/40 mt-4">
                    <Button type="submit" disabled={createPending} className="flex-1">
                      Create Event
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setShowNew(false)} className="flex-1">
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </CardGroup>
        )}

        {!hasResults && isSearching ? (
          <CardGroup border="outlined" className={cn('overflow-hidden bg-card border-border', CARD_SURFACE_FOREGROUND)}>
            <Card className="bg-transparent">
              <CardContent className="text-center py-16">
                <Search size={40} className="mx-auto mb-3 opacity-30 text-muted-foreground" />
                <p className="font-medium">No events match your search</p>
                <p className="text-sm text-muted-foreground mt-1">Try a different title, location, or club name.</p>
                <Button variant="ghost" size="sm" onClick={() => setSearch('')} className="mt-2 font-semibold text-accent-500">
                  Clear search
                </Button>
              </CardContent>
            </Card>
          </CardGroup>
        ) : (
          <>
            {filteredPending.length > 0 && (
              <section className="space-y-4">
                <h2 className="flex items-center gap-2 text-sm uppercase tracking-wider font-semibold text-muted-foreground">
                  <AlertCircle size={16} className="text-amber-500" /> Pending Approval ({filteredPending.length})
                </h2>
                <div className="space-y-4">
                  {filteredPending.map((ev) => <EventCard key={ev._id} event={ev} user={user} hydrated={hydrated} onApprove={handleApprove} onReject={handleReject} onCancel={handleCancel} />)}
                </div>
              </section>
            )}

            <section className="space-y-4">
              <h2 className="text-sm uppercase tracking-wider font-semibold text-foreground">Upcoming Events</h2>
              {isLoading ? (
                <p className="text-muted-foreground text-sm">Loading…</p>
              ) : filteredUpcoming.length === 0 ? (
          <CardGroup border="outlined" className={cn('overflow-hidden bg-card border-border border-dashed', CARD_SURFACE_FOREGROUND)}>
                  <Card className="bg-transparent">
                    <CardContent className="text-center py-12">
                      <p className="text-muted-foreground">{isSearching ? 'No upcoming events match search' : 'No upcoming events'}</p>
                    </CardContent>
                  </Card>
                </CardGroup>
              ) : (
                <div className="space-y-4">
                  {filteredUpcoming.map((ev) => <EventCard key={ev._id} event={ev} user={user} hydrated={hydrated} onApprove={handleApprove} onReject={handleReject} onCancel={handleCancel} />)}
                </div>
              )}
            </section>

            {filteredPast.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-sm uppercase tracking-wider font-semibold text-foreground">Past Events</h2>
                <div className="space-y-4">
                  {filteredPast.map((ev) => <EventCard key={ev._id} event={ev} user={user} hydrated={hydrated} onApprove={() => { }} onReject={() => { }} onCancel={() => { }} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
