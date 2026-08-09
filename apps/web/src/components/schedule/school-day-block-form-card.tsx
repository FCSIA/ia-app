'use client';

import { useMemo, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
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
  const [label, setLabel] = useState<string>(block?.periodNumber ? '' : (block?.label ?? ''));
  const [startTime, setStartTime] = useState<string>(block?.startTime ?? '08:10');
  const [endTime, setEndTime] = useState<string>(block?.endTime ?? '08:55');
  const [previousBlock, setPreviousBlock] = useState<SchoolDayBlock | undefined>(block);

  if (previousBlock !== block) {
    setPreviousBlock(block);
    setKind(block?.periodNumber ? 'PERIOD' : 'CUSTOM');
    setPeriodNumber(block?.periodNumber?.toString() ?? '1');
    setLabel(block?.periodNumber ? '' : (block?.label ?? ''));
    setStartTime(block?.startTime ?? '08:10');
    setEndTime(block?.endTime ?? '08:55');
  }

  const durationMinutes = useMemo(() => {
    const value = parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }, [endTime, startTime]);

  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-5 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {onCancel ? (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={onCancel}>
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Block type</Label>
          <Select value={kind} onValueChange={(value) => setKind(value as 'PERIOD' | 'CUSTOM')}>
            <SelectTrigger placeholder="" />
            <SelectContent>
              <SelectItem index={0} value="PERIOD">
                Period block
              </SelectItem>
              <SelectItem index={1} value="CUSTOM">
                Custom block
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {kind === 'PERIOD' ? (
          <div className="space-y-1.5">
            <Label className="text-xs">Period</Label>
            <Select value={periodNumber} onValueChange={setPeriodNumber}>
              <SelectTrigger placeholder="" />
              <SelectContent>
                {Array.from({ length: 8 }, (_, index) => (
                  <SelectItem index={index} key={index + 1} value={(index + 1).toString()}>
                    Period {index + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-xs">Custom label</Label>
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="h-9"
              placeholder="Assembly, advisory, lunch..."
            />
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Start time</Label>
          <Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">End time</Label>
          <Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Duration (min)</Label>
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
            className="h-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          size="sm"
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
          {submitIcon === 'plus' ? <Plus className="mr-1.5 size-3.5" /> : <Save className="mr-1.5 size-3.5" />}
          {submitLabel}
        </Button>
        {onDelete ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={isDeleting}
            onClick={onDelete}
          >
            <Trash2 className="mr-1.5 size-3.5" />
            Delete
          </Button>
        ) : null}
      </div>
    </div>
  );
}
