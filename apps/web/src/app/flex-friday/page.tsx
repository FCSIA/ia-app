'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { Id } from '~/apps/convex/src/_generated/dataModel';

// Hooks
import { useFlexFriday } from './_hooks/useFlexFriday';
import { useFlexActions } from './_hooks/useFlexActions';

// Components
import { FridayHeader } from './_components/FridayHeader';
import { SessionPanel } from './_components/SessionPanel';
import { WorkshopPanel } from './_components/WorkshopPanel';
import { AuditView } from './_components/AuditView';
import { FridayForm } from './_components/FridayForm';
import { SessionForm } from './_components/SessionForm';
import { WorkshopForm } from './_components/WorkshopForm';
import { AttendancePanel } from './_components/AttendancePanel';

// Constants & Types
import { EMPTY_SESSION_FORM, EMPTY_WORKSHOP_FORM } from './_constants';
import type { SessionForm as SessionFormType, WorkshopForm as WorkshopFormType } from './_types';

export default function FlexFridayPage() {
  const { toast } = useToast();
  
  // Data & State Hook
  const flex = useFlexFriday();
  
  // Actions & Mutations Hook
  const actions = useFlexActions();

  // Form State
  const [fridayFormOpen, setFridayFormOpen] = useState(false);
  
  const [sessionFormOpen, setSessionFormOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionForm, setSessionForm] = useState<SessionFormType>(EMPTY_SESSION_FORM);

  const [workshopFormOpen, setWorkshopFormOpen] = useState(false);
  const [editingWorkshopId, setEditingWorkshopId] = useState<string | null>(null);
  const [workshopForm, setWorkshopForm] = useState<WorkshopFormType>(EMPTY_WORKSHOP_FORM);

  // ── Session Handlers ──────────────────────────────────────────────────────
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

  const handleDeleteSession = (s: any) => {
    if (confirm(`Delete session "${s.title}"? This will fail if workshops are attached.`)) {
      void actions.runAction('session-delete', async () => {
        await actions.mutations.deleteSession({ sessionId: s._id });
        toast({ title: 'Session deleted' });
      });
    }
  };

  // ── Workshop Handlers ─────────────────────────────────────────────────────
  const openNewWorkshopForm = () => {
    setEditingWorkshopId(null);
    setWorkshopForm({
      ...EMPTY_WORKSHOP_FORM,
      sessionIds: flex.selectedSession ? [flex.selectedSession._id] : [],
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
        : [],
      targetGrades: Array.isArray(w.targetGrades) ? w.targetGrades : [],
      targetMajorPathways: Array.isArray(w.targetMajorPathways) ? w.targetMajorPathways : [],
      targetMinorPathways: Array.isArray(w.targetMinorPathways) ? w.targetMinorPathways : [],
    });
    setWorkshopFormOpen(true);
  };

  const handleDeleteWorkshop = (w: any) => {
    if (confirm(`Delete workshop "${w.title}"?`)) {
      void actions.runAction('workshop-delete', async () => {
        await actions.mutations.deleteWorkshop({ workshopId: w._id });
        toast({ title: 'Workshop deleted' });
      });
    }
  };

  const handleRegister = (workshopId: string) => {
    void actions.runAction('register', async () => {
      await actions.mutations.register({ workshopId: workshopId as Id<'flexWorkshops'> });
      toast({ title: 'Registered successfully' });
    });
  };

  const handleUnregister = (workshopId: string) => {
    void actions.runAction('unregister', async () => {
      await actions.mutations.unregister({ workshopId: workshopId as Id<'flexWorkshops'> });
      toast({ title: 'Registration removed' });
    });
  };

  return (
    <AppShell
      headerSlot={<h1 className="truncate text-lg font-semibold tracking-tight text-foreground">Flex Friday</h1>}
      mainClassName="flex-1 px-3 pb-4 pt-3 md:px-4"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <FridayHeader
          fridays={flex.fridays}
          selectedFriday={flex.selectedFriday}
          onSelectFriday={flex.setSelectedFriday}
          onAddFriday={() => setFridayFormOpen(true)}
          canManage={flex.canCreateFriday}
          isStudent={flex.isStudent}
          activeView={flex.activeView}
          onViewChange={flex.setActiveView}
          credits={flex.credits}
        />

        {flex.isLoading ? (
          <div className="grid gap-4 lg:grid-cols-12">
            <Skeleton className="h-72 lg:col-span-4" />
            <Skeleton className="h-72 lg:col-span-8" />
          </div>
        ) : flex.activeView === 'audit' ? (
          <AuditView auditEvents={flex.auditEvents} isLoading={flex.auditLoading} />
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
            {/* Sessions Column */}
            <div className="lg:col-span-4">
              <SessionPanel
                sessions={flex.sessions}
                selectedSession={flex.selectedSession}
                onSelectSession={flex.setSelectedSession}
                onAddSession={openNewSessionForm}
                onEditSession={openEditSessionForm}
                onDeleteSession={handleDeleteSession}
                canCreate={flex.canCreateSession}
                canManage={flex.canManageSessions}
                search={flex.sessionSearch}
                onSearchChange={flex.setSessionSearch}
              />
            </div>

            {/* Workshops Column */}
            <div className="flex flex-col gap-4 lg:col-span-8">
              <WorkshopPanel
                workshops={flex.workshops}
                selectedSession={flex.selectedSession}
                onAddWorkshop={openNewWorkshopForm}
                onEditWorkshop={openEditWorkshopForm}
                onDeleteWorkshop={handleDeleteWorkshop}
                onRegister={handleRegister}
                onUnregister={handleUnregister}
                onAttendance={(id) =>
                  flex.setAttendanceWorkshopId((current) =>
                    current === id ? null : (id as Id<'flexWorkshops'>),
                  )
                }
                canManageWorkshops={flex.canManageWorkshops}
                canManageAttendance={flex.canManageAttendance}
                isStudent={flex.isStudent}
                search={flex.workshopSearch}
                onSearchChange={flex.setWorkshopSearch}
                myRegWorkshopIds={flex.myRegWorkshopIds}
                actionPending={actions.actionPending}
              />

              {/* Attendance Overlay/Panel */}
              {flex.attendanceWorkshopId && (
                <div>
                  <AttendancePanel
                    roster={flex.rosterData}
                    isLoading={flex.rosterLoading}
                    error={null}
                    onMark={(studentId, status) => 
                      void actions.runAction('attendance-mark', () => 
                        actions.mutations.markAttendance({
                          workshopId: flex.attendanceWorkshopId!,
                          studentId,
                          status,
                        })
                      )
                    }
                    onClear={(studentId) => 
                      void actions.runAction('attendance-clear', () => 
                        actions.mutations.clearAttendance({
                          workshopId: flex.attendanceWorkshopId!,
                          studentId,
                        })
                      )
                    }
                    isMarking={actions.actionPending != null}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Forms */}
      <FridayForm
        isOpen={fridayFormOpen}
        onOpenChange={setFridayFormOpen}
        runAction={actions.runAction}
        mutations={actions.mutations}
      />

      {flex.selectedFriday ? (
        <>
          <SessionForm
            isOpen={sessionFormOpen}
            onOpenChange={setSessionFormOpen}
            editingSessionId={editingSessionId}
            initialData={sessionForm}
            flexFridayId={flex.selectedFriday._id}
            runAction={actions.runAction}
            mutations={actions.mutations}
          />

          <WorkshopForm
            isOpen={workshopFormOpen}
            onOpenChange={setWorkshopFormOpen}
            editingWorkshopId={editingWorkshopId}
            initialData={workshopForm}
            sessions={flex.sessions}
            flexFridayId={flex.selectedFriday._id}
            runAction={actions.runAction}
            mutations={actions.mutations}
          />
        </>
      ) : null}
    </AppShell>
  );
}
