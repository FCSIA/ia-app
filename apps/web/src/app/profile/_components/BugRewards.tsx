'use client';

import { Bug } from 'lucide-react';
import { useMutation } from '@/lib/convex-react';
import { useToast } from '@/hooks/use-toast';
import { BugHunterTag } from '@/components/recognition/bug-hunter-tag';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { api } from '~/apps/convex/src/_generated/api';
import type { AppUser } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const COLORS = ['amber', 'blue', 'emerald', 'pink', 'purple', 'red'] as const;
const MILESTONES = [
  { count: 1, label: 'First confirmed bug' },
  { count: 5, label: 'Tag color unlocked' },
  { count: 20, label: 'Multicolored tag' },
  { count: 50, label: 'Animated tag' },
] as const;

export function BugRewards({ user }: { user: AppUser | null }) {
  const setColor = useMutation(api.moderation.bugRewards.setColor);
  const { toast } = useToast();
  const count = user?.approvedBugCount ?? 0;
  if (!user) return null;

  return (
    <div className="mt-5">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Bug className="size-4" />Bug Hunter</CardTitle><CardDescription>{count} developer-approved {count === 1 ? 'bug' : 'bugs'}</CardDescription></CardHeader>
        <CardContent>
        <div className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>Rewards unlock at 1 bug (regular tag), 5 (choose a color), 20 (multicolored), and 50 (animated).</p>
          {count > 0 ? <BugHunterTag user={user} /> : <p>Report a bug from Share feedback. A developer must confirm it before it counts.</p>}
          {count > 0 ? (
            <div>
              <p className="mb-2 font-medium text-foreground">Earned milestones</p>
              <div className="flex flex-wrap gap-2">
                {MILESTONES.filter((milestone) => count >= milestone.count).map((milestone) => (
                  <Badge key={milestone.count} size="sm" color="amber">{milestone.label}</Badge>
                ))}
              </div>
            </div>
          ) : null}
          {count >= 5 ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bug-tag-color" className="font-medium text-foreground">Your tag color</label>
              <Select value={user.bugTagColor ?? 'amber'} onValueChange={(value) => {
                void setColor({ color: value as typeof COLORS[number] }).catch((error: unknown) =>
                  toast({ title: error instanceof Error ? error.message : 'Could not save color', variant: 'destructive' }));
              }}>
                <SelectTrigger id="bug-tag-color" placeholder="Choose a color" />
                <SelectContent>
                  {COLORS.map((color, index) => <SelectItem key={color} value={color} index={index}>{color[0].toUpperCase() + color.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
              {count >= 20 ? <p>Your multicolored tag is active; your chosen color is saved if the tag style changes later.</p> : null}
            </div>
          ) : null}
        </div>
        </CardContent>
      </Card>
    </div>
  );
}
