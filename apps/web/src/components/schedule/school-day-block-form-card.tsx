'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { parseTimeToMinutes } from './schedule-utils';
import { SchoolDayBlock, SchoolDayBlockPayload, ScheduleWeekday } from './types';

type SchoolDayBlockFormCardProps = {
  weekday: ScheduleWeekday;
  block?: SchoolDayBlock;
  title: string;
  description?: string;
  submitLabel: string;
  submitIcon?: 'plus' | 'save';
  onSubmit: (payload: SchoolDayBlockPayload) => void;
  onDelete?: () => void;
  onCancel?: () => void;
  isPending?: boolean;
  isDeleting?: boolean;
};

function addMinutes(time: string, durationMinutes: number) {
  const next = parseTimeToMinutes(time) + durationMinutes;
  const hours = Math.floor(next / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (next % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function SchoolDayBlockFormCard({
  weekday,
  block,
  title,
  description,
  submitLabel,
  submitIcon = 'save',
  onSubmit,
  onDelete,
  onCancel,
  isPending,
  isDeleting,
}: SchoolDayBlockFormCardProps) {
  const [kind, setKind] = useState<'PERIOD' | 'CUSTOM'>(block?.periodNumber ? 'PERIOD' : 'CUSTOM');
  const [periodNumber, setPeriodNumber] = useState<string>(block?.periodNumber?.toString() ?? '1');
  const [label, setLabel] = useState<string>(block?.periodNumber ? '' : block?.label ?? '');
  const [startTime, setStartTime] = useState<string>(block?.startTime ?? '08:10');
  const [endTime, setEndTime] = useState<string>(block?.endTime ?? '08:55');

  useEffect(() => {
    setKind(block?.periodNumber ? 'PERIOD' : 'CUSTOM');
    setPeriodNumber(block?.periodNumber?.toString() ?? '1');
    setLabel(block?.periodNumber ? '' : block?.label ?? '');
    setStartTime(block?.startTime ?? '08:10');
    setEndTime(block?.endTime ?? '08:55');
  }, [block]);

  const durationMinutes = useMemo(() => {
    const value = parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }, [endTime, startTime]);

  return (
    <Card className="rounded-3xl border-border/70 bg-background/90">
      <CardHeader className="space-y-2 pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Block type</Label>
            <Select value={kind} onValueChange={(value) => setKind(value as 'PERIOD' | 'CUSTOM')}>
              <SelectTrigger className="rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERIOD">Period block</SelectItem>
                <SelectItem value="CUSTOM">Custom block</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {kind === 'PERIOD' ? (
            <div className="space-y-2">
              <Label>Period</Label>
              <Select value={periodNumber} onValueChange={setPeriodNumber}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 8 }, (_, index) => (
                    <SelectItem key={index + 1} value={(index + 1).toString()}>
                      Period {index + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Custom label</Label>
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                className="rounded-2xl"
                placeholder="Assembly, advisory, lunch..."
              />
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Start time</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label>End time</Label>
            <Input
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Duration</Label>
            <Input
              type="number"
              min={1}
              value={durationMinutes || ''}
              onChange={(event) => {
                const nextDuration = Number.parseInt(event.target.value, 10);
                if (Number.isInteger(nextDuration) && nextDuration > 0) {
                  setEndTime(addMinutes(startTime, nextDuration));
                }
              }}
              className="rounded-2xl"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
          {kind === 'PERIOD'
            ? `Students will see their Period ${periodNumber} class during this block.`
            : `Students will see "${label || 'this custom block'}" instead of a class during this time.`}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            className="rounded-2xl"
            disabled={isPending}
            onClick={() =>
              onSubmit({
                weekday,
                kind,
                periodNumber: kind === 'PERIOD' ? Number.parseInt(periodNumber, 10) : undefined,
                label: kind === 'CUSTOM' ? label : undefined,
                startTime,
                endTime,
              })
            }
          >
            {submitIcon === 'plus' ? <Plus className="mr-2 size-4" /> : <Save className="mr-2 size-4" />}
            {submitLabel}
          </Button>
          {onDelete ? (
            <Button
              variant="outline"
              className="rounded-2xl text-destructive hover:text-destructive"
              disabled={isDeleting}
              onClick={onDelete}
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </Button>
          ) : null}
          {onCancel ? (
            <Button variant="outline" className="rounded-2xl" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
