import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, MapPin, Users, Ticket, CheckCircle } from 'lucide-react';
import { formatTimeRange } from '../_utils';
import { cn } from '@/lib/utils';

interface Props {
  workshops: any[];
  selectedSession: any;
  onAddWorkshop: () => void;
  onEditWorkshop: (workshop: any) => void;
  onDeleteWorkshop: (workshop: any) => void;
  onRegister: (workshopId: string) => void;
  onUnregister: (workshopId: string) => void;
  onAttendance: (workshopId: string) => void;
  canManage: boolean;
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
  canManage,
  isStudent,
  search,
  onSearchChange,
  myRegWorkshopIds,
  actionPending,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">Workshops</h2>
          {selectedSession && (
            <Badge variant="solid" color="indigo" size="sm">
              {selectedSession.title}
            </Badge>
          )}
        </div>
        {canManage && (
          <Button 
            size="sm" 
            onClick={onAddWorkshop} 
            disabled={!selectedSession}
            variant="tertiary"
            title={!selectedSession ? "Select a session first" : "Add Workshop"}
            className="h-8 gap-1"
          >
            <Plus size={14} className="stroke-[2.5]" /> Add Workshop
          </Button>
        )}
      </div>

      {!selectedSession ? (
        <div className="h-48 flex items-center justify-center p-8 rounded-2xl border-2 border-dashed border-foreground/5 bg-foreground/[0.01]">
          <p className="text-muted-foreground text-sm font-medium">Select a session to view or add workshops</p>
        </div>
      ) : (
        <>
          <SearchInput
            value={search}
            onValueChange={onSearchChange}
            placeholder="Search workshops..."
          />

          <div className="grid gap-4">
            {workshops.length === 0 ? (
              <div className="h-32 rounded-xl border-2 border-dashed border-foreground/5 flex items-center justify-center bg-foreground/[0.01]">
                <p className="text-muted-foreground text-sm font-medium">No workshops found in this session</p>
              </div>
            ) : (
              workshops.map((w) => {
                const isRegistered = myRegWorkshopIds.has(w._id);
                const isFull = w.capacity && w._count?.registrations >= w.capacity;
                const linkedSessions = w.linkedSessions || [];
                const spansMultiple = linkedSessions.length > 1;

                return (
                  <Card key={w._id} className="overflow-hidden border-foreground/5 bg-background hover:shadow-lg transition-all duration-300 rounded-2xl group">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="font-bold text-foreground text-lg leading-tight group-hover:text-accent-600 transition-colors">
                              {w.title}
                            </h3>
                            {spansMultiple && (
                              <Badge variant="solid" color="indigo" className="text-[10px] leading-tight py-0">
                                Spans {linkedSessions.length} sessions
                              </Badge>
                            )}
                          </div>
                          
                          {w.description && (
                            <p className="text-sm text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
                              {w.description}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-4 text-xs font-semibold">
                            {w.location && (
                              <span className="flex items-center gap-1.5 text-muted-foreground bg-foreground/[0.03] px-2 py-1 rounded-md">
                                <MapPin size={12} className="text-accent-500" />
                                {w.location}
                              </span>
                            )}
                            <span className={cn(
                              "flex items-center gap-1.5 px-2 py-1 rounded-md",
                              isFull ? "text-red-600 bg-red-500/5" : "text-muted-foreground bg-foreground/[0.03]"
                            )}>
                              <Users size={12} className={cn(isFull ? "text-red-500" : "text-accent-500")} />
                              {w._count?.registrations}{w.capacity ? `/${w.capacity}` : ''} registered
                            </span>
                          </div>

                          {spansMultiple && (
                            <div className="mt-4 flex flex-wrap gap-1.5 border-t pt-3 border-foreground/5">
                              {linkedSessions.map((ls: any) => (
                                <Badge key={ls._id} variant="solid" color="gray" className="text-[9px] uppercase tracking-tighter py-0 px-1.5 font-bold">
                                  {ls.title} · {formatTimeRange(ls.startTime, ls.endTime)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2">
                          {isStudent && (
                            <Button
                              size="sm"
                              variant={isRegistered ? 'tertiary' : 'primary'}
                              className={cn(
                                "h-9 px-4 font-bold rounded-xl transition-all",
                                isRegistered 
                                  ? "border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/5" 
                                  : "bg-accent-600 hover:bg-accent-700 shadow-sm shadow-accent-500/20"
                              )}
                              disabled={(!isRegistered && isFull) || actionPending != null}
                              onClick={() => isRegistered ? onUnregister(w._id) : onRegister(w._id)}
                            >
                              {isRegistered ? (
                                <><CheckCircle size={14} className="mr-1.5" /> Registered</>
                              ) : (
                                <><Ticket size={14} className="mr-1.5" /> Register</>
                              )}
                            </Button>
                          )}

                          {canManage && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="tertiary"
                                className="h-9 px-3 font-bold rounded-xl border-foreground/10 hover:bg-foreground/5"
                                onClick={() => onAttendance(w._id)}
                              >
                                Roster
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className="h-9 w-9 rounded-xl hover:bg-foreground/5"
                                onClick={() => onEditWorkshop(w)}
                              >
                                <Pencil size={14} className="text-muted-foreground" />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className="h-9 w-9 rounded-xl hover:bg-red-500/10 hover:text-red-600"
                                onClick={() => onDeleteWorkshop(w)}
                              >
                                <Trash2 size={14} />
                              </Button>
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
    </div>
  );
}
