'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { flexFridayApi } from '@/lib/api';
import { getUser, hasRole } from '@/lib/auth';
import { format, parseISO } from 'date-fns';
import { Plus, Users, MapPin, CheckCircle, CalendarIcon } from 'lucide-react';
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

export default function FlexFridayPage() {
  const user = getUser();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedFriday, setSelectedFriday] = useState<any>(null);
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
    location: '',
    capacity: '',
    sessionType: 'STUDENT_CHOICE' as any,
    targetGrade: 'ANY',
    targetPathway: 'ANY' as any,
  });

  const gradeOptions = [9, 10, 11, 12];
  const pathwayOptions = [
    { value: 'INFORMATION_TECHNOLOGY', label: 'IT' },
    { value: 'HEALTH_SCIENCE', label: 'Health Science' },
    { value: 'ENGINEERING', label: 'Engineering' },
  ];

  const canManage = user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const canCreateSession = user && hasRole(user, 'TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const { data: fridays = [], isLoading } = useQuery({
    queryKey: ['flex-fridays'],
    queryFn: () => flexFridayApi.getAll().then((r) => r.data),
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['flex-sessions', selectedFriday?.id],
    queryFn: () => flexFridayApi.getSessions(selectedFriday.id).then((r) => r.data),
    enabled: !!selectedFriday,
  });

  const { data: myRegs = [] } = useQuery({
    queryKey: ['my-flex-registrations'],
    queryFn: () => flexFridayApi.getMyRegistrations().then((r) => r.data),
  });

  const myRegSessionIds = new Set((myRegs as any[]).map((r: any) => r.sessionId));
  const selectedCreateDate = fridayForm.date ? parseISO(fridayForm.date) : undefined;

  const createFridayMutation = useMutation({
    mutationFn: (d: any) => flexFridayApi.createFriday(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['flex-fridays'] }); setShowNewFriday(false); toast({ title: 'Flex Friday created' }); },
    onError: (e: any) => toast({ title: e.response?.data?.message || 'Failed', variant: 'destructive' }),
  });

  const createSessionMutation = useMutation({
    mutationFn: (d: any) => flexFridayApi.createSession(selectedFriday.id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['flex-sessions', selectedFriday?.id] }); setShowNewSession(false); toast({ title: 'Session created' }); },
  });

  const registerMutation = useMutation({
    mutationFn: (sessionId: string) => flexFridayApi.register(sessionId),
    onMutate: async (sessionId: string) => {
      const fridayId = selectedFriday?.id;
      await Promise.all([
        fridayId ? qc.cancelQueries({ queryKey: ['flex-sessions', fridayId] }) : Promise.resolve(),
        qc.cancelQueries({ queryKey: ['my-flex-registrations'] }),
      ]);

      const previousSessions = fridayId ? qc.getQueryData(['flex-sessions', fridayId]) : undefined;
      const previousRegs = qc.getQueryData(['my-flex-registrations']);

      if (fridayId) {
        qc.setQueryData(['flex-sessions', fridayId], (current: any[] | undefined) =>
          current?.map((session) =>
            session.id === sessionId
              ? {
                ...session,
                _count: {
                  ...session._count,
                  registrations: (session._count?.registrations || 0) + 1,
                },
              }
              : session,
          ),
        );
      }

      qc.setQueryData(['my-flex-registrations'], (current: any[] | undefined) => {
        if ((current || []).some((registration) => registration.sessionId === sessionId)) {
          return current;
        }
        return [...(current || []), { id: `optimistic-${sessionId}`, sessionId }];
      });

      return { fridayId, previousSessions, previousRegs };
    },
    onSuccess: () => { toast({ title: 'Registered!' }); },
    onError: (e: any, _sessionId, context) => {
      if (context?.fridayId) {
        qc.setQueryData(['flex-sessions', context.fridayId], context.previousSessions);
      }
      qc.setQueryData(['my-flex-registrations'], context?.previousRegs);
      toast({ title: e.response?.data?.message || 'Could not register', variant: 'destructive' });
    },
    onSettled: (_data, _error, _sessionId, context) => {
      if (context?.fridayId) {
        qc.invalidateQueries({ queryKey: ['flex-sessions', context.fridayId] });
      }
      qc.invalidateQueries({ queryKey: ['my-flex-registrations'] });
    },
  });

  const unregisterMutation = useMutation({
    mutationFn: (sessionId: string) => flexFridayApi.unregister(sessionId),
    onMutate: async (sessionId: string) => {
      const fridayId = selectedFriday?.id;
      await Promise.all([
        fridayId ? qc.cancelQueries({ queryKey: ['flex-sessions', fridayId] }) : Promise.resolve(),
        qc.cancelQueries({ queryKey: ['my-flex-registrations'] }),
      ]);

      const previousSessions = fridayId ? qc.getQueryData(['flex-sessions', fridayId]) : undefined;
      const previousRegs = qc.getQueryData(['my-flex-registrations']);

      if (fridayId) {
        qc.setQueryData(['flex-sessions', fridayId], (current: any[] | undefined) =>
          current?.map((session) =>
            session.id === sessionId
              ? {
                ...session,
                _count: {
                  ...session._count,
                  registrations: Math.max((session._count?.registrations || 1) - 1, 0),
                },
              }
              : session,
          ),
        );
      }

      qc.setQueryData(['my-flex-registrations'], (current: any[] | undefined) =>
        (current || []).filter((registration) => registration.sessionId !== sessionId),
      );

      return { fridayId, previousSessions, previousRegs };
    },
    onSuccess: () => { toast({ title: 'Unregistered' }); },
    onError: (e: any, _sessionId, context) => {
      if (context?.fridayId) {
        qc.setQueryData(['flex-sessions', context.fridayId], context.previousSessions);
      }
      qc.setQueryData(['my-flex-registrations'], context?.previousRegs);
      toast({ title: e.response?.data?.message || 'Could not unregister', variant: 'destructive' });
    },
    onSettled: (_data, _error, _sessionId, context) => {
      if (context?.fridayId) {
        qc.invalidateQueries({ queryKey: ['flex-sessions', context.fridayId] });
      }
      qc.invalidateQueries({ queryKey: ['my-flex-registrations'] });
    },
  });

  const isStudent = user && hasRole(user, 'STUDENT', 'STUDENT_LEADER');

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Flex Friday</h1>
            <p className="text-muted-foreground text-sm">Sessions and registration</p>
          </div>
          {canManage && <Button onClick={() => setShowNewFriday(true)} className="flex items-center gap-2"><Plus size={16} /> Schedule Friday</Button>}
        </div>

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
                    gradeLevel:
                      fridayForm.type === 'GRADE_SPECIFIC'
                        ? Number(fridayForm.gradeLevel)
                        : fridayForm.type === 'FRESHMAN_WORKSHOP'
                          ? 9
                          : undefined,
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
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !fridayForm.date && 'text-muted-foreground',
                        )}
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
                  <Select
                    value={fridayForm.type}
                    onValueChange={(value) =>
                      setFridayForm((current) => ({
                        ...current,
                        type: value,
                        gradeLevel:
                          value === 'FRESHMAN_WORKSHOP'
                            ? '9'
                            : current.gradeLevel,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL_STUDENT">All Student</SelectItem>
                      <SelectItem value="FRESHMAN_WORKSHOP">Freshman Workshop</SelectItem>
                      <SelectItem value="GRADE_SPECIFIC">Grade Specific</SelectItem>
                      <SelectItem value="PATHWAY_SPECIFIC">Pathway Specific</SelectItem>
                      <SelectItem value="TEACHER_PD">Teacher PD (No School)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {fridayForm.type === 'PATHWAY_SPECIFIC' && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block font-medium">Pathway</label>
                    <Select
                      value={fridayForm.pathway}
                      onValueChange={(value) => setFridayForm({ ...fridayForm, pathway: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select pathway" />
                      </SelectTrigger>
                      <SelectContent>
                        {pathwayOptions.map((pathway) => (
                          <SelectItem key={pathway.value} value={pathway.value}>
                            {pathway.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(fridayForm.type === 'GRADE_SPECIFIC' || fridayForm.type === 'FRESHMAN_WORKSHOP') && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block font-medium">Grade</label>
                    <Select
                      value={fridayForm.type === 'FRESHMAN_WORKSHOP' ? '9' : fridayForm.gradeLevel}
                      onValueChange={(value) => setFridayForm({ ...fridayForm, gradeLevel: value })}
                      disabled={fridayForm.type === 'FRESHMAN_WORKSHOP'}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {gradeOptions.map((grade) => (
                          <SelectItem key={grade} value={String(grade)}>
                            Grade {grade}
                          </SelectItem>
                        ))}
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

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Friday list */}
          <div className="lg:col-span-1">
            <h2 className="font-semibold text-muted-foreground mb-4 text-sm uppercase tracking-wider">Scheduled Fridays</h2>
            {isLoading ? <p className="text-muted-foreground text-sm">Loading…</p> :
              (fridays as any[]).length === 0 ? <p className="text-muted-foreground text-sm">No Flex Fridays scheduled</p> :
                <div className="space-y-2">
                  {(fridays as any[]).map((f) => (
                    <button key={f.id} onClick={() => setSelectedFriday(f)}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${selectedFriday?.id === f.id
                        ? 'border-accent-500/40 bg-accent-500/10 text-foreground dark:text-white ring-1 ring-accent-500/20'
                        : 'border-border hover:border-accent-500/20 bg-background hover:bg-accent-500/5 text-foreground/80 hover:text-foreground'
                        }`}>
                      <p className="font-semibold text-sm">{format(new Date(f.date), 'EEE, MMM d, yyyy')}</p>
                      <p className="text-xs text-muted-foreground mt-1 font-medium">{f.type.replace(/_/g, ' ')}</p>
                      {f.pathway && <p className="text-xs text-muted-foreground mt-1">Pathway: {f.pathway.replace(/_/g, ' ')}</p>}
                      {f.gradeLevel && <p className="text-xs text-muted-foreground mt-1">Grade {f.gradeLevel}</p>}
                      {f._count?.sessions > 0 && <p className="text-xs text-muted-foreground/80 mt-1 flex items-center gap-1.5 before:content-[''] before:w-1 before:h-1 before:bg-accent-500 before:rounded-full">{f._count.sessions} sessions</p>}
                    </button>
                  ))}
                </div>
            }
          </div>

          {/* Sessions panel */}
          <div className="lg:col-span-2">
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
                            description: sessionForm.description,
                            location: sessionForm.location,
                            capacity: sessionForm.capacity ? parseInt(sessionForm.capacity) : undefined,
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block font-medium">Location</label>
                            <Input placeholder="Location" value={sessionForm.location} onChange={(e) => setSessionForm({ ...sessionForm, location: e.target.value })} />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block font-medium">Capacity (optional)</label>
                            <Input type="number" placeholder="Capacity (optional)" value={sessionForm.capacity} onChange={(e) => setSessionForm({ ...sessionForm, capacity: e.target.value })} />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block font-medium">Session Type</label>
                          <Select value={sessionForm.sessionType} onValueChange={(v) => setSessionForm({ ...sessionForm, sessionType: v })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="STUDENT_CHOICE">Student Choice</SelectItem>
                              <SelectItem value="TEACHER_ASSIGNED">Teacher Assigned</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block font-medium">Target Pathway</label>
                            <Select
                              value={sessionForm.targetPathway}
                              onValueChange={(value) => setSessionForm({ ...sessionForm, targetPathway: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Any pathway" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ANY">Any pathway</SelectItem>
                                {pathwayOptions.map((pathway) => (
                                  <SelectItem key={pathway.value} value={pathway.value}>
                                    {pathway.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block font-medium">Target Grade</label>
                            <Select
                              value={sessionForm.targetGrade}
                              onValueChange={(value) => setSessionForm({ ...sessionForm, targetGrade: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Any grade" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ANY">Any grade</SelectItem>
                                {gradeOptions.map((grade) => (
                                  <SelectItem key={grade} value={String(grade)}>
                                    Grade {grade}
                                  </SelectItem>
                                ))}
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
                  <div className="space-y-3">
                    {(sessions as any[]).map((s) => {
                      const isRegistered = myRegSessionIds.has(s.id);
                      const isFull = s.capacity && s._count?.registrations >= s.capacity;
                      const isRegistering = registerMutation.isPending && registerMutation.variables === s.id;
                      const isUnregistering = unregisterMutation.isPending && unregisterMutation.variables === s.id;
                      return (
                        <Card key={s.id} className={`hover:-translate-y-0.5 transition-all duration-200 ${isRegistered ? 'border-accent-500/30 ring-1 ring-accent-500/10' : ''}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-foreground/90">{s.title}</h3>
                                  {s.sessionType === 'TEACHER_ASSIGNED' && <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-transparent text-[10px] leading-tight py-0">Assigned</Badge>}
                                  {isRegistered && <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-transparent text-[10px] leading-tight py-0"><CheckCircle size={10} className="mr-1" /> Registered</Badge>}
                                </div>
                                {s.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{s.description}</p>}
                                <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                                  {s.location && <span className="flex items-center gap-1.5 font-medium"><MapPin size={12} />{s.location}</span>}
                                  <span className="flex items-center gap-1.5 font-medium"><Users size={12} />{s._count?.registrations}{s.capacity ? `/${s.capacity}` : ''} registered</span>
                                  {s.targetPathway && <span className="font-medium">Pathway: {s.targetPathway.replace(/_/g, ' ')}</span>}
                                  {s.targetGrade && <span className="font-medium">Grade {s.targetGrade}</span>}
                                </div>
                              </div>
                              {isStudent && s.sessionType === 'STUDENT_CHOICE' && (
                                isRegistered ? (
                                  <Button variant="ghost" size="sm" onClick={() => unregisterMutation.mutate(s.id)} disabled={isUnregistering} className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive flex items-center gap-1.5 flex-shrink-0">
                                    {isUnregistering ? 'Updating…' : 'Unregister'}
                                  </Button>
                                ) : (
                                  <Button size="sm" onClick={() => registerMutation.mutate(s.id)} disabled={!!isFull || isRegistering} className="h-8 flex-shrink-0">
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
