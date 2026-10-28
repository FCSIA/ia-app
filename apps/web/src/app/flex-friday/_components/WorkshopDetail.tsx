'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ConvexError } from 'convex/values';
import { ArrowLeft, ClipboardList, Ticket } from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import { displayName } from '~/apps/shared/user-name';
import { useConvexAuth, useMutation, useQuery } from '@/lib/convex-react';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { formatSchoolTime } from '@/lib/time-format';
import { calendarDate } from '@/components/calendar/calendar-date';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardGroup,
  CardHeader,
} from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { PATHWAY_OPTIONS } from '../_types';

function registrationErrorMessage(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === 'string') {
    return error.data;
  }
  // The existing mutations throw ordinary Errors. Show their actionable
  // messages without exposing Convex's request/stack wrapper in the page.
  if (error instanceof Error) {
    const knownMessages = [
      'Workshop is at full capacity',
      'Already registered for a workshop in one of these sessions',
      'Already registered for this workshop',
      'Registration not found',
      'Workshop not found',
      'Only students can register for workshops',
      'Workshop is not attached to any sessions',
    ];
    const message = knownMessages.find((value) => error.message.includes(value));
    if (message) return message;
  }
  return 'Couldn’t update your registration. Try again.';
}

function WorkshopFrame({ children }: { children: ReactNode }) {
  return (
    <AppShell
      headerSlot={
        <span className="text-lg font-semibold text-foreground">
          Flex Friday
        </span>
      }
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        {children}
      </div>
    </AppShell>
  );
}

export function WorkshopDetailLoading() {
  return (
    <WorkshopFrame>
      <div
        role="status"
        aria-label="Loading workshop"
        className="flex flex-col gap-6"
      >
        <Skeleton className="h-8 w-32" />
        <CardGroup border="outlined">
          <Card>
            <CardHeader className="gap-3">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        </CardGroup>
        <Skeleton className="h-32 w-full" />
      </div>
    </WorkshopFrame>
  );
}

export function WorkshopDetailUnavailable({
  failed = false,
  onRetry,
}: {
  failed?: boolean;
  onRetry?: () => void;
}) {
  return (
    <WorkshopFrame>
      <Empty>
        <EmptyHeader>
          <EmptyTitle>
            {failed ? 'Workshop couldn’t load' : 'Workshop not found'}
          </EmptyTitle>
          <EmptyDescription>
            {failed
              ? 'Try again, or open the Friday schedule.'
              : 'This workshop may have been removed, or the link may point to a different Friday.'}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {onRetry ? <Button onClick={onRetry}>Try again</Button> : null}
          <Button asChild variant={failed ? 'tertiary' : 'primary'}>
            <Link href="/flex-friday">Back to Flex Friday</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </WorkshopFrame>
  );
}

