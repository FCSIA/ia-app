'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useRecordQuestKey } from '@/hooks/use-founders-quest';
import { FOUNDERS } from '@/lib/founders-quest';

const OPEN_LANES = [1, 0, 2, 1, 0] as const;
const LANE_NAMES = ['Left', 'Center', 'Right'] as const;

export function FlightOfFive({ available = true }: { available?: boolean }) {
  const recordQuestKey = useRecordQuestKey();
  const [open, setOpen] = useState(false);
  const [gateIndex, setGateIndex] = useState(0);
  const [misses, setMisses] = useState(0);
  const [pending, setPending] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [message, setMessage] = useState('Choose an opening to fly through each gate.');

  const founder = FOUNDERS[gateIndex];
  const gapWidened = misses >= 3;
  const openLane = OPEN_LANES[gateIndex];

  async function fly(lane: number) {
    if (pending || cleared) return;
    const safeLane = lane === openLane || (gapWidened && Math.abs(lane - openLane) === 1);
    if (!safeLane) {
      setMisses((count) => count + 1);
      setMessage(misses + 1 >= 3 ? 'The gaps widened. Try again—there is no limit.' : 'Missed the opening. Try again.');
      return;
    }
    if (gateIndex < FOUNDERS.length - 1) {
      setGateIndex((index) => index + 1);
      setMessage('Gate cleared! Keep flying.');
      return;
    }
    setPending(true);
    try {
      const saved = await recordQuestKey('crystal');
      if (saved) {
        setCleared(true);
        setMessage('Crystal Key found: 3 of 3. Both halls are open.');
      }
    } finally { setPending(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next);
      if (next) {
        setGateIndex(0);
        setMisses(0);
        setCleared(false);
        setMessage('Choose an opening to fly through each gate.');
      }
    }}>
      {available ? <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Start Flight of the Five" title="A small traveler">
          <Flame className="size-4 text-primary" aria-hidden />
        </Button>
      </DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Flight of the Five</DialogTitle>
          <DialogDescription>Fly through five gates to find the Crystal Key. Misses are free, and the gaps widen after three.</DialogDescription>
        </DialogHeader>
        {cleared ? (
          <div className="space-y-4 py-3">
            <p className="text-sm font-medium" role="status">{message}</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm"><Link href="/hall-of-finders">Hall of Finders</Link></Button>
              <Button asChild size="sm" variant="secondary"><Link href="/hall-of-founders">Hall of Founders</Link></Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Gate {gateIndex + 1} of {FOUNDERS.length}</p>
              <p className="mt-2 text-lg font-semibold">{founder.name}</p>
              <p className="text-sm text-muted-foreground">Class of {founder.classYear}</p>
            </div>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Choose a flight opening">
              {LANE_NAMES.map((name, lane) => {
                const lit = gapWidened && (lane === openLane || Math.abs(lane - openLane) === 1);
                return (
                  <Button
                    key={name}
                    type="button"
                    size="sm"
                    variant={lit ? 'secondary' : 'ghost'}
                    className="min-h-16 flex-col"
                    aria-label={`Fly through ${name.toLowerCase()} opening${lit ? ', glowing' : ''}`}
                    disabled={pending}
                    onClick={() => void fly(lane)}
                  >
                    <Flame className={`size-4 ${lit ? 'text-primary' : 'text-muted-foreground'}`} aria-hidden />
                    {name}
                  </Button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground" role="status">{message}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
