import { useDeferredValue, useMemo, useState, useSyncExternalStore } from 'react';
import { useMutation, useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { filterBySearchQuery } from '@/lib/search';

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useEventsPage() {
  const user = useCurrentUser();
  const hydrated = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);
  const { toast } = useToast();
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [form, setForm] = useState({ title: '', description: '', location: '', startAt: '', endAt: '', clubId: '' });
  const [createPending, setCreatePending] = useState(false);
  const canCreateGeneral = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF');

  const events = useQuery(api.events.events.list, user ? {} : 'skip');
  const isLoading = events === undefined;
  const myClubs = useQuery(api.clubs.management.getMyClubs, user ? {} : 'skip');
  const pendingApprovals = useQuery(api.events.approvals.listPendingForSponsor, user ? {} : 'skip') ?? [];

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
  const selectedClubId = form.clubId || (!canCreateGeneral ? (availableClubs[0]?._id ?? '') : '');

  const createEvent = useMutation(api.events.events.create);
  const approveEvent = useMutation(api.events.approvals.approveEvent);
  const rejectEvent = useMutation(api.events.approvals.rejectEvent);
  const cancelEvent = useMutation(api.events.events.cancel);

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
      toast({ title: error instanceof Error ? error.message : 'Failed', variant: 'destructive' });
    } finally {
      setCreatePending(false);
    }
  };

  const handleApprove = async (eventId: Id<'events'>) => {
    try {
      await approveEvent({ eventId });
      toast({ title: 'Approved' });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : 'Failed', variant: 'destructive' });
    }
  };

  const handleReject = async (eventId: Id<'events'>) => {
    try {
      await rejectEvent({ eventId });
      toast({ title: 'Rejected' });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : 'Failed', variant: 'destructive' });
    }
  };

  const handleCancel = async (eventId: Id<'events'>) => {
    try {
      await cancelEvent({ eventId });
      toast({ title: 'Cancelled' });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : 'Failed', variant: 'destructive' });
    }
  };

  const now = hydrated ? new Date() : null;
  const eventList = events ?? [];
  const upcoming = eventList.filter((event) => event.status === 'PUBLISHED' && (!now || event.startAt >= now.getTime()));
  const past = now
    ? eventList.filter((event) => event.status === 'PUBLISHED' && event.startAt < now.getTime())
    : [];

  const filterEvents = (list: typeof eventList) => filterBySearchQuery(list, deferredSearch, (event) => [
    event.title,
    event.description,
    event.location,
    event.club?.name,
  ]);

  const filteredUpcoming = filterEvents(upcoming);
  const filteredPending = filterEvents(pendingApprovals);
  const filteredPast = filterEvents(past);
  const hasResults = filteredUpcoming.length > 0 || filteredPending.length > 0 || filteredPast.length > 0;
  const isSearching = deferredSearch.trim() !== '';

  return {
    user, hydrated, toast, showNew, setShowNew, search, setSearch, form, setForm,
    canCreateGeneral, canCreate, availableClubs, selectedClubId, createPending,
    handleCreate, handleApprove, handleReject, handleCancel, isLoading,
    filteredUpcoming, filteredPending, filteredPast, hasResults, isSearching,
  };
}
