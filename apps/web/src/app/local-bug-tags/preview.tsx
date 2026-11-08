'use client';

import { useState } from 'react';
import { BugHunterTag } from '@/components/recognition/bug-hunter-tag';
import type { BugTagPreferences } from '@/components/recognition/bug-tag-preferences';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const TIERS = [0, 1, 5, 20, 50] as const;

export function BugTagPreview() {
  const [approved, setApproved] = useState(0);
  const [pending, setPending] = useState(false);
  const [purple, setPurple] = useState(false);
  const [colors, setColors] = useState(['#78b8b0', '#b29acb', '#c5ae79']);
  const [animation, setAnimation] = useState('drift');
  const [message, setMessage] = useState('Load a tier or submit a sample report.');

  function load(count: number) {
    setApproved(count);
    setPending(false);
    setPurple(false);
    setMessage(`Loaded ${count} approved sample bugs.`);
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Local bug tag preview</h1>
        <p className="text-sm text-muted-foreground">Sample data only. Approvals here are simulated and do not change real accounts or feedback. Reloading resets the preview.</p>
      </header>
      <section aria-label="Sample profile" className="space-y-3 border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Demo Student</span>
          <BugHunterTag user={{ approvedBugCount: approved, bugTagColor: purple ? 'purple' : null }} preferences={{ colors: colors as [string, string, string], animation: animation as BugTagPreferences['animation'] }} />
        </div>
        <p>{approved} approved sample bugs · {pending ? '1 pending' : '0 pending'}</p>
        {approved === 0 ? <p className="text-sm text-muted-foreground">No tag until the first approval.</p> : null}
      </section>
      <section aria-label="Load reward tiers" className="space-y-3">
        <h2 className="font-semibold">Preview each reward</h2>
        <div className="flex flex-wrap gap-2">
          {TIERS.map((count) => <Button key={count} variant="secondary" onClick={() => load(count)}>Load {count} approved</Button>)}
        </div>
        <Button variant="secondary" disabled={approved < 5 || approved >= 20} onClick={() => { setPurple((value) => !value); setMessage('Sample tag color changed.'); }}>Preview {purple ? 'default' : 'purple'} color</Button>
      </section>
      <section aria-label="Customize your reward" className="space-y-3">
        <h2 className="font-semibold">Customize your tag</h2>
        <p className="text-sm text-muted-foreground">Choose three background colors at 20 approved bugs. At 50, choose an animation. The tag text stays a solid, readable color.</p>
        <fieldset disabled={approved < 20} className="flex flex-wrap gap-4 disabled:opacity-50">
          <legend className="sr-only">Tag background colors</legend>
          {colors.map((color, index) => (
            <label key={['first', 'second', 'third'][index]} className="flex items-center gap-2 text-sm">
              Color {index + 1}
              <Input type="color" aria-label={`Tag color ${index + 1}`} value={color} className="w-14" onChange={(event) => {
                const value = event.target.value;
                setColors((current) => current.map((item, position) => position === index ? value : item));
                setMessage('Sample background colors updated.');
              }} />
            </label>
          ))}
        </fieldset>
        <label htmlFor="tag-animation" className="block text-sm">Animation style</label>
        <Select value={animation} onValueChange={setAnimation} disabled={approved < 50}>
          <SelectTrigger id="tag-animation" aria-label="Animation style" />
          <SelectContent>
            <SelectItem index={0} value="drift">Color drift</SelectItem>
            <SelectItem index={1} value="shimmer">Shimmer</SelectItem>
            <SelectItem index={2} value="breathe">Soft pulse</SelectItem>
            <SelectItem index={3} value="none">Still</SelectItem>
          </SelectContent>
        </Select>
      </section>
      <section aria-label="Simulate report approval" className="space-y-3">
        <h2 className="font-semibold">Try the approval step</h2>
        <div className="flex flex-wrap gap-2">
          {[0, 4, 19, 49].map((count) => <Button key={count} variant="secondary" onClick={() => load(count)}>Start at {count}</Button>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={pending} onClick={() => { setPending(true); setMessage('Sample report submitted. The approved count and tag have not changed.'); }}>Submit sample report</Button>
          <Button disabled={!pending} onClick={() => { if (!pending) return; setApproved((value) => value + 1); setPending(false); setMessage('Sample developer approval applied. This report cannot be approved again.'); }}>Approve sample report</Button>
          <Button variant="secondary" disabled={!pending} onClick={() => { setPending(false); setMessage('Sample report dismissed. No reward was added.'); }}>Dismiss sample report</Button>
        </div>
      </section>
      <p role="status" className="text-sm text-muted-foreground">{message}</p>
    </main>
  );
}
