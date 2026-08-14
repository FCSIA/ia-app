import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { formatTimeRange } from '../_utils';
import { Card, CardAction, CardGroup } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';

interface Props {
  sessions: any[];
  selectedSession: any;
  onSelectSession: (session: any) => void;
  onAddSession: () => void;
  onEditSession: (session: any) => void;
  onDeleteSession: (session: any) => void;
  canCreate: boolean;
  canManage: boolean;
  search: string;
  onSearchChange: (value: string) => void;
}

export function SessionPanel({
  sessions,
  selectedSession,
  onSelectSession,
  onAddSession,
  onEditSession,
  onDeleteSession,
  canCreate,
  canManage,
  search,
  onSearchChange,
}: Props) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Sessions</h2>
        {canCreate && (
          <Button size="sm" leadingIcon={Plus} onClick={onAddSession} variant="tertiary">
            Add session
          </Button>
        )}
      </div>

      <SearchInput
        value={search}
        onValueChange={onSearchChange}
        placeholder="Search sessions"
      />

      <div>
        {sessions.length === 0 ? (
          <Empty className="border border-border/60 py-8">
            <EmptyHeader>
              <EmptyTitle>No sessions found</EmptyTitle>
              <EmptyDescription>Try a different search or add a session.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <CardGroup orientation="inline" border="outlined">
            {sessions.map((s) => (
              <Card
                key={s._id}
                onClick={() => onSelectSession(s)}
                label={`Select ${s.title}`}
                selected={selectedSession?._id === s._id}
                className="min-h-16 gap-2 px-3 py-2"
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="font-medium text-sm text-foreground truncate">
                        {s.title}
                      </h3>
                      <Badge variant="solid" color={s.sessionType === 'TEACHER_ASSIGNED' ? 'amber' : 'emerald'} className="text-[10px]">
                        {s.sessionType === 'TEACHER_ASSIGNED' ? 'Assigned' : 'Choice'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatTimeRange(s.startTime, s.endTime)}
                    </p>
                  </div>

                  {canManage && (
                    <CardAction className="flex items-center gap-0.5">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Edit ${s.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditSession(s);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        aria-label={`Delete ${s.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(s);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </CardAction>
                  )}
                </div>
              </Card>
            ))}
          </CardGroup>
        )}
      </div>
    </section>
  );
}