export function WorkshopDetail({
  fridayId,
  workshopId,
  selectedSessionId,
}: {
  fridayId: string;
  workshopId: string;
  selectedSessionId?: string;
}) {
  const { isAuthenticated } = useConvexAuth();
  const user = useCurrentUser();
  const detail = useQuery(
    api.flexFriday.workshops.detail,
    isAuthenticated ? { flexFridayId: fridayId, workshopId } : 'skip',
  );
  const register = useMutation(api.flexFriday.registration.register);
  const unregister = useMutation(api.flexFriday.registration.unregister);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { toast } = useToast();

  if (detail === undefined) return <WorkshopDetailLoading />;
  if (!detail) return <WorkshopDetailUnavailable />;

  const { friday, workshop, sessions, teacher, viewer } = detail;
  const selectedSession =
    sessions.find((session) => session._id === selectedSessionId) ??
    sessions[0];
  const scheduleParams = new URLSearchParams({
    friday: friday._id,
    view: 'schedule',
  });
  if (selectedSession) scheduleParams.set('session', selectedSession._id);
  const scheduleHref = `/flex-friday?${scheduleParams}`;
  const rosterParams = new URLSearchParams(scheduleParams);
  rosterParams.set('attendance', workshop._id);
  const isStudent = hasRole(user, 'STUDENT', 'STUDENT_LEADER', 'STUDENT_ADMIN');
  const canManage = hasRole(user, 'TEACHER', 'ADMIN', 'SUPER_ADMIN');
  const canTakeAttendance = hasRole(
    user,
    'TEACHER',
    'ADMIN',
    'SUPER_ADMIN',
    'SUPPORT_STAFF',
    'STUDENT_ADMIN',
  );
  const requiresAssignment = sessions.some(
    (session) => session.sessionType === 'TEACHER_ASSIGNED',
  );
  const canRegister =
    isStudent && !viewer.assigned && !viewer.registered && !requiresAssignment;
  const fridayDate = calendarDate(friday.date);
  const pathwayName = (pathway: string) =>
    PATHWAY_OPTIONS.find((option) => option.value === pathway)?.label ??
    pathway.replaceAll('_', ' ');
  const audience = [
    workshop.targetGrades?.length
      ? `Grades ${workshop.targetGrades.join(', ')}`
      : '',
    workshop.targetMajorPathways?.length
      ? `Major: ${workshop.targetMajorPathways.map(pathwayName).join(', ')}`
      : '',
    workshop.targetMinorPathways?.length
      ? `Minor: ${workshop.targetMinorPathways.map(pathwayName).join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const updateRegistration = async () => {
    if (pending) return;
    setPending(true);
    setActionError(null);
    try {
      if (viewer.registered) await unregister({ workshopId: workshop._id });
      else await register({ workshopId: workshop._id });
      toast({
        title: viewer.registered
          ? 'Registration removed'
          : 'Registered for workshop',
      });
    } catch (error) {
      setActionError(registrationErrorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <WorkshopFrame>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" leadingIcon={ArrowLeft}>
          <Link href={scheduleHref}>Friday schedule</Link>
        </Button>
        {viewer.registered || viewer.assigned ? (
          <Button asChild variant="tertiary" leadingIcon={Ticket}>
            <Link href={`/flex-friday/pass?fridayId=${friday._id}`}>
              My pass
            </Link>
          </Button>
        ) : null}
      </div>

      <CardGroup border="outlined">
        <Card>
          <CardHeader className="gap-3">
            <h1 className="break-words text-xl font-semibold leading-snug text-foreground sm:text-2xl">
              {workshop.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              <time dateTime={format(fridayDate, 'yyyy-MM-dd')}>
                {format(fridayDate, 'EEEE, MMMM d, yyyy')}
              </time>
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
              {workshop.description || 'No description provided.'}
            </p>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-muted-foreground">Teacher</dt>
                <dd className="break-words text-foreground">
                  {displayName(teacher) || 'Teacher unavailable'}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">Location</dt>
                <dd className="break-words text-foreground">
                  {workshop.location || 'Not provided'}
                </dd>
              </div>
              {workshop.capacity !== undefined ? (
                <div>
                  <dt className="text-muted-foreground">Capacity</dt>
                  <dd className="text-foreground">
                    {workshop.capacity} students
                  </dd>
                </div>
              ) : null}
              {audience ? (
                <div className="min-w-0 sm:col-span-2">
                  <dt className="text-muted-foreground">Intended audience</dt>
                  <dd className="break-words text-foreground">{audience}</dd>
                </div>
              ) : null}
            </dl>
            <div className="flex flex-col gap-2">
              <div role="status" className="flex flex-wrap items-center gap-2">
                {viewer.registered ? (
                  <Badge color="green">You’re registered</Badge>
                ) : null}
                {viewer.assigned ? (
                  <Badge color="amber">You’re assigned</Badge>
                ) : null}
                {viewer.teaching ? <Badge>You’re teaching</Badge> : null}
                {isStudent && !viewer.registered && !viewer.assigned ? (
                  <span className="text-sm text-muted-foreground">
                    You haven’t joined this workshop.
                  </span>
                ) : null}
              </div>
              {viewer.assigned ? (
                <p className="text-sm text-muted-foreground">
                  Your teacher manages this assignment. Contact them if you need
                  to change workshops.
                </p>
              ) : null}
              {isStudent &&
              !viewer.registered &&
              !viewer.assigned &&
              requiresAssignment ? (
                <p className="text-sm text-muted-foreground">
                  This workshop includes a teacher-assigned session. Ask your
                  teacher about joining.
                </p>
              ) : null}
              {isStudent && sessions.length > 1 && !viewer.assigned ? (
                <p className="text-sm text-muted-foreground">
                  Registration covers all {sessions.length} sessions below.
                </p>
              ) : null}
              {actionError ? (
                <p
                  role="alert"
                  className="whitespace-pre-wrap break-words text-sm text-destructive"
                >
                  {actionError}
                </p>
              ) : null}
            </div>
          </CardContent>
          {viewer.registered ||
          canRegister ||
          canManage ||
          canTakeAttendance ? (
            <CardFooter className="flex-wrap gap-2">
              {viewer.registered || canRegister ? (
                <Button
                  variant={viewer.registered ? 'tertiary' : 'primary'}
                  loading={pending}
                  onClick={() => void updateRegistration()}
                >
                  {viewer.registered ? 'Unregister' : 'Register for workshop'}
                </Button>
              ) : null}
              {canTakeAttendance ? (
                <Button asChild variant="secondary" leadingIcon={ClipboardList}>
                  <Link href={`/flex-friday?${rosterParams}`}>Open roster</Link>
                </Button>
              ) : null}
              {canManage ? (
                <Button asChild variant="tertiary">
                  <Link href={scheduleHref}>Manage in Friday schedule</Link>
                </Button>
              ) : null}
            </CardFooter>
          ) : null}
        </Card>
      </CardGroup>

      <section
        aria-labelledby="workshop-sessions-heading"
        className="flex flex-col gap-3"
      >
        <h2
          id="workshop-sessions-heading"
          className="text-lg font-semibold text-foreground"
        >
          Sessions{' '}
          <span className="font-normal text-muted-foreground">
            ({sessions.length})
          </span>
        </h2>
        <p className="text-sm text-muted-foreground">
          All times are at Innovation Academy ({detail.timeZone}).
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Session</TableHead>
              <TableHead scope="col" className="text-right">
                Time
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session, index) => (
              <TableRow key={session._id} index={index}>
                <TableCell className="align-top">
                  <Link
                    href={`/flex-friday?${new URLSearchParams({ friday: friday._id, session: session._id, view: 'schedule' })}`}
                    className="inline-flex min-h-8 items-center break-words text-foreground underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-ring pointer-coarse:min-h-11"
                  >
                    {session.title}
                  </Link>
                  <p>
                    {session.sessionType === 'TEACHER_ASSIGNED'
                      ? 'Teacher assigned'
                      : 'Student choice'}
                  </p>
                  {session.description ? (
                    <p className="whitespace-pre-wrap break-words">
                      {session.description}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right align-top tabular-nums">
                  <time
                    className="block"
                    dateTime={new Date(session.startAt).toISOString()}
                  >
                    {formatSchoolTime(session.startTime, user?.use24HourTime)}
                  </time>
                  <span aria-hidden>– </span>
                  <span className="sr-only">to </span>
                  <time dateTime={new Date(session.endAt).toISOString()}>
                    {formatSchoolTime(session.endTime, user?.use24HourTime)}
                  </time>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </WorkshopFrame>
  );
}
