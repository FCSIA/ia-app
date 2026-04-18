'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { flexFridayApi } from '@/lib/api';
import { getUser, hasRole } from '@/lib/auth';
import { format, parseISO } from 'date-fns';
import {
  Plus,
  Users,
  MapPin,
  CheckCircle,
  CalendarIcon,
  Ticket,
  ChevronRight,
  Search,
  X,
  Clock,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const PATHWAY_OPTIONS = [
  { value: 'INFORMATION_TECHNOLOGY', label: 'Information Technology' },
  { value: 'HEALTH_SCIENCE', label: 'Health Science' },
  { value: 'ENGINEERING', label: 'Engineering' },
];
const GRADE_OPTIONS = [9, 10, 11, 12];

const EMPTY_SESSION_FORM = {
  title: '',
  description: '',
  sessionType: 'STUDENT_CHOICE' as 'STUDENT_CHOICE' | 'TEACHER_ASSIGNED',
  startTime: '13:00',
  endTime: '14:30',
};

const EMPTY_WORKSHOP_FORM = {
  title: '',
  description: '',
  location: '',
  capacity: '',
  sessionIds: [] as string[],
  targetGrades: [] as number[],
  targetMajorPathways: [] as string[],
  targetMinorPathways: [] as string[],
};

function formatTimeRange(start?: string, end?: string) {
  const fmt = (t?: string) => {
    if (!t) return '';
    const [h, m] = t.split(':').map((x) => parseInt(x, 10));
    const hour12 = ((h + 11) % 12) + 1;
    const suffix = h >= 12 ? 'PM' : 'AM';
    return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

function pathwayLabel(value: string) {
  return PATHWAY_OPTIONS.find((p) => p.value === value)?.label ?? value.replace(/_/g, ' ');
}

export default function FlexFridayPage() {
  const user = getUser();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [selectedFriday, setSelectedFriday] = useState<any>(null);
  const [selectedSession, setSelectedSession] = useState<any>(null);

  const [showNewFriday, setShowNewFriday] = useState(false);
  const [fridayForm, setFridayForm] = useState({
    date: '',
    type: 'ALL_STUDENT' as any,
    gradeLevel: '9',
    pathway: 'INFORMATION_TECHNOLOGY' as any,
    notes: '',
    isSchoolDay: true,
  });

  // Session form doubles as create + edit
  const [sessionFormOpen, setSessionFormOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionForm, setSessionForm] = useState(EMPTY_SESSION_FORM);

  // Workshop form doubles as create + edit
  const [workshopFormOpen, setWorkshopFormOpen] = useState(false);
  const [editingWorkshopId, setEditingWorkshopId] = useState<string | null>(null);
  const [workshopForm, setWorkshopForm] = useState(EMPTY_WORKSHOP_FORM);

  const [sessionSearch, setSessionSearch] = useState('');
  const deferredSessionSearch = useDeferredValue(sessionSearch);
  const [workshopSearch, setWorkshopSearch] = useState('');
  const deferredWorkshopSearch = useDeferredValue(workshopSearch);

  const canManage = user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const canCreateSession = user && hasRole(user, 'TEACHER', 'ADMIN', 'SUPER_ADMIN');
  const isStudent = user && hasRole(user, 'STUDENT');

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: fridays = [], isLoading } = useQuery({
    queryKey: ['flex-fridays'],
    queryFn: () => flexFridayApi.getAll().then((r) => r.data),
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['flex-sessions', selectedFriday?.id],
    queryFn: () => flexFridayApi.getSessions(selectedFriday.id).then((r) => r.data),
    enabled: !!selectedFriday,
  });

  const { data: workshops = [] } = useQuery({
    queryKey: ['flex-workshops', selectedFriday?.id, selectedSession?.id],
    queryFn: () =>
      flexFridayApi
        .getWorkshops(selectedFriday.id, selectedSession.id)
        .then((r) => r.data),
    enabled: !!selectedFriday && !!selectedSession,
  });

  const { data: myRegs = [] } = useQuery({
    queryKey: ['my-flex-registrations'],
    queryFn: () => flexFridayApi.getMyRegistrations().then((r) => r.data),
  });

  const filteredSessions = useMemo(() => {
    const query = deferredSessionSearch.trim().toLowerCase();
    if (!query) return sessions;
    return (sessions as any[]).filter((s) => {
      const searchable = [s.title, s.description].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(query);
    });
  }, [sessions, deferredSessionSearch]);

  const filteredWorkshops = useMemo(() => {
    const query = deferredWorkshopSearch.trim().toLowerCase();
    if (!query) return workshops;
    return (workshops as any[]).filter((w) => {
      const searchable = [w.title, w.description, w.location].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(query);
    });
  }, [workshops, deferredWorkshopSearch]);

  const myRegWorkshopIds = new Set((myRegs as any[]).map((r: any) => r.workshopId));
  const selectedCreateDate = fridayForm.date ? parseISO(fridayForm.date) : undefined;

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createFridayMutation = useMutation({
    mutationFn: (d: any) => flexFridayApi.createFriday(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flex-fridays'] });
      setShowNewFriday(false);
      toast({ title: 'Flex Friday created' });
    },
    onError: (e: any) => toast({ title: e.response?.data?.message || 'Failed', variant: 'destructive' }),
  });

  const createSessionMutation = useMutation({
    mutationFn: (d: any) => flexFridayApi.createSession(selectedFriday.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flex-sessions', selectedFriday?.id] });
      closeSessionForm();
      toast({ title: 'Session created' });
    },
    onError: (e: any) => toast({ title: e.response?.data?.message || 'Failed', variant: 'destructive' }),
  });

  const updateSessionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => flexFridayApi.updateSession(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flex-sessions', selectedFriday?.id] });
      qc.invalidateQueries({ queryKey: ['flex-workshops', selectedFriday?.id] });
      closeSessionForm();
      toast({ title: 'Session updated' });
    },
    onError: (e: any) => toast({ title: e.response?.data?.message || 'Failed', variant: 'destructive' }),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (id: string) => flexFridayApi.deleteSession(id),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: ['flex-sessions', selectedFriday?.id] });
      if (selectedSession?.id === id) setSelectedSession(null);
      toast({ title: 'Session deleted' });
    },
    onError: (e: any) => toast({ title: e.response?.data?.message || 'Failed', variant: 'destructive' }),
  });

  const createWorkshopMutation = useMutation({
    mutationFn: (d: any) => flexFridayApi.createWorkshop(selectedFriday.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flex-workshops', selectedFriday?.id, selectedSession?.id] });
      closeWorkshopForm();
      toast({ title: 'Workshop created' });
    },
    onError: (e: any) => toast({ title: e.response?.data?.message || 'Failed', variant: 'destructive' }),
  });

  const updateWorkshopMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => flexFridayApi.updateWorkshop(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flex-workshops', selectedFriday?.id, selectedSession?.id] });
      closeWorkshopForm();
      toast({ title: 'Workshop updated' });
    },
    onError: (e: any) => toast({ title: e.response?.data?.message || 'Failed', variant: 'destructive' }),
  });

  const deleteWorkshopMutation = useMutation({
    mutationFn: (id: string) => flexFridayApi.deleteWorkshop(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flex-workshops', selectedFriday?.id, selectedSession?.id] });
      toast({ title: 'Workshop deleted' });
    },
    onError: (e: any) => toast({ title: e.response?.data?.message || 'Failed', variant: 'destructive' }),
  });

  const registerMutation = useMutation({
    mutationFn: (workshopId: string) => flexFridayApi.register(workshopId),
    onMutate: async (workshopId: string) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: ['flex-workshops', selectedFriday?.id, selectedSession?.id] }),
        qc.cancelQueries({ queryKey: ['my-flex-registrations'] }),
      ]);
      const prevWorkshops = qc.getQueryData(['flex-workshops', selectedFriday?.id, selectedSession?.id]);
      const prevRegs = qc.getQueryData(['my-flex-registrations']);
      qc.setQueryData(['flex-workshops', selectedFriday?.id, selectedSession?.id], (current: any[] | undefined) =>
        current?.map((w) =>
          w.id === workshopId
            ? { ...w, _count: { ...w._count, registrations: (w._count?.registrations || 0) + 1 } }
            : w,
        ),
      );
      qc.setQueryData(['my-flex-registrations'], (current: any[] | undefined) => {
        if ((current || []).some((r) => r.workshopId === workshopId)) return current;
        return [...(current || []), { id: `optimistic-${workshopId}`, workshopId }];
      });
      return { prevWorkshops, prevRegs };
    },
    onSuccess: () => toast({ title: 'Registered!' }),
    onError: (e: any, _wid, ctx) => {
      qc.setQueryData(['flex-workshops', selectedFriday?.id, selectedSession?.id], ctx?.prevWorkshops);
      qc.setQueryData(['my-flex-registrations'], ctx?.prevRegs);
      toast({ title: e.response?.data?.message || 'Could not register', variant: 'destructive' });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['flex-workshops', selectedFriday?.id, selectedSession?.id] });
      qc.invalidateQueries({ queryKey: ['my-flex-registrations'] });
    },
  });

  const unregisterMutation = useMutation({
    mutationFn: (workshopId: string) => flexFridayApi.unregister(workshopId),
    onMutate: async (workshopId: string) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: ['flex-workshops', selectedFriday?.id, selectedSession?.id] }),
        qc.cancelQueries({ queryKey: ['my-flex-registrations'] }),
      ]);
      const prevWorkshops = qc.getQueryData(['flex-workshops', selectedFriday?.id, selectedSession?.id]);
      const prevRegs = qc.getQueryData(['my-flex-registrations']);
      qc.setQueryData(['flex-workshops', selectedFriday?.id, selectedSession?.id], (current: any[] | undefined) =>
        current?.map((w) =>
          w.id === workshopId
            ? { ...w, _count: { ...w._count, registrations: Math.max((w._count?.registrations || 1) - 1, 0) } }
            : w,
        ),
      );
      qc.setQueryData(['my-flex-registrations'], (current: any[] | undefined) =>
        (current || []).filter((r) => r.workshopId !== workshopId),
      );
      return { prevWorkshops, prevRegs };
    },
    onSuccess: () => toast({ title: 'Unregistered' }),
    onError: (e: any, _wid, ctx) => {
      qc.setQueryData(['flex-workshops', selectedFriday?.id, selectedSession?.id], ctx?.prevWorkshops);
      qc.setQueryData(['my-flex-registrations'], ctx?.prevRegs);
      toast({ title: e.response?.data?.message || 'Could not unregister', variant: 'destructive' });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['flex-workshops', selectedFriday?.id, selectedSession?.id] });
      qc.invalidateQueries({ queryKey: ['my-flex-registrations'] });
    },
  });

  // ── Form helpers ──────────────────────────────────────────────────────────
  const openNewSessionForm = () => {
    setEditingSessionId(null);
    setSessionForm(EMPTY_SESSION_FORM);
    setSessionFormOpen(true);
  };

  const openEditSessionForm = (s: any) => {
    setEditingSessionId(s.id);
    setSessionForm({
      title: s.title ?? '',
      description: s.description ?? '',
      sessionType: s.sessionType,
      startTime: s.startTime ?? '13:00',
      endTime: s.endTime ?? '14:30',
    });
    setSessionFormOpen(true);
  };

  const closeSessionForm = () => {
    setSessionFormOpen(false);
    setEditingSessionId(null);
    setSessionForm(EMPTY_SESSION_FORM);
  };

  const submitSessionForm = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: sessionForm.title,
      description: sessionForm.description || undefined,
      sessionType: sessionForm.sessionType,
      startTime: sessionForm.startTime,
      endTime: sessionForm.endTime,
    };
    if (editingSessionId) {
      updateSessionMutation.mutate({ id: editingSessionId, data: payload });
    } else {
      createSessionMutation.mutate(payload);
    }
  };

  const openNewWorkshopForm = () => {
    setEditingWorkshopId(null);
    // Preselect the currently selected session
    setWorkshopForm({
      ...EMPTY_WORKSHOP_FORM,
      sessionIds: selectedSession ? [selectedSession.id] : [],
    });
    setWorkshopFormOpen(true);
  };

  const openEditWorkshopForm = (w: any) => {
    setEditingWorkshopId(w.id);
    setWorkshopForm({
      title: w.title ?? '',
      description: w.description ?? '',
      location: w.location ?? '',
      capacity: w.capacity != null ? String(w.capacity) : '',
      sessionIds: Array.isArray(w.linkedSessions)
        ? w.linkedSessions.map((s: any) => s.id)
        : Array.isArray(w.sessions)
          ? w.sessions.map((link: any) => link.session?.id ?? link.sessionId).filter(Boolean)
          : [],
      targetGrades: Array.isArray(w.targetGrades) ? w.targetGrades : [],
      targetMajorPathways: Array.isArray(w.targetMajorPathways) ? w.targetMajorPathways : [],
      targetMinorPathways: Array.isArray(w.targetMinorPathways) ? w.targetMinorPathways : [],
    });
    setWorkshopFormOpen(true);
  };

  const closeWorkshopForm = () => {
    setWorkshopFormOpen(false);
    setEditingWorkshopId(null);
    setWorkshopForm(EMPTY_WORKSHOP_FORM);
  };

  const toggleInArray = <T,>(arr: T[], value: T): T[] =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  const submitWorkshopForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (workshopForm.sessionIds.length === 0) {
      toast({ title: 'Pick at least one session', variant: 'destructive' });
      return;
    }
    const payload = {
      title: workshopForm.title,
      description: workshopForm.description || undefined,
      location: workshopForm.location || undefined,
      capacity: workshopForm.capacity ? parseInt(workshopForm.capacity) : undefined,
      sessionIds: workshopForm.sessionIds,
      targetGrades: workshopForm.targetGrades,
      targetMajorPathways: workshopForm.targetMajorPathways,
      targetMinorPathways: workshopForm.targetMinorPathways,
    };
    if (editingWorkshopId) {
      updateWorkshopMutation.mutate({ id: editingWorkshopId, data: payload });
    } else {
      createWorkshopMutation.mutate(payload);
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectFriday = (f: any) => {
    setSelectedFriday(f);
    setSelectedSession(null);
    closeSessionForm();
    closeWorkshopForm();
  };

  // Close forms when switching sessions
  useEffect(() => {
    closeWorkshopForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession?.id]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Flex Friday</h1>
            <p className="text-muted-foreground text-sm">Sessions, workshops, and registration</p>
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <Button onClick={() => setShowNewFriday(true)} className="flex items-center gap-2">
                <Plus size={16} /> Schedule Friday
              </Button>
            )}
            {isStudent && (
              <Link href="/flex-friday/pass">
                <Button className="flex items-center gap-2 border-transparent bg-orange-500 text-white shadow-sm hover:bg-orange-600">
                  <Ticket size={15} /> My Pass
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* New Friday form */}
        {showNewFriday && canManage && (
          <Card className="mb-6">
            <CardHeader className="pb-3 border-b mb-4">
              <CardTitle className="text-lg">Schedule Flex Friday</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createFridayMutation.mutate({
                    date: fridayForm.date,
                    type: fridayForm.type,
                    notes: fridayForm.notes,
                    isSchoolDay: fridayForm.type !== 'TEACHER_PD',
                    pathway: fridayForm.type === 'PATHWAY_SPECIFIC' ? fridayForm.pathway : undefined,
                    gradeLevel: fridayForm.type === 'GRADE_SPECIFIC' ? Number(fridayForm.gradeLevel) : undefined,
                  });
                }}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block font-medium">Date *</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn('w-full justify-start text-left font-normal', !fridayForm.date && 'text-muted-foreground')}
                      >
                        <CalendarIcon className="mr-2 size-4" />
                        {fridayForm.date ? format(selectedCreateDate!, 'PPP') : 'Pick a Friday'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[19rem] p-0" align="start">
                      <Calendar
                        className="w-full"
                        mode="single"
                        selected={selectedCreateDate}
                        onSelect={(date) => setFridayForm({ ...fridayForm, date: date ? format(date, 'yyyy-MM-dd') : '' })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block font-medium">Type</label>
                  <Select value={fridayForm.type} onValueChange={(value) => setFridayForm((c) => ({ ...c, type: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL_STUDENT">All Student</SelectItem>
                      <SelectItem value="GRADE_SPECIFIC">Grade Specific</SelectItem>
                      <SelectItem value="PATHWAY_SPECIFIC">Pathway Specific</SelectItem>
                      <SelectItem value="TEACHER_PD">Teacher PD (No School)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {fridayForm.type === 'PATHWAY_SPECIFIC' && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block font-medium">Pathway</label>
                    <Select value={fridayForm.pathway} onValueChange={(v) => setFridayForm({ ...fridayForm, pathway: v })}>
                      <SelectTrigger><SelectValue placeholder="Select pathway" /></SelectTrigger>
                      <SelectContent>
                        {PATHWAY_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {fridayForm.type === 'GRADE_SPECIFIC' && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block font-medium">Grade</label>
                    <Select value={fridayForm.gradeLevel} onValueChange={(v) => setFridayForm({ ...fridayForm, gradeLevel: v })}>
                      <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                      <SelectContent>
                        {GRADE_OPTIONS.map((g) => <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block font-medium">Notes (optional)</label>
                  <Textarea placeholder="Notes (optional)" value={fridayForm.notes} onChange={(e) => setFridayForm({ ...fridayForm, notes: e.target.value })} rows={2} />
                </div>
                <div className="flex gap-2 pt-2 border-t border-border mt-2">
                  <Button type="submit" disabled={createFridayMutation.isPending || !fridayForm.date}>Create</Button>
                  <Button type="button" variant="ghost" onClick={() => setShowNewFriday(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── 3-column layout ─────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-[260px_1fr_1fr] gap-6">

          {/* Col 1: Fridays */}
          <div>
            <h2 className="font-semibold text-muted-foreground mb-4 text-sm uppercase tracking-wider">Scheduled Fridays</h2>
            {isLoading ? <p className="text-muted-foreground text-sm">Loading…</p> :
              (fridays as any[]).length === 0 ? <p className="text-muted-foreground text-sm">No Flex Fridays scheduled</p> :
                <div className="space-y-2">
                  {(fridays as any[]).map((f) => (
                    <button key={f.id} onClick={() => handleSelectFriday(f)}
                      className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${selectedFriday?.id === f.id
                        ? 'border-accent-500/40 bg-accent-500/10 text-foreground dark:text-white ring-1 ring-accent-500/20'
                        : 'border-border hover:border-accent-500/20 bg-background hover:bg-accent-500/5 text-foreground/80 hover:text-foreground'
                        }`}>
                      <p className="font-semibold text-sm">{format(new Date(f.date), 'EEE, MMM d, yyyy')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 font-medium">{f.type.replace(/_/g, ' ')}</p>
                      {f.pathway && <p className="text-xs text-muted-foreground mt-0.5">{f.pathway.replace(/_/g, ' ')}</p>}
                      {f.gradeLevel && <p className="text-xs text-muted-foreground mt-0.5">Grade {f.gradeLevel}</p>}
                      {f._count?.sessions > 0 && (
                        <p className="text-xs text-muted-foreground/80 mt-1 flex items-center gap-1.5">
                          <span className="w-1 h-1 bg-accent-500 rounded-full inline-block" />
                          {f._count.sessions} session{f._count.sessions === 1 ? '' : 's'}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
            }
          </div>

          {/* Col 2: Sessions */}
          <div>
            {!selectedFriday ? (
              <Card className="h-40 border-dashed flex items-center justify-center">
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-sm">Select a Friday to view sessions</p>
                </CardContent>
              </Card>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-foreground text-lg flex items-center gap-2">
                    Sessions
                    <Badge variant="secondary" className="font-normal">{format(new Date(selectedFriday.date), 'MMM d')}</Badge>
                  </h2>
                  {canCreateSession && !sessionFormOpen && (
                    <Button size="sm" onClick={openNewSessionForm} className="flex items-center gap-1 h-8">
                      <Plus size={14} /> Add Session
                    </Button>
                  )}
                </div>

                <div className="mb-4 border-b pb-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={sessionSearch}
                      onChange={(e) => setSessionSearch(e.target.value)}
                      className="h-9 border-0 bg-transparent pl-9 pr-8 text-sm shadow-none focus-visible:ring-0"
                      placeholder="Search sessions..."
                    />
                    {sessionSearch ? (
                      <button
                        type="button"
                        onClick={() => setSessionSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {sessionFormOpen && canCreateSession && (
                  <Card className="mb-4">
                    <CardHeader className="pb-3 border-b mb-4">
                      <CardTitle className="text-base font-semibold">
                        {editingSessionId ? 'Edit Session' : 'New Session'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={submitSessionForm} className="space-y-4">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Session Title *</label>
                          <Input placeholder="Session title" value={sessionForm.title}
                            onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })} required />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Description</label>
                          <Textarea placeholder="Description" value={sessionForm.description}
                            onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })} rows={2} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Session Type</label>
                          <Select value={sessionForm.sessionType} onValueChange={(v) => setSessionForm({ ...sessionForm, sessionType: v as any })}>
                            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="STUDENT_CHOICE">Student Choice</SelectItem>
                              <SelectItem value="TEACHER_ASSIGNED">Teacher Assigned</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block font-medium">Start Time *</label>
                            <Input type="time" value={sessionForm.startTime}
                              onChange={(e) => setSessionForm({ ...sessionForm, startTime: e.target.value })} required />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block font-medium">End Time *</label>
                            <Input type="time" value={sessionForm.endTime}
                              onChange={(e) => setSessionForm({ ...sessionForm, endTime: e.target.value })} required />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-border mt-2">
                          <Button type="submit" size="sm"
                            disabled={createSessionMutation.isPending || updateSessionMutation.isPending}>
                            {editingSessionId ? 'Save changes' : 'Create'}
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={closeSessionForm}>Cancel</Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {filteredSessions.length === 0 ? (
                  <Card className="text-center py-8 border-dashed">
                    <CardContent className="pt-6">
                      <p className="text-muted-foreground text-sm">
                        {deferredSessionSearch ? 'No sessions match your search' : 'No sessions yet'}
                      </p>
                      {deferredSessionSearch && (
                        <Button variant="link" size="sm" onClick={() => setSessionSearch('')} className="mt-1 font-semibold text-accent-500">
                          Clear search
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {filteredSessions.map((s: any) => (
                      <div
                        key={s.id}
                        className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${selectedSession?.id === s.id
                          ? 'border-accent-500/40 bg-accent-500/10 ring-1 ring-accent-500/20'
                          : 'border-border hover:border-accent-500/20 bg-background hover:bg-accent-500/5'
                          }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedSession(s)}
                          className="w-full text-left"
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <h3 className="font-semibold text-foreground/90 text-sm">{s.title}</h3>
                                {s.sessionType === 'TEACHER_ASSIGNED' && (
                                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-transparent text-[10px] leading-tight py-0">Assigned</Badge>
                                )}
                              </div>
                              {s.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.description}</p>}
                              <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1 font-medium">
                                  <Clock size={12} /> {formatTimeRange(s.startTime, s.endTime)}
                                </span>
                                {s._count?.workshops > 0 && (
                                  <span className="font-medium">
                                    {s._count.workshops} workshop{s._count.workshops === 1 ? '' : 's'}
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                          </div>
                        </button>
                        {canCreateSession && (
                          <div className="flex gap-1 mt-2 pt-2 border-t border-border/60">
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                              onClick={(e) => { e.stopPropagation(); openEditSessionForm(s); }}>
                              <Pencil size={12} /> Edit
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete session "${s.title}"? All its workshops will also be removed.`)) {
                                  deleteSessionMutation.mutate(s.id);
                                }
                              }}>
                              <Trash2 size={12} /> Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Col 3: Workshops */}
          <div>
            {!selectedSession ? (
              <Card className="h-40 border-dashed flex items-center justify-center">
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-sm">
                    {selectedFriday ? 'Select a session to view workshops' : 'Select a Friday first'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-foreground text-lg flex items-center gap-2">
                    Workshops
                    <Badge variant="secondary" className="font-normal">{selectedSession.title}</Badge>
                  </h2>
                  {canCreateSession && !workshopFormOpen && (
                    <Button size="sm" onClick={openNewWorkshopForm} className="flex items-center gap-1 h-8">
                      <Plus size={14} /> Add Workshop
                    </Button>
                  )}
                </div>

                <div className="mb-4 border-b pb-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={workshopSearch}
                      onChange={(e) => setWorkshopSearch(e.target.value)}
                      className="h-9 border-0 bg-transparent pl-9 pr-8 text-sm shadow-none focus-visible:ring-0"
                      placeholder="Search workshops..."
                    />
                    {workshopSearch ? (
                      <button
                        type="button"
                        onClick={() => setWorkshopSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {workshopFormOpen && canCreateSession && (
                  <Card className="mb-4">
                    <CardHeader className="pb-3 border-b mb-4">
                      <CardTitle className="text-base font-semibold">
                        {editingWorkshopId ? 'Edit Workshop' : 'New Workshop'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={submitWorkshopForm} className="space-y-4">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Workshop Title *</label>
                          <Input placeholder="Workshop title" value={workshopForm.title}
                            onChange={(e) => setWorkshopForm({ ...workshopForm, title: e.target.value })} required />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Description</label>
                          <Textarea placeholder="Description" value={workshopForm.description}
                            onChange={(e) => setWorkshopForm({ ...workshopForm, description: e.target.value })} rows={2} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block font-medium">Location</label>
                            <Input placeholder="Room / location" value={workshopForm.location}
                              onChange={(e) => setWorkshopForm({ ...workshopForm, location: e.target.value })} />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block font-medium">Capacity</label>
                            <Input type="number" placeholder="Optional" value={workshopForm.capacity}
                              onChange={(e) => setWorkshopForm({ ...workshopForm, capacity: e.target.value })} />
                          </div>
                        </div>

                        {/* Sessions multi-select */}
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">
                            Sessions this workshop spans *
                          </label>
                          <p className="text-[11px] text-muted-foreground/80 mb-2">
                            Students who register will be committed to every selected session.
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {(sessions as any[]).map((s) => {
                              const checked = workshopForm.sessionIds.includes(s.id);
                              return (
                                <label key={s.id}
                                  className={cn(
                                    'flex items-start gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition',
                                    checked ? 'border-accent-500/40 bg-accent-500/10' : 'border-border hover:bg-muted/40',
                                  )}>
                                  <input
                                    type="checkbox"
                                    className="mt-0.5"
                                    checked={checked}
                                    onChange={() =>
                                      setWorkshopForm((c) => ({
                                        ...c,
                                        sessionIds: toggleInArray(c.sessionIds, s.id),
                                      }))
                                    }
                                  />
                                  <div className="min-w-0">
                                    <p className="font-medium leading-tight truncate">{s.title}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                      {formatTimeRange(s.startTime, s.endTime)}
                                    </p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* Grade targeting */}
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Target Grades</label>
                          <p className="text-[11px] text-muted-foreground/80 mb-2">Leave empty for all grades.</p>
                          <div className="flex flex-wrap gap-2">
                            {GRADE_OPTIONS.map((g) => {
                              const checked = workshopForm.targetGrades.includes(g);
                              return (
                                <label key={g}
                                  className={cn(
                                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs cursor-pointer transition',
                                    checked ? 'border-accent-500/50 bg-accent-500/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted/40',
                                  )}>
                                  <input type="checkbox" className="accent-accent-500"
                                    checked={checked}
                                    onChange={() =>
                                      setWorkshopForm((c) => ({ ...c, targetGrades: toggleInArray(c.targetGrades, g) }))
                                    } />
                                  Grade {g}
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* Pathway majors */}
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Target Pathway Majors</label>
                          <p className="text-[11px] text-muted-foreground/80 mb-2">Leave empty for all majors.</p>
                          <div className="flex flex-wrap gap-2">
                            {PATHWAY_OPTIONS.map((p) => {
                              const checked = workshopForm.targetMajorPathways.includes(p.value);
                              return (
                                <label key={p.value}
                                  className={cn(
                                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs cursor-pointer transition',
                                    checked ? 'border-accent-500/50 bg-accent-500/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted/40',
                                  )}>
                                  <input type="checkbox" className="accent-accent-500"
                                    checked={checked}
                                    onChange={() =>
                                      setWorkshopForm((c) => ({
                                        ...c,
                                        targetMajorPathways: toggleInArray(c.targetMajorPathways, p.value),
                                      }))
                                    } />
                                  {p.label}
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* Pathway minors */}
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Target Pathway Minors</label>
                          <p className="text-[11px] text-muted-foreground/80 mb-2">Leave empty for all minors.</p>
                          <div className="flex flex-wrap gap-2">
                            {PATHWAY_OPTIONS.map((p) => {
                              const checked = workshopForm.targetMinorPathways.includes(p.value);
                              return (
                                <label key={p.value}
                                  className={cn(
                                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs cursor-pointer transition',
                                    checked ? 'border-accent-500/50 bg-accent-500/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted/40',
                                  )}>
                                  <input type="checkbox" className="accent-accent-500"
                                    checked={checked}
                                    onChange={() =>
                                      setWorkshopForm((c) => ({
                                        ...c,
                                        targetMinorPathways: toggleInArray(c.targetMinorPathways, p.value),
                                      }))
                                    } />
                                  {p.label}
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-border mt-2">
                          <Button type="submit" size="sm"
                            disabled={createWorkshopMutation.isPending || updateWorkshopMutation.isPending}>
                            {editingWorkshopId ? 'Save changes' : 'Create'}
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={closeWorkshopForm}>Cancel</Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {(filteredWorkshops as any[]).length === 0 ? (
                  <Card className="text-center py-8 border-dashed">
                    <CardContent className="pt-6">
                      <p className="text-muted-foreground text-sm">
                        {deferredWorkshopSearch ? 'No workshops match your search' : 'No workshops yet'}
                      </p>
                      {deferredWorkshopSearch && (
                        <Button variant="link" size="sm" onClick={() => setWorkshopSearch('')} className="mt-1 font-semibold text-accent-500">
                          Clear search
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {(filteredWorkshops as any[]).map((w) => {
                      const isRegistered = myRegWorkshopIds.has(w.id);
                      const isFull = w.capacity && w._count?.registrations >= w.capacity;
                      const isRegistering = registerMutation.isPending && registerMutation.variables === w.id;
                      const isUnregistering = unregisterMutation.isPending && unregisterMutation.variables === w.id;
                      const linkedSessions: Array<{ id: string; title: string; startTime?: string; endTime?: string }> =
                        Array.isArray(w.linkedSessions) ? w.linkedSessions : [];
                      const spansMultiple = linkedSessions.length > 1;
                      return (
                        <Card key={w.id} className={`transition-all duration-200 ${isRegistered ? 'border-accent-500/30 ring-1 ring-accent-500/10' : 'hover:-translate-y-0.5'}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  <h3 className="font-semibold text-foreground/90 text-sm">{w.title}</h3>
                                  {isRegistered && (
                                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-transparent text-[10px] leading-tight py-0">
                                      <CheckCircle size={10} className="mr-1" /> Registered
                                    </Badge>
                                  )}
                                  {spansMultiple && (
                                    <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 border-transparent text-[10px] leading-tight py-0">
                                      Spans {linkedSessions.length} sessions
                                    </Badge>
                                  )}
                                </div>
                                {w.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{w.description}</p>}
                                <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                                  {w.location && <span className="flex items-center gap-1 font-medium"><MapPin size={12} />{w.location}</span>}
                                  <span className="flex items-center gap-1 font-medium">
                                    <Users size={12} />{w._count?.registrations}{w.capacity ? `/${w.capacity}` : ''} registered
                                  </span>
                                </div>
                                {spansMultiple && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {linkedSessions.map((ls) => (
                                      <Badge key={ls.id} variant="outline" className="text-[10px] py-0">
                                        {ls.title} · {formatTimeRange(ls.startTime, ls.endTime)}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                                {(w.targetGrades?.length || w.targetMajorPathways?.length || w.targetMinorPathways?.length) ? (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {(w.targetGrades ?? []).map((g: number) => (
                                      <Badge key={`g-${g}`} variant="secondary" className="text-[10px] py-0">Grade {g}</Badge>
                                    ))}
                                    {(w.targetMajorPathways ?? []).map((p: string) => (
                                      <Badge key={`maj-${p}`} variant="secondary" className="bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 border-transparent text-[10px] py-0">
                                        Major: {pathwayLabel(p)}
                                      </Badge>
                                    ))}
                                    {(w.targetMinorPathways ?? []).map((p: string) => (
                                      <Badge key={`min-${p}`} variant="secondary" className="bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20 border-transparent text-[10px] py-0">
                                        Minor: {pathwayLabel(p)}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                              {isStudent && selectedSession?.sessionType === 'STUDENT_CHOICE' && (
                                isRegistered ? (
                                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                                    <Button variant="ghost" size="sm" onClick={() => unregisterMutation.mutate(w.id)} disabled={isUnregistering} className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive">
                                      {isUnregistering ? 'Updating…' : 'Unregister'}
                                    </Button>
                                    <Link href="/flex-friday/pass">
                                      <Button size="sm" variant="outline" className="h-8 w-full flex items-center gap-1 border-orange-500/30 text-orange-500 hover:bg-orange-500/10">
                                        <Ticket size={12} /> Pass
                                      </Button>
                                    </Link>
                                  </div>
                                ) : (
                                  <Button size="sm" onClick={() => registerMutation.mutate(w.id)} disabled={!!isFull || isRegistering} className="h-8 flex-shrink-0">
                                    {isFull ? 'Full' : isRegistering ? 'Registering…' : 'Register'}
                                  </Button>
                                )
                              )}
                            </div>
                            {canCreateSession && (
                              <div className="mt-3 pt-3 border-t border-border/60 flex gap-1">
                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                                  onClick={() => openEditWorkshopForm(w)}>
                                  <Pencil size={12} /> Edit
                                </Button>
                                <Button variant="ghost" size="sm"
                                  className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    if (confirm(`Delete workshop "${w.title}"?`)) {
                                      deleteWorkshopMutation.mutate(w.id);
                                    }
                                  }}>
                                  <Trash2 size={12} /> Delete
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
