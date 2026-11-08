'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useBugTagPreferences, type BugTagPreferences } from '@/components/recognition/bug-tag-preferences';
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
  const { preferences, save, available: local } = useBugTagPreferences(user?._id);
  const [saveError, setSaveError] = useState(false);
  function savePreferences(next: BugTagPreferences) { setSaveError(!save(next)); }
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
          {count >= 5 && count < 20 ? (
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
            </div>
          ) : null}
          {local && count >= 20 ? (
            <div className="space-y-3">
              <p>Customize your tag background. These choices are saved in this browser only.</p>
              <div className="flex flex-wrap gap-3">
                {preferences.colors.map((color, index) => <label key={['first', 'second', 'third'][index]} className="flex items-center gap-2">Color {index + 1}<Input className="w-14" type="color" aria-label={`Bug tag color ${index + 1}`} value={color} onChange={(event) => {
                  const colors = [...preferences.colors] as BugTagPreferences['colors'];
                  colors[index] = event.target.value;
                  savePreferences({ ...preferences, colors });
                }} /></label>)}
              </div>
              {count >= 50 ? <div className="space-y-1.5">
                <label htmlFor="bug-tag-animation">Animation style</label>
                <Select value={preferences.animation} onValueChange={(animation) => savePreferences({ ...preferences, animation: animation as BugTagPreferences['animation'] })}>
                  <SelectTrigger id="bug-tag-animation" />
                  <SelectContent>{(['drift', 'shimmer', 'breathe', 'none'] as const).map((value, index) => <SelectItem key={value} index={index} value={value}>{({ drift: 'Color drift', shimmer: 'Shimmer', breathe: 'Soft pulse', none: 'Still' })[value]}</SelectItem>)}</SelectContent>
                </Select>
              </div> : null}
              {saveError ? <p role="alert">Your browser could not save this preference. Check that browser storage is available.</p> : null}
            </div>
          ) : null}
        </div>
        </CardContent>
      </Card>
    </div>
  );
}
