'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { flexFridayApi } from '@/lib/api';
import { getUser, hasRole } from '@/lib/auth';
import { format, parseISO } from 'date-fns';
import { Plus, Users, MapPin, CheckCircle, CalendarIcon, Ticket, ChevronRight } from 'lucide-react';
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
  const [showNewSession, setShowNewSession] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    title: '',
    description: '',
    sessionType: 'STUDENT_CHOICE' as any,
    targetGrade: 'ANY',
    targetPathway: 'ANY' as any,
  });
  const [showNewWorkshop, setShowNewWorkshop] = useState(false);
  const [workshopForm, setWorkshopForm] = useState({
    title: '',
    description: '',
    location: '',
    capacity: '',
  });

  const pathwayOptions = [
    { value: 'INFORMATION_TECHNOLOGY', label: 'IT' },
    { value: 'HEALTH_SCIENCE', label: 'Health Science' },
    { value: 'ENGINEERING', label: 'Engineering' },
  ];
  const gradeOptions = [9, 10, 11, 12];

  const canManage = user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const canCreateSession = user && hasRole(user, 'TEACHER', 'ADMIN', 'SUPER_ADMIN');
  const isStudent = user && hasRole(user, 'STUDENT');

  // ── Queries ───────────────────────────────────────────────────────────────────
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
    queryFn: () => flexFridayApi.getWorkshops(selectedFriday.id, selectedSession.id).then((r) => r.data),
    enabled: !!selectedFriday && !!selectedSession,
  });

  const { data: myRegs = [] } = useQuery({
    queryKey: ['my-flex-registrations'],
    queryFn: () => flexFridayApi.getMyRegistrations().then((r) => r.data),
  });

  const myRegWorkshopIds = new Set((myRegs as any[]).map((r: any) => r.workshopId));
  const selectedCreateDate = fridayForm.date ? parseISO(fridayForm.date) : undefined;

  // ── Mutations ─────────────────────────────────────────────────────────────────
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
      setShowNewSession(false);
      toast({ title: 'Session created' });
    },
  });

  const createWorkshopMutation = useMutation({
    mutationFn: (d: any) => flexFridayApi.createWorkshop(selectedFriday.id, selectedSession.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flex-workshops', selectedFriday?.id, selectedSession?.id] });
      setShowNewWorkshop(false);
      setWorkshopForm({ title: '', description: '', location: '', capacity: '' });
      toast({ title: 'Workshop created' });
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

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleSelectFriday = (f: any) => {
    setSelectedFriday(f);
    setSelectedSession(null);
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Flex Friday</h1>
            <p className="text-muted-foreground text-sm">Sessions, workshops, and registration</p>
          </div>
          <div className="flex items-center gap-2">
            {canManage && <Button onClick={() => setShowNewFriday(true)} className="flex items-center gap-2"><Plus size={16} /> Schedule Friday</Button>}
            {isStudent && (
              <Link href="/flex-friday/pass">
                <Button variant="outline" className="flex items-center gap-2 border-orange-500/30 text-orange-500 hover:bg-orange-500/10">
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
                        {pathwayOptions.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
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
                        {gradeOptions.map((g) => <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>)}
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
                  {canCreateSession && (
                    <Button size="sm" onClick={() => setShowNewSession(true)} className="flex items-center gap-1 h-8"><Plus size={14} /> Add Session</Button>
                  )}
                </div>

                {showNewSession && canCreateSession && (
                  <Card className="mb-4">
                    <CardHeader className="pb-3 border-b mb-4">
                      <CardTitle className="text-base font-semibold">New Session</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          createSessionMutation.mutate({
                            title: sessionForm.title,
                            description: sessionForm.description || undefined,
                            sessionType: sessionForm.sessionType,
                            targetPathway: sessionForm.targetPathway !== 'ANY' ? sessionForm.targetPathway : undefined,
                            targetGrade: sessionForm.targetGrade !== 'ANY' ? Number(sessionForm.targetGrade) : undefined,
                          });
                        }}
                        className="space-y-4"
                      >
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Session Title *</label>
                          <Input placeholder="Session title" value={sessionForm.title} onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })} required />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Description</label>
                          <Textarea placeholder="Description" value={sessionForm.description} onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })} rows={2} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Session Type</label>
                          <Select value={sessionForm.sessionType} onValueChange={(v) => setSessionForm({ ...sessionForm, sessionType: v })}>
                            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="STUDENT_CHOICE">Student Choice</SelectItem>
                              <SelectItem value="TEACHER_ASSIGNED">Teacher Assigned</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block font-medium">Target Pathway</label>
                            <Select value={sessionForm.targetPathway} onValueChange={(v) => setSessionForm({ ...sessionForm, targetPathway: v })}>
                              <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ANY">Any pathway</SelectItem>
                                {pathwayOptions.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block font-medium">Target Grade</label>
                            <Select value={sessionForm.targetGrade} onValueChange={(v) => setSessionForm({ ...sessionForm, targetGrade: v })}>
                              <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ANY">Any grade</SelectItem>
                                {gradeOptions.map((g) => <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-border mt-2">
                          <Button type="submit" size="sm" disabled={createSessionMutation.isPending}>Create</Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewSession(false)}>Cancel</Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {(sessions as any[]).length === 0 ? (
                  <Card className="text-center py-8 border-dashed">
                    <CardContent className="pt-6">
                      <p className="text-muted-foreground text-sm">No sessions yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {(sessions as any[]).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSession(s)}
                        className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${selectedSession?.id === s.id
                          ? 'border-accent-500/40 bg-accent-500/10 ring-1 ring-accent-500/20'
                          : 'border-border hover:border-accent-500/20 bg-background hover:bg-accent-500/5'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="font-semibold text-foreground/90 text-sm">{s.title}</h3>
                              {s.sessionType === 'TEACHER_ASSIGNED' && (
                                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-transparent text-[10px] leading-tight py-0">Assigned</Badge>
                              )}
                            </div>
                            {s.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.description}</p>}
                            <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                              {s._count?.workshops > 0 && <span className="font-medium">{s._count.workshops} workshop{s._count.workshops === 1 ? '' : 's'}</span>}
                              {s.targetPathway && <span>{s.targetPathway.replace(/_/g, ' ')}</span>}
                              {s.targetGrade && <span>Grade {s.targetGrade}</span>}
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                        </div>
                      </button>
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
                  {canCreateSession && (
                    <Button size="sm" onClick={() => setShowNewWorkshop(true)} className="flex items-center gap-1 h-8"><Plus size={14} /> Add Workshop</Button>
                  )}
                </div>

                {showNewWorkshop && canCreateSession && (
                  <Card className="mb-4">
                    <CardHeader className="pb-3 border-b mb-4">
                      <CardTitle className="text-base font-semibold">New Workshop</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          createWorkshopMutation.mutate({
                            title: workshopForm.title,
                            description: workshopForm.description || undefined,
                            location: workshopForm.location || undefined,
                            capacity: workshopForm.capacity ? parseInt(workshopForm.capacity) : undefined,
                          });
                        }}
                        className="space-y-4"
                      >
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Workshop Title *</label>
                          <Input placeholder="Workshop title" value={workshopForm.title} onChange={(e) => setWorkshopForm({ ...workshopForm, title: e.target.value })} required />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Description</label>
                          <Textarea placeholder="Description" value={workshopForm.description} onChange={(e) => setWorkshopForm({ ...workshopForm, description: e.target.value })} rows={2} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block font-medium">Location</label>
                            <Input placeholder="Room / location" value={workshopForm.location} onChange={(e) => setWorkshopForm({ ...workshopForm, location: e.target.value })} />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block font-medium">Capacity</label>
                            <Input type="number" placeholder="Optional" value={workshopForm.capacity} onChange={(e) => setWorkshopForm({ ...workshopForm, capacity: e.target.value })} />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-border mt-2">
                          <Button type="submit" size="sm" disabled={createWorkshopMutation.isPending}>Create</Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewWorkshop(false)}>Cancel</Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {(workshops as any[]).length === 0 ? (
                  <Card className="text-center py-8 border-dashed">
                    <CardContent className="pt-6">
                      <p className="text-muted-foreground text-sm">No workshops yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {(workshops as any[]).map((w) => {
                      const isRegistered = myRegWorkshopIds.has(w.id);
                      const isFull = w.capacity && w._count?.registrations >= w.capacity;
                      const isRegistering = registerMutation.isPending && registerMutation.variables === w.id;
                      const isUnregistering = unregisterMutation.isPending && unregisterMutation.variables === w.id;
                      return (
                        <Card key={w.id} className={`transition-all duration-200 ${isRegistered ? 'border-accent-500/30 ring-1 ring-accent-500/10' : 'hover:-translate-y-0.5'}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <h3 className="font-semibold text-foreground/90 text-sm">{w.title}</h3>
                                  {isRegistered && (
                                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-transparent text-[10px] leading-tight py-0">
                                      <CheckCircle size={10} className="mr-1" /> Registered
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
