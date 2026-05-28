import React from 'react';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { formatTimeRange } from '../_utils';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  sessions: any[];
  selectedSession: any;
  onSelectSession: (session: any) => void;
  onAddSession: () => void;
  onEditSession: (session: any) => void;
  onDeleteSession: (session: any) => void;
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
  canManage,
  search,
  onSearchChange,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Sessions</h2>
        {canManage && (
          <Button size="sm" onClick={onAddSession} variant="tertiary" className="h-8 gap-1">
            <Plus size={14} /> Add Session
          </Button>
        )}
      </div>

      <SearchInput
        value={search}
        onValueChange={onSearchChange}
        placeholder="Search sessions..."
      />

      <div className="space-y-2">
        {sessions.length === 0 ? (
          <Card className="border-dashed py-8 text-center bg-muted/20">
            <p className="text-muted-foreground text-sm">No sessions found</p>
          </Card>
        ) : (
          sessions.map((s) => (
            <Card
              key={s._id}
              onClick={() => onSelectSession(s)}
              className={cn(
                'cursor-pointer transition-colors',
                selectedSession?._id === s._id
                  ? 'border-primary ring-1 ring-primary bg-primary/5'
                  : 'hover:bg-muted/50'
              )}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-sm text-foreground truncate">
                        {s.title}
                      </h3>
                      <Badge variant="dot" color={s.sessionType === 'TEACHER_ASSIGNED' ? 'amber' : 'emerald'} className="text-[10px]">
                        {s.sessionType === 'TEACHER_ASSIGNED' ? 'Assigned' : 'Choice'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatTimeRange(s.startTime, s.endTime)}
                    </p>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-0.5">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditSession(s);
                        }}
                      >
                        <Pencil size={12} />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-red-500 hover:bg-red-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(s);
                        }}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
