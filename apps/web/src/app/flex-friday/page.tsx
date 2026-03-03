'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { flexFridayApi } from '@/lib/api';
import { getUser, hasRole } from '@/lib/auth';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Plus, Users, MapPin, CheckCircle } from 'lucide-react';

export default function FlexFridayPage() {
  const user = getUser();
  const qc = useQueryClient();
  const [selectedFriday, setSelectedFriday] = useState<any>(null);
  const [showNewFriday, setShowNewFriday] = useState(false);
  const [fridayForm, setFridayForm] = useState({ date: '', type: 'ALL_STUDENT' as any, notes: '', isSchoolDay: true });
  const [showNewSession, setShowNewSession] = useState(false);
  const [sessionForm, setSessionForm] = useState({ title: '', description: '', location: '', capacity: '', sessionType: 'STUDENT_CHOICE' as any });

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

  const createFridayMutation = useMutation({
    mutationFn: (d: any) => flexFridayApi.createFriday(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['flex-fridays'] }); setShowNewFriday(false); toast.success('Flex Friday created'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const createSessionMutation = useMutation({
    mutationFn: (d: any) => flexFridayApi.createSession(selectedFriday.id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['flex-sessions', selectedFriday?.id] }); setShowNewSession(false); toast.success('Session created'); },
  });

  const registerMutation = useMutation({
    mutationFn: (sessionId: string) => flexFridayApi.register(sessionId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['flex-sessions', selectedFriday?.id, 'my-flex-registrations'] }); toast.success('Registered!'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Could not register'),
  });

  const unregisterMutation = useMutation({
    mutationFn: (sessionId: string) => flexFridayApi.unregister(sessionId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['flex-sessions', selectedFriday?.id, 'my-flex-registrations'] }); toast.success('Unregistered'); },
  });

  const isStudent = user && hasRole(user, 'STUDENT', 'STUDENT_LEADER');

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Flex Friday</h1>
            <p className="text-white/45 text-sm">Sessions and registration</p>
          </div>
          {canManage && <button onClick={() => setShowNewFriday(true)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={16}/> Schedule Friday</button>}
        </div>

        {showNewFriday && canManage && (
          <div className="card mb-6">
            <h2 className="font-semibold text-white mb-4">Schedule Flex Friday</h2>
            <form onSubmit={(e) => { e.preventDefault(); createFridayMutation.mutate(fridayForm); }} className="space-y-3">
              <input type="date" className="input" value={fridayForm.date} onChange={(e) => setFridayForm({ ...fridayForm, date: e.target.value })} required />
              <select className="input" value={fridayForm.type} onChange={(e) => setFridayForm({ ...fridayForm, type: e.target.value })}>
                <option value="ALL_STUDENT">All Student</option>
                <option value="FRESHMAN_WORKSHOP">Freshman Workshop</option>
                <option value="PATHWAY_SPECIFIC">Pathway Specific</option>
                <option value="TEACHER_PD">Teacher PD (No School)</option>
              </select>
              <textarea className="input" placeholder="Notes (optional)" value={fridayForm.notes} onChange={(e) => setFridayForm({ ...fridayForm, notes: e.target.value })} rows={2} />
              <div className="flex gap-2">
                <button type="submit" className="btn-primary" disabled={createFridayMutation.isPending}>Create</button>
                <button type="button" onClick={() => setShowNewFriday(false)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Friday list */}
          <div className="lg:col-span-1">
            <h2 className="font-semibold text-white/70 mb-3 text-sm uppercase tracking-wider">Scheduled Fridays</h2>
            {isLoading ? <p className="text-white/35 text-sm">Loading…</p> :
             (fridays as any[]).length === 0 ? <p className="text-white/35 text-sm">No Flex Fridays scheduled</p> :
             <div className="space-y-2">
               {(fridays as any[]).map((f) => (
                 <button key={f.id} onClick={() => setSelectedFriday(f)}
                   className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                     selectedFriday?.id === f.id
                       ? 'border-accent-500/40 bg-accent-500/10 text-white'
                       : 'border-white/[0.07] hover:border-white/[0.14] bg-white/[0.03] text-white/80 hover:text-white'
                   }`}>
                   <p className="font-medium text-sm">{format(new Date(f.date), 'EEE, MMM d, yyyy')}</p>
                   <p className="text-xs text-white/40 mt-0.5">{f.type.replace(/_/g, ' ')}</p>
                   {f._count?.sessions > 0 && <p className="text-xs text-white/35">{f._count.sessions} sessions</p>}
                 </button>
               ))}
             </div>
            }
          </div>

          {/* Sessions panel */}
          <div className="lg:col-span-2">
            {!selectedFriday ? (
              <div className="card flex items-center justify-center h-40 text-white/30">Select a Friday to view sessions</div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-white/80">Sessions — {format(new Date(selectedFriday.date), 'MMM d')}</h2>
                  {canCreateSession && (
                    <button onClick={() => setShowNewSession(true)} className="btn-primary text-sm py-1 px-3 flex items-center gap-1"><Plus size={14}/> Add Session</button>
                  )}
                </div>

                {showNewSession && canCreateSession && (
                  <div className="card mb-4">
                    <h3 className="font-medium text-white mb-3">New Session</h3>
                    <form onSubmit={(e) => { e.preventDefault(); createSessionMutation.mutate({ ...sessionForm, capacity: sessionForm.capacity ? parseInt(sessionForm.capacity) : undefined }); }} className="space-y-2">
                      <input className="input" placeholder="Session title" value={sessionForm.title} onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })} required />
                      <textarea className="input" placeholder="Description" value={sessionForm.description} onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })} rows={2} />
                      <div className="grid grid-cols-2 gap-2">
                        <input className="input" placeholder="Location" value={sessionForm.location} onChange={(e) => setSessionForm({ ...sessionForm, location: e.target.value })} />
                        <input type="number" className="input" placeholder="Capacity (optional)" value={sessionForm.capacity} onChange={(e) => setSessionForm({ ...sessionForm, capacity: e.target.value })} />
                      </div>
                      <select className="input" value={sessionForm.sessionType} onChange={(e) => setSessionForm({ ...sessionForm, sessionType: e.target.value })}>
                        <option value="STUDENT_CHOICE">Student Choice</option>
                        <option value="TEACHER_ASSIGNED">Teacher Assigned</option>
                      </select>
                      <div className="flex gap-2">
                        <button type="submit" className="btn-primary text-sm py-1" disabled={createSessionMutation.isPending}>Create</button>
                        <button type="button" onClick={() => setShowNewSession(false)} className="btn-secondary text-sm py-1">Cancel</button>
                      </div>
                    </form>
                  </div>
                )}

                {(sessions as any[]).length === 0 ? (
                  <div className="card text-center text-white/30 py-8">No sessions yet</div>
                ) : (
                  <div className="space-y-3">
                    {(sessions as any[]).map((s) => {
                      const isRegistered = myRegSessionIds.has(s.id);
                      const isFull = s.capacity && s._count?.registrations >= s.capacity;
                      return (
                        <div key={s.id} className="card hover:-translate-y-0.5 transition-all duration-200">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-white/90">{s.title}</h3>
                                {s.sessionType === 'TEACHER_ASSIGNED' && <span className="badge-yellow text-[10px]">Assigned</span>}
                              </div>
                              {s.description && <p className="text-sm text-white/50">{s.description}</p>}
                              <div className="flex flex-wrap gap-3 mt-1 text-xs text-white/40">
                                {s.location && <span className="flex items-center gap-1"><MapPin size={10}/>{s.location}</span>}
                                <span className="flex items-center gap-1"><Users size={10}/>{s._count?.registrations}{s.capacity ? `/${s.capacity}` : ''} registered</span>
                              </div>
                            </div>
                            {isStudent && s.sessionType === 'STUDENT_CHOICE' && (
                              isRegistered ? (
                                <button onClick={() => unregisterMutation.mutate(s.id)} className="flex items-center gap-1 text-emerald-400 hover:text-red-400 text-sm transition-colors">
                                  <CheckCircle size={16}/> Registered
                                </button>
                              ) : (
                                <button onClick={() => registerMutation.mutate(s.id)} disabled={!!isFull} className="btn-primary text-sm py-1 px-3">
                                  {isFull ? 'Full' : 'Register'}
                                </button>
                              )
                            )}
                          </div>
                        </div>
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
