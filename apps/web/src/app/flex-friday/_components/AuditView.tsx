import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Props {
  auditEvents: any[];
  isLoading: boolean;
}

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
  if (action.endsWith('_CREATED') || action.endsWith('_SCHEDULED')) return 'emerald';
  if (action.endsWith('_UPDATED')) return 'blue';
  if (action.endsWith('_DELETED') || action.endsWith('_REMOVED')) return 'rose';
  return 'gray';
};

export function AuditView({ auditEvents, isLoading }: Props) {
  return (
    <Card className="rounded-xl shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <History size={16} /> Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading activity...</div>
        ) : auditEvents.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No recent activity</div>
        ) : (
          <div className="divide-y divide-border">
            {auditEvents.map((event) => (
              <div key={event._id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge variant="solid" color={auditActionClass(event.action) as any} className="text-[10px] uppercase">
                    {AUDIT_ACTION_LABELS[event.action] || event.action.replace(/_/g, ' ')}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">{event.actorName || 'System'}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(event.createdAt), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
