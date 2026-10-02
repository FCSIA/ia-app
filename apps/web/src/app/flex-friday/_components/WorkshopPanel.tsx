import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, MapPin, Users, Ticket, CheckCircle } from 'lucide-react';
import { formatTimeRange } from '../_utils';
import { cn } from '@/lib/utils';
import { CARD_SURFACE_FOREGROUND } from '@/lib/surface-classes';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

interface Props {
  workshops: any[];
  selectedSession: any;
  onAddWorkshop: () => void;
  onEditWorkshop: (workshop: any) => void;
  onDeleteWorkshop: (workshop: any) => void;
  onRegister: (workshopId: string) => void;
  onUnregister: (workshopId: string) => void;
  onAttendance: (workshopId: string) => void;
  canManageWorkshops: boolean;
  canManageAttendance: boolean;
  isStudent: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  myRegWorkshopIds: Set<string>;
  actionPending: string | null;
}

export function WorkshopPanel({
  workshops,
  selectedSession,
  onAddWorkshop,
  onEditWorkshop,
  onDeleteWorkshop,
  onRegister,
  onUnregister,
  onAttendance,
  canManageWorkshops,
  canManageAttendance,
  isStudent,
  search,
  onSearchChange,
  myRegWorkshopIds,
  actionPending,
}: Props) {
  return (
    <section className={`flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-3 ${CARD_SURFACE_FOREGROUND}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">Workshops</h2>
          {selectedSession && (
            <Badge variant="solid" color="indigo" size="sm">
              {selectedSession.title}
            </Badge>
          )}
        </div>
        {canManageWorkshops && (
          <Button
            size="sm"
            leadingIcon={Plus}
            onClick={onAddWorkshop}
            disabled={!selectedSession}
            variant="tertiary"
            title={!selectedSession ? 'Select a session first' : 'Add workshop'}
          >
            Add workshop
          </Button>
        )}
      </div>

      {!selectedSession ? (
        <Empty className="border border-border/60 py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Ticket /></EmptyMedia>
            <EmptyTitle>Select a session</EmptyTitle>
            <EmptyDescription>Choose a session to view its workshops.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <SearchInput
            value={search}
            onValueChange={onSearchChange}
            placeholder="Search workshops"
          />

          <div className="grid gap-3">
            {workshops.length === 0 ? (
              <Empty className="border border-border/60 py-8">
                <EmptyHeader>
                  <EmptyTitle>No workshops found</EmptyTitle>
                  <EmptyDescription>Try a different search or add a workshop.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              workshops.map((w) => {
                const isRegistered = myRegWorkshopIds.has(w._id);
                const isFull = !!w.capacity && w._count?.registrations >= w.capacity;
                const linkedSessions = w.linkedSessions || [];
                const spansMultiple = linkedSessions.length > 1;

                return (
                  <Card key={w._id} className="overflow-hidden border-border/60 bg-background transition-shadow hover:shadow-surface-1">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold leading-tight text-foreground">
                              {w.title}
                            </h3>
                            {spansMultiple && (
                              <Badge variant="solid" color="indigo" className="text-[10px] leading-tight py-0">
                                Spans {linkedSessions.length} sessions
                              </Badge>
                            )}
                          </div>
                          
                          {w.description && (
                            <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                              {w.description}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
                            {w.location && (
                              <span className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
                                <MapPin className="size-3.5" />
                                {w.location}
                              </span>
                            )}
                            <span className={cn(
                              'flex items-center gap-1.5 rounded-md bg-muted px-2 py-1',
                              isFull && 'text-destructive',
                            )}>
                              <Users className="size-3.5" />
                              {w._count?.registrations}{w.capacity ? `/${w.capacity}` : ''} registered
                            </span>
                          </div>

                          {spansMultiple && (
                            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
                              {linkedSessions.map((ls: any) => (
                                <Badge key={ls._id} variant="solid" color="gray" className="text-[9px] uppercase tracking-tighter py-0 px-1.5 font-bold">
                                  {ls.title} · {formatTimeRange(ls.startTime, ls.endTime)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
                          {isStudent && (
                            <Button
                              size="sm"
                              variant={isRegistered ? 'tertiary' : 'primary'}
                              leadingIcon={isRegistered ? CheckCircle : Ticket}
                              loading={actionPending != null}
                              disabled={(!isRegistered && isFull) || actionPending != null}
                              onClick={() => isRegistered ? onUnregister(w._id) : onRegister(w._id)}
                            >
                              {isRegistered ? 'Registered' : 'Register'}
                            </Button>
                          )}

                          {(canManageWorkshops || canManageAttendance) && (
                            <div className="flex items-center gap-1">
                              {canManageAttendance && (
                                <Button
                                  size="sm"
                                  variant="tertiary"
                                  onClick={() => onAttendance(w._id)}
                                >
                                  Roster
                                </Button>
                              )}
                              {canManageWorkshops && (
                                <>
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    aria-label={`Edit ${w.title}`}
                                    onClick={() => onEditWorkshop(w)}
                                  >
                                    <Pencil />
                                  </Button>
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    className="text-destructive hover:bg-destructive/10"
                                    aria-label={`Delete ${w.title}`}
                                    onClick={() => onDeleteWorkshop(w)}
                                  >
                                    <Trash2 />
                                  </Button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </>
      )}
    </section>
  );
}
