'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { format } from 'date-fns';
import { Plus, Users, MapPin, CheckCircle, Ticket, ChevronRight, Clock, Pencil, Trash2, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import Link from 'next/link';
import { filterBySearchQuery } from '@/lib/search';
import { cn } from '@/lib/utils';

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
  const user = useCurrentUser();
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

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const canManage = mounted && !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const canCreateSession =
    mounted && !!user && hasRole(user, 'TEACHER', 'ADMIN', 'SUPER_ADMIN');
  const isStudent = mounted && !!user && hasRole(user, 'STUDENT');

  const [activeView, setActiveView] = useState<'schedule' | 'audit'>('schedule');

  const fridaysRaw = useQuery(api.flexFriday.fridays.list, mounted ? {} : 'skip');
  const fridays = fridaysRaw ?? [];
  const isLoading = mounted && fridaysRaw === undefined;

  const sessions =
    useQuery(
      api.flexFriday.sessions.listByFriday,
      selectedFriday ? { flexFridayId: selectedFriday._id as Id<'flexFridays'> } : 'skip',
    ) ?? [];

  const workshops =
    useQuery(
      api.flexFriday.workshops.listBySession,
      selectedFriday && selectedSession
        ? {
            flexFridayId: selectedFriday._id as Id<'flexFridays'>,
            sessionId: selectedSession._id as Id<'flexSessions'>,
          }
        : 'skip',
    ) ?? [];

  const myRegs = useQuery(api.flexFriday.registration.getMyRegistrations, mounted ? {} : 'skip') ?? [];

  const auditQuery = useQuery(
    api.audit.events.list,
    canManage && activeView === 'audit' ? { query: 'Flex', limit: 5 } : 'skip',
  );
  const auditEvents = auditQuery ?? [];
  const auditLoading = canManage && activeView === 'audit' && auditQuery === undefined;

  const credits = useQuery(
    api.flexFriday.credits.getMyCredits,
    mounted && !!user ? {} : 'skip',
  );

  const [attendanceWorkshopId, setAttendanceWorkshopId] = useState<Id<'flexWorkshops'> | null>(null);
  const rosterData = useQuery(
    api.flexFriday.attendance.getRoster,
    attendanceWorkshopId && canCreateSession
      ? { workshopId: attendanceWorkshopId }
      : 'skip',
  );
  const rosterLoading = attendanceWorkshopId != null && rosterData === undefined;
  const rosterError = null;

  const filteredSessions = useMemo(() => {
    return filterBySearchQuery(sessions as any[], deferredSessionSearch, (session) => [
      session.title,
      session.description,
    ]);
  }, [sessions, deferredSessionSearch]);

  const filteredWorkshops = useMemo(() => {
    return filterBySearchQuery(workshops as any[], deferredWorkshopSearch, (workshop) => [
      workshop.title,
      workshop.description,
      workshop.location,
    ]);
  }, [workshops, deferredWorkshopSearch]);

  const myRegWorkshopIds = new Set((myRegs as any[]).map((r: any) => r.workshopId));

  const createFridayMut = useMutation(api.flexFriday.fridays.create);
  const createSessionMut = useMutation(api.flexFriday.sessions.create);
  const updateSessionMut = useMutation(api.flexFriday.sessions.update);
  const deleteSessionMut = useMutation(api.flexFriday.sessions.remove);
  const createWorkshopMut = useMutation(api.flexFriday.workshops.create);
  const updateWorkshopMut = useMutation(api.flexFriday.workshops.update);
  const deleteWorkshopMut = useMutation(api.flexFriday.workshops.remove);
  const registerMut = useMutation(api.flexFriday.registration.register);
  const unregisterMut = useMutation(api.flexFriday.registration.unregister);
  const markAttendanceMut = useMutation(api.flexFriday.attendance.markAttendance);
  const clearAttendanceMut = useMutation(api.flexFriday.attendance.clearAttendance);

  const [actionPending, setActionPending] = useState<string | null>(null);

  const runAction = async (key: string, fn: () => Promise<unknown>) => {
    setActionPending(key);
    try {
      await fn();
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Failed',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setActionPending(null);
    }
  };

  // ── Form helpers ──────────────────────────────────────────────────────────
  const openNewSessionForm = () => {
    setEditingSessionId(null);
    setSessionForm(EMPTY_SESSION_FORM);
    setSessionFormOpen(true);
  };

  const openEditSessionForm = (s: any) => {
    setEditingSessionId(s._id);
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
    if (!selectedFriday) return;
    const payload = {
      title: sessionForm.title,
      description: sessionForm.description || undefined,
      sessionType: sessionForm.sessionType,
      startTime: sessionForm.startTime,
      endTime: sessionForm.endTime,
    };
    if (editingSessionId) {
      void runAction('session-update', async () => {
        await updateSessionMut({
          sessionId: editingSessionId as Id<'flexSessions'>,
          ...payload,
        });
        closeSessionForm();
        toast({ title: 'Session updated' });
      });
    } else {
      void runAction('session-create', async () => {
        await createSessionMut({
          flexFridayId: selectedFriday._id as Id<'flexFridays'>,
          ...payload,
        });
        closeSessionForm();
        toast({ title: 'Session created' });
      });
    }
  };

  const openNewWorkshopForm = () => {
    setEditingWorkshopId(null);
    // Preselect the currently selected session
    setWorkshopForm({
      ...EMPTY_WORKSHOP_FORM,
      sessionIds: selectedSession ? [selectedSession._id] : [],
    });
    setWorkshopFormOpen(true);
  };

  const openEditWorkshopForm = (w: any) => {
    setEditingWorkshopId(w._id);
    setWorkshopForm({
      title: w.title ?? '',
      description: w.description ?? '',
      location: w.location ?? '',
      capacity: w.capacity != null ? String(w.capacity) : '',
      sessionIds: Array.isArray(w.linkedSessions)
        ? w.linkedSessions.map((s: any) => s._id)
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
    if (!selectedFriday) return;
    const workshopPayload = {
      ...payload,
      sessionIds: workshopForm.sessionIds as Id<'flexSessions'>[],
      capacity: workshopForm.capacity ? parseInt(workshopForm.capacity, 10) : undefined,
      targetMajorPathways: workshopForm.targetMajorPathways as Array<
        'INFORMATION_TECHNOLOGY' | 'HEALTH_SCIENCE' | 'ENGINEERING'
      >,
      targetMinorPathways: workshopForm.targetMinorPathways as Array<
        'INFORMATION_TECHNOLOGY' | 'HEALTH_SCIENCE' | 'ENGINEERING'
      >,
    };
    if (editingWorkshopId) {
      void runAction('workshop-update', async () => {
        await updateWorkshopMut({
          workshopId: editingWorkshopId as Id<'flexWorkshops'>,
          ...workshopPayload,
        });
        closeWorkshopForm();
        toast({ title: 'Workshop updated' });
      });
    } else {
      void runAction('workshop-create', async () => {
        await createWorkshopMut({
          flexFridayId: selectedFriday._id as Id<'flexFridays'>,
          ...workshopPayload,
        });
        closeWorkshopForm();
        toast({ title: 'Workshop created' });
      });
    }
  };

  // ── Audit helpers ─────────────────────────────────────────────────────────
  const AUDIT_ACTION_LABELS: Record<string, string> = {
    FLEX_FRIDAY_CREATED: 'Friday Scheduled',
    FLEX_SESSION_CREATED: 'Session Added',
    FLEX_SESSION_UPDATED: 'Session Updated',
    FLEX_SESSION_DELETED: 'Session Deleted',
    FLEX_WORKSHOP_CREATED: 'Workshop Added',
    FLEX_WORKSHOP_UPDATED: 'Workshop Updated',
    FLEX_WORKSHOP_DELETED: 'Workshop Deleted',
    FLEX_REGISTRATION_CREATED: 'Student Registered',
    FLEX_REGISTRATION_REMOVED: 'Registration Removed',
    FLEX_ASSIGNMENT_CREATED: 'Student Assigned',
  };

  const auditActionClass = (action: string) => {
    if (action.endsWith('_CREATED') || action.endsWith('_SCHEDULED')) return 'bg-emerald-500/10 text-emerald-600 border-transparent';
    if (action.endsWith('_UPDATED')) return 'bg-blue-500/10 text-blue-600 border-transparent';
    if (action.endsWith('_DELETED') || action.endsWith('_REMOVED')) return 'bg-red-500/10 text-red-600 border-transparent';
    return 'bg-muted text-muted-foreground border-transparent';
  };

  const auditMetaSummary = (event: any): string => {
    const meta = event.meta as Record<string, unknown> | null;
    if (!meta) return '';
    const parts: string[] = [];
    if (typeof meta.title === 'string') parts.push(meta.title);
    if (typeof meta.date === 'string') parts.push(meta.date);
    if (typeof meta.type === 'string') parts.push(meta.type.replace(/_/g, ' '));
    if (Array.isArray(meta.changes) && meta.changes.length) parts.push(`Changed: ${(meta.changes as string[]).join(', ')}`);
    return parts.join(' · ');
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
  }, [selectedSession?._id]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Flex Friday</h1>
            <p className="text-muted-foreground text-sm">Sessions, workshops, and registration</p>
          </div>
          <div className="flex items-center gap-2">
            {isStudent && credits && <CreditsSummary credits={credits} />}
            {canManage && activeView === 'schedule' && (
              <Button onClick={() => setShowNewFriday(true)} className="flex items-center gap-2">
                <Plus size={16} /> Schedule Friday
              </Button>
            )}
            {canManage && (
              <Button
                variant={activeView === 'audit' ? 'primary' : 'tertiary'}
                onClick={() => setActiveView(activeView === 'audit' ? 'schedule' : 'audit')}
                className="flex items-center gap-2"
              >
                <History size={16} /> Audit Log
              </Button>
            )}
            {isStudent && (
              <Link
                href={
                  selectedFriday?._id
                    ? `/flex-friday/pass?fridayId=${selectedFriday._id}`
                    : '/flex-friday/pass'
                }
              >
                <Button className="flex items-center gap-2 border-transparent bg-orange-500 text-white shadow-sm hover:bg-orange-600">
                  <Ticket size={15} /> My Pass
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Audit Log view */}
        {canManage && activeView === 'audit' && (
          <div className="space-y-6">

            {/* ── Recent activity ────────────────────────────────────── */}
            <div>
              <h2 className="font-semibold text-muted-foreground mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                <History size={14} /> Recent Activity (last 5)
              </h2>
              {auditLoading ? (
                <p className="text-muted-foreground text-sm">Loading…</p>
              ) : (auditEvents as any[]).length === 0 ? (
                <Card className="text-center py-12 border-dashed">
                  <CardContent className="pt-6">
                    <History size={32} className="mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-muted-foreground text-sm">No audit events recorded yet</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {(auditEvents as any[]).map((event: any) => (
                    <div key={event.id} className="flex items-start gap-4 p-4 rounded-xl border bg-background">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={auditActionClass(event.action)}>
                            {AUDIT_ACTION_LABELS[event.action] ?? event.action.replace(/_/g, ' ')}
                          </Badge>
                          <span className="text-sm text-foreground font-medium">
                            {event.actor ? `${event.actor.firstName} ${event.actor.lastName}` : 'System'}
                          </span>
                          {event.actor?.uniqueId && (
                            <span className="text-xs text-muted-foreground">({event.actor.uniqueId})</span>
                          )}
                        </div>
                        {auditMetaSummary(event) && (
                          <p className="text-xs text-muted-foreground mt-1">{auditMetaSummary(event)}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {format(new Date(event.createdAt), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Schedule view */}
        {/* New Friday form */}
        {activeView === 'schedule' && showNewFriday && canManage && (
          <Card className="mb-6">
            <CardHeader className="pb-3 border-b mb-4">
              <CardTitle className="text-lg">Schedule Flex Friday</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void runAction('friday-create', async () => {
                    await createFridayMut({
                      date: fridayForm.date,
                      type: fridayForm.type,
                      notes: fridayForm.notes,
                      isSchoolDay: fridayForm.type !== 'TEACHER_PD',
                      pathway: fridayForm.type === 'PATHWAY_SPECIFIC' ? fridayForm.pathway : undefined,
                      gradeLevel: fridayForm.type === 'GRADE_SPECIFIC' ? Number(fridayForm.gradeLevel) : undefined,
                    });
                    setShowNewFriday(false);
                    toast({ title: 'Flex Friday created' });
                  });
                }}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block font-medium">Date *</label>
                  <DatePicker
                    value={fridayForm.date}
                    onChange={(date) => setFridayForm({ ...fridayForm, date })}
                    buttonClassName="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block font-medium">Type</label>
                  <Select value={fridayForm.type} onValueChange={(value) => setFridayForm((c) => ({ ...c, type: value }))}>
                    <SelectTrigger placeholder="Select type" />
                    <SelectContent>
                      <SelectItem index={0} value="ALL_STUDENT">All Student</SelectItem>
                      <SelectItem index={0} value="GRADE_SPECIFIC">Grade Specific</SelectItem>
                      <SelectItem index={0} value="PATHWAY_SPECIFIC">Pathway Specific</SelectItem>
                      <SelectItem index={0} value="TEACHER_PD">Teacher PD (No School)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {fridayForm.type === 'PATHWAY_SPECIFIC' && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block font-medium">Pathway</label>
                    <Select value={fridayForm.pathway} onValueChange={(v) => setFridayForm({ ...fridayForm, pathway: v })}>
                      <SelectTrigger placeholder="Select pathway" />
                      <SelectContent>
                        {PATHWAY_OPTIONS.map((p) => <SelectItem index={0} key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {fridayForm.type === 'GRADE_SPECIFIC' && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block font-medium">Grade</label>
                    <Select value={fridayForm.gradeLevel} onValueChange={(v) => setFridayForm({ ...fridayForm, gradeLevel: v })}>
                      <SelectTrigger placeholder="Select grade" />
                      <SelectContent>
                        {GRADE_OPTIONS.map((g) => <SelectItem index={0} key={g} value={String(g)}>Grade {g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block font-medium">Notes (optional)</label>
                  <Textarea placeholder="Notes (optional)" value={fridayForm.notes} onChange={(e) => setFridayForm({ ...fridayForm, notes: e.target.value })} rows={2} />
                </div>
                <div className="flex gap-2 pt-2 border-t border-border mt-2">
                  <Button type="submit" disabled={actionPending === 'friday-create' || !fridayForm.date}>Create</Button>
                  <Button type="button" variant="ghost" onClick={() => setShowNewFriday(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── 3-column layout ─────────────────────────────────────────── */}
        {activeView === 'schedule' && <div className="grid lg:grid-cols-[260px_1fr_1fr] gap-6">

          {/* Col 1: Fridays */}
          <div>
            <h2 className="font-semibold text-muted-foreground mb-4 text-sm uppercase tracking-wider">Scheduled Fridays</h2>
            {isLoading ? <p className="text-muted-foreground text-sm">Loading…</p> :
              (fridays as any[]).length === 0 ? <p className="text-muted-foreground text-sm">No Flex Fridays scheduled</p> :
                <div className="space-y-2">
                  {(fridays as any[]).map((f) => (
                    <button key={f._id} onClick={() => handleSelectFriday(f)}
                      className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${selectedFriday?._id === f._id
                        ? 'border-border bg-muted/60 text-foreground'
                        : 'border-border hover:bg-muted/40 bg-background text-foreground/80 hover:text-foreground'
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
                    <Badge variant="solid" className="font-normal">{format(new Date(selectedFriday.date), 'MMM d')}</Badge>
                  </h2>
                  {canCreateSession && !sessionFormOpen && (
                    <Button size="sm" onClick={openNewSessionForm} className="flex items-center gap-1 h-8">
                      <Plus size={14} /> Add Session
                    </Button>
                  )}
                </div>

                <SearchInput
                  value={sessionSearch}
                  onValueChange={setSessionSearch}
                  className="mb-4 rounded-xl border-foreground/10"
                  placeholder="Search sessions..."
                />

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
                            <SelectTrigger placeholder="Select type" />
                            <SelectContent>
                              <SelectItem index={0} value="STUDENT_CHOICE">Student Choice</SelectItem>
                              <SelectItem index={0} value="TEACHER_ASSIGNED">Teacher Assigned</SelectItem>
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
                            disabled={actionPending === 'session-create' || actionPending === 'session-update'}>
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
                        <Button variant="ghost" size="sm" onClick={() => setSessionSearch('')} className="mt-1 font-semibold text-accent-500">
                          Clear search
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {filteredSessions.map((s: any) => (
                      <div
                        key={s._id}
                        className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${selectedSession?._id === s._id
                          ? 'border-border bg-muted/60'
                          : 'border-border hover:bg-muted/40 bg-background'
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
                                  <Badge variant="solid" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-transparent text-[10px] leading-tight py-0">Assigned</Badge>
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
                                  void runAction('session-delete', async () => {
                                    await deleteSessionMut({ sessionId: s._id });
                                    if (selectedSession?._id === s._id) setSelectedSession(null);
                                    toast({ title: 'Session deleted' });
                                  });
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
                    <Badge variant="solid" className="font-normal">{selectedSession.title}</Badge>
                  </h2>
                  {canCreateSession && !workshopFormOpen && (
                    <Button size="sm" onClick={openNewWorkshopForm} className="flex items-center gap-1 h-8">
                      <Plus size={14} /> Add Workshop
                    </Button>
                  )}
                </div>

                <SearchInput
                  value={workshopSearch}
                  onValueChange={setWorkshopSearch}
                  className="mb-4 rounded-xl border-foreground/10"
                  placeholder="Search workshops..."
                />

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
                                <label key={s._id}
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
                            disabled={actionPending === 'workshop-create' || actionPending === 'workshop-update'}>
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
                        <Button variant="ghost" size="sm" onClick={() => setWorkshopSearch('')} className="mt-1 font-semibold text-accent-500">
                          Clear search
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {(filteredWorkshops as any[]).map((w) => {
                      const isRegistered = myRegWorkshopIds.has(w._id);
                      const isFull = w.capacity && w._count?.registrations >= w.capacity;
                      const isRegistering = actionPending === `register-${w._id}`;
                      const isUnregistering = actionPending === `unregister-${w._id}`;
                      const linkedSessions: Array<{ id: string; title: string; startTime?: string; endTime?: string }> =
                        Array.isArray(w.linkedSessions) ? w.linkedSessions : [];
                      const spansMultiple = linkedSessions.length > 1;
                      return (
                        <Card key={w._id} className={`transition-all duration-200 ${isRegistered ? 'bg-muted/40' : 'hover:-translate-y-0.5'}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  <h3 className="font-semibold text-foreground/90 text-sm">{w.title}</h3>
                                  {isRegistered && (
                                    <Badge variant="solid" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-transparent text-[10px] leading-tight py-0">
                                      <CheckCircle size={10} className="mr-1" /> Registered
                                    </Badge>
                                  )}
                                  {spansMultiple && (
                                    <Badge variant="solid" className="bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 border-transparent text-[10px] leading-tight py-0">
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
                                      <Badge key={ls.id} variant="dot" className="text-[10px] py-0">
                                        {ls.title} · {formatTimeRange(ls.startTime, ls.endTime)}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                                {(w.targetGrades?.length || w.targetMajorPathways?.length || w.targetMinorPathways?.length) ? (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {(w.targetGrades ?? []).map((g: number) => (
                                      <Badge key={`g-${g}`} variant="solid" className="text-[10px] py-0">Grade {g}</Badge>
                                    ))}
                                    {(w.targetMajorPathways ?? []).map((p: string) => (
                                      <Badge key={`maj-${p}`} variant="solid" className="bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 border-transparent text-[10px] py-0">
                                        Major: {pathwayLabel(p)}
                                      </Badge>
                                    ))}
                                    {(w.targetMinorPathways ?? []).map((p: string) => (
                                      <Badge key={`min-${p}`} variant="solid" className="bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20 border-transparent text-[10px] py-0">
                                        Minor: {pathwayLabel(p)}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                              {isStudent && selectedSession?.sessionType === 'STUDENT_CHOICE' && (
                                isRegistered ? (
                                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                                    <Button variant="ghost" size="sm" onClick={() => void runAction(`unregister-${w._id}`, async () => {
                                      await unregisterMut({ workshopId: w._id });
                                      toast({ title: 'Unregistered' });
                                    })} disabled={isUnregistering} className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive">
                                      {isUnregistering ? 'Updating…' : 'Unregister'}
                                    </Button>
                                    <Link
                                      href={
                                        selectedFriday?._id
                                          ? `/flex-friday/pass?fridayId=${selectedFriday._id}`
                                          : '/flex-friday/pass'
                                      }
                                    >
                                      <Button size="sm" variant="tertiary" className="h-8 w-full flex items-center gap-1 border-orange-500/30 text-orange-500 hover:bg-orange-500/10">
                                        <Ticket size={12} /> Pass
                                      </Button>
                                    </Link>
                                  </div>
                                ) : (
                                  <Button size="sm" onClick={() => void runAction(`register-${w._id}`, async () => {
                                    await registerMut({ workshopId: w._id });
                                    toast({ title: 'Registered!' });
                                  })} disabled={!!isFull || isRegistering} className="h-8 flex-shrink-0">
                                    {isFull ? 'Full' : isRegistering ? 'Registering…' : 'Register'}
                                  </Button>
                                )
                              )}
                            </div>
                            {canCreateSession && (
                              <div className="mt-3 pt-3 border-t border-border/60 flex flex-wrap gap-1">
                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                                  onClick={() => openEditWorkshopForm(w)}>
                                  <Pencil size={12} /> Edit
                                </Button>
                                <Button variant="ghost" size="sm"
                                  className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    if (confirm(`Delete workshop "${w.title}"?`)) {
                                      void runAction('workshop-delete', async () => {
                                        await deleteWorkshopMut({ workshopId: w._id });
                                        toast({ title: 'Workshop deleted' });
                                      });
                                    }
                                  }}>
                                  <Trash2 size={12} /> Delete
                                </Button>
                                <Button
                                  variant={attendanceWorkshopId === w._id ? 'secondary' : 'ghost'}
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() =>
                                    setAttendanceWorkshopId((id) => (id === w._id ? null : w._id))
                                  }
                                >
                                  <CheckCircle size={12} />
                                  {attendanceWorkshopId === w._id ? 'Hide attendance' : 'Take attendance'}
                                </Button>
                              </div>
                            )}
                            {canCreateSession && attendanceWorkshopId === w._id && (
                              <AttendancePanel
                                roster={rosterData as any}
                                isLoading={rosterLoading}
                                error={rosterError as Error | null}
                                onMark={(studentId, status) =>
                                  void markAttendanceMut({
                                    workshopId: w._id,
                                    studentId: studentId as Id<'users'>,
                                    status,
                                  })
                                }
                                onClear={(studentId) =>
                                  void clearAttendanceMut({
                                    workshopId: w._id,
                                    studentId: studentId as Id<'users'>,
                                  })
                                }
                                isMarking={actionPending != null}
                              />
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
        </div>}
      </div>
    </AppShell>
  );
}

type CreditsSemester = {
  key: 'FALL' | 'SPRING';
  label: string;
  earned: number;
  required: number;
  remaining: number;
};

type CreditsSummaryData = {
  earned: number;
  required: number;
  schoolYearLabel: string;
  semesters?: CreditsSemester[];
};

function CreditsSummary({ credits }: { credits: CreditsSummaryData }) {
  const yearMet = credits.earned >= credits.required;
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/80 px-3 py-1.5 text-sm"
      title={`Flex Friday credits earned during the ${credits.schoolYearLabel} school year`}
    >
      <div className="flex items-center gap-1.5">
        <CheckCircle
          size={14}
          className={yearMet ? 'text-emerald-500' : 'text-muted-foreground'}
        />
        <span className="tabular-nums font-medium">
          {credits.earned}
          <span className="text-muted-foreground"> / {credits.required}</span>
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          · {credits.schoolYearLabel}
        </span>
      </div>
      {credits.semesters && credits.semesters.length > 0 ? (
        <div className="hidden items-center gap-2 border-l border-border/70 pl-3 text-xs md:flex">
          {credits.semesters.map((sem) => {
            const met = sem.earned >= sem.required;
            return (
              <span
                key={sem.key}
                className={cn(
                  'flex items-center gap-1 tabular-nums',
                  met ? 'text-emerald-500' : 'text-muted-foreground',
                )}
                title={`${sem.label}: ${sem.earned} of ${sem.required} credits`}
              >
                <span className="font-medium">{sem.label.split(' ')[0]}</span>
                <span>
                  {sem.earned}/{sem.required}
                </span>
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED';

type RosterStudent = {
  id: string;
  firstName: string;
  lastName: string;
  gradeLevel?: number | null;
  uniqueId: string;
};

type RosterResponse = {
  registrations: Array<{ student: RosterStudent }>;
  assignments: Array<{ student: RosterStudent }>;
  attendances: Array<{ studentId: string; status: AttendanceStatus }>;
};

function AttendancePanel({
  roster,
  isLoading,
  error,
  onMark,
  onClear,
  isMarking,
}: {
  roster: RosterResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  onMark: (studentId: string, status: AttendanceStatus) => void;
  onClear: (studentId: string) => void;
  isMarking: boolean;
}) {
  if (isLoading) {
    return (
      <div className="mt-3 rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-4 text-xs text-muted-foreground">
        Loading roster…
      </div>
    );
  }

  if (error) {
    const message =
      (error as any)?.response?.data?.message ||
      error.message ||
      'Could not load roster';
    return (
      <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-3 text-xs text-destructive">
        <p className="font-medium">Could not load roster</p>
        <p className="mt-0.5 opacity-80">{message}</p>
        <p className="mt-1 opacity-60">
          If this is your first time using attendance, make sure the latest
          migration has been applied (<code>pnpm --filter api prisma:migrate</code>).
        </p>
      </div>
    );
  }

  if (!roster) {
    return (
      <div className="mt-3 rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-4 text-xs text-muted-foreground">
        No roster data.
      </div>
    );
  }

  // Dedupe students (a student can appear in both assignments and registrations)
  const studentMap = new Map<string, RosterStudent>();
  roster.registrations.forEach((r) => studentMap.set(r.student.id, r.student));
  roster.assignments.forEach((a) => studentMap.set(a.student.id, a.student));
  const students = Array.from(studentMap.values()).sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
  );

  const statusByStudent = new Map<string, AttendanceStatus>();
  roster.attendances.forEach((a) => statusByStudent.set(a.studentId, a.status));

  if (students.length === 0) {
    return (
      <div className="mt-3 rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-4 text-center text-xs text-muted-foreground">
        No students have registered or been assigned yet.
      </div>
    );
  }

  const statusStyles: Record<AttendanceStatus, string> = {
    PRESENT: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    ABSENT: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
    EXCUSED: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  };

  const presentCount = roster.attendances.filter((a) => a.status === 'PRESENT').length;

  return (
    <div className="mt-3 rounded-md border border-border/60 bg-muted/10 p-3 space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">
          Attendance ({students.length} student{students.length === 1 ? '' : 's'})
        </span>
        <span className="tabular-nums">{presentCount} present</span>
      </div>
      <ul className="space-y-1">
        {students.map((student) => {
          const status = statusByStudent.get(student.id) ?? null;
          return (
            <li
              key={student.id}
              className="flex items-center justify-between gap-2 rounded border border-transparent px-2 py-1 text-xs hover:bg-background"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground/90">
                  {student.firstName} {student.lastName}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {student.uniqueId}
                  {student.gradeLevel ? ` · Grade ${student.gradeLevel}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {(['PRESENT', 'ABSENT', 'EXCUSED'] as AttendanceStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={isMarking}
                    onClick={() => onMark(student.id, s)}
                    className={`rounded border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                      status === s
                        ? statusStyles[s]
                        : 'border-border/50 text-muted-foreground hover:bg-background'
                    }`}
                  >
                    {s === 'PRESENT' ? 'Present' : s === 'ABSENT' ? 'Absent' : 'Excused'}
                  </button>
                ))}
                {status ? (
                  <button
                    type="button"
                    onClick={() => onClear(student.id)}
                    className="text-[10px] text-muted-foreground hover:text-destructive"
                    title="Clear attendance"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[10px] text-muted-foreground">
        Marking a student Present awards 1 Flex Friday credit.
      </p>
    </div>
  );
}
