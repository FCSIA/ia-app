import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History } from 'lucide-react';
import { format } from 'date-fns';
import { auditActionLabel, auditPersonName, type SearchableAuditEvent } from '~/apps/shared/audit';

interface Props {
  auditEvents: SearchableAuditEvent[];
  isLoading: boolean;
}

const auditActionClass = (action: string): 'emerald' | 'blue' | 'rose' | 'gray' => {
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
              <div key={event.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge variant="solid" color={auditActionClass(event.action)} className="text-[10px] uppercase">
                    {auditActionLabel(event.action)}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">{auditPersonName(event)}</p>
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
