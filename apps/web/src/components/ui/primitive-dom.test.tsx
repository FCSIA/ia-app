// @vitest-environment jsdom
import { act, StrictMode, Profiler } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { DatePicker, type DatePickerProps } from './date-picker';
import { FileThumbnail } from './file-thumbnail';
import { ActivityHeatmap } from './activity-heatmap';
import { Table, TableBody, TableCell, TableRow } from './table';

const hover = vi.hoisted(() => ({ setActive: undefined as undefined | ((index: number | null) => void) }));
vi.mock('@/hooks/use-fluid-hover', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/use-fluid-hover')>();
  return { ...actual, useFluidHover: (...args: Parameters<typeof actual.useFluidHover>) => {
    const result = actual.useFluidHover(...args);
    if (args[1]?.axis !== 'x') hover.setActive = result.setActiveIndex;
    return result;
  } };
});
vi.mock('./fluid-hover-highlight', () => ({ FluidHoverHighlight: () => null }));

let root: Root | undefined;
let container: HTMLDivElement;
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) });
  globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
});
afterEach(async () => {
  if (root) await act(() => root!.unmount());
  container?.remove();
  root = undefined;
  vi.restoreAllMocks();
});
async function mount(children: React.ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(() => root!.render(children));
}

describe('DatePicker native form behavior', () => {
  const cases: DatePickerProps[] = [
    { defaultValue: new Date(2026, 10, 6) },
    { mode: 'range', defaultValue: { from: new Date(2026, 10, 6), to: new Date(2026, 10, 7) } },
    { defaultValue: new Date(2026, 10, 6), defaultTime: '09:30' },
    { defaultValue: new Date(2026, 10, 6), defaultTimeRange: { start: '09:30', end: '10:30' } },
  ];
  test.each(cases)('serializes enabled values and excludes disabled fields: %j', async (props) => {
    await mount(<form><DatePicker {...props} name="meeting" /><DatePicker {...props} name="disabledMeeting" disabled /></form>);
    const data = new FormData(container.querySelector('form')!);
    expect(data.get('meeting')).toBeTruthy();
    expect(data.has('disabledMeeting')).toBe(false);
  });
  test.each(cases)('reset restores uncontrolled dates and times after clearing: %j', async (props) => {
    const changed = vi.fn();
    await mount(<form><DatePicker {...props} name="meeting" onValueChange={changed} /></form>);
    const form = container.querySelector('form')!;
    const initial = new FormData(form).get('meeting');
    await act(() => container.querySelector<HTMLButtonElement>('[aria-label="Clear"]')!.click());
    expect(new FormData(form).get('meeting')).toBe('');
    await act(async () => { form.reset(); await Promise.resolve(); });
    expect(new FormData(form).get('meeting')).toBe(initial);
    expect(changed).toHaveBeenCalledTimes(1);
  });
  test('canceled reset preserves edits; controlled undefined remains controlled', async () => {
    await mount(<form><DatePicker name="meeting" defaultValue={new Date(2026, 10, 6)} /></form>);
    const form = container.querySelector('form')!;
    await act(() => container.querySelector<HTMLButtonElement>('[aria-label="Clear"]')!.click());
    form.addEventListener('reset', event => event.preventDefault(), { once: true });
    await act(async () => { form.reset(); await Promise.resolve(); });
    expect(new FormData(form).get('meeting')).toBe('');
    await act(() => root!.render(<form><DatePicker name="meeting" value={undefined} defaultValue={new Date(2026, 10, 6)} /></form>));
    await act(async () => { form.reset(); await Promise.resolve(); });
    expect(new FormData(form).get('meeting')).toBe('');
  });
});

test('image object URLs survive StrictMode replay and are revoked on replacement/unmount', async () => {
  let sequence = 0;
  const create = vi.fn(() => `blob:preview-${++sequence}`);
  const revoke = vi.fn();
  Object.defineProperties(URL, { createObjectURL: { configurable: true, value: create }, revokeObjectURL: { configurable: true, value: revoke } });
  await mount(<StrictMode><FileThumbnail file={new File(['x'], 'a.png', { type: 'image/png' })} size={48} /></StrictMode>);
  const first = container.querySelector('img')!.getAttribute('src');
  expect(revoke).not.toHaveBeenCalledWith(first);
  await act(() => root!.render(<FileThumbnail file={new File(['x'], 'a.pdf', { type: 'application/pdf' })} size={48} />));
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('[role="status"]')).toBeNull();
  expect(revoke).toHaveBeenCalledWith(first);
  await act(() => root!.unmount());
  root = undefined;
  expect(revoke).toHaveBeenCalledTimes(create.mock.calls.length);
});

test('replacing a PDF aborts pending rendering and ignores a late result', async () => {
  let signal: AbortSignal | undefined;
  let resolve: (url: string) => void = () => {};
  const render = vi.fn((_file: File, _width: number, current: AbortSignal) => { signal = current; return new Promise<string>(done => { resolve = done; }); });
  await mount(<FileThumbnail file={new File(['x'], 'a.pdf', { type: 'application/pdf' })} size={48} renderPdf={render} />);
  expect(container.querySelector('[role="status"]')).not.toBeNull();
  await act(() => root!.render(<FileThumbnail file={new File(['x'], 'a.txt')} size={48} renderPdf={render} />));
  expect(signal!.aborted).toBe(true);
  await act(async () => { resolve('data:late'); await Promise.resolve(); });
  expect(container.querySelector('img')).toBeNull();
});

test('daily counts have keyboard-native exact values including zero days', async () => {
  await mount(<ActivityHeatmap start="2026-11-01" end="2026-11-03" activity={[{ date: '2026-11-02', messages: 7 }]} />);
  const select = container.querySelector('select')!;
  expect(select.options).toHaveLength(3);
  await act(() => { select.value = '2026-11-02'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(container.querySelector('[aria-live]')!.textContent).toContain('7 messages');
  await act(() => { select.value = '2026-11-03'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(container.querySelector('[aria-live]')!.textContent).toContain('0 messages');
});

test('mounted table hover updates only affected rows and preserves their DOM', async () => {
  const commits = new Map<number, number>();
  const rows = Array.from({ length: 250 }, (_, index) => <Profiler key={index} id={String(index)} onRender={() => commits.set(index, (commits.get(index) ?? 0) + 1)}><TableRow index={index}><TableCell>{index}</TableCell></TableRow></Profiler>);
  await mount(<Table><TableBody>{rows}</TableBody></Table>);
  const originalRows = Array.from(container.querySelectorAll('tr'));
  commits.clear();
  await act(() => hover.setActive!(100));
  expect([...commits.keys()]).toEqual([100]);
  commits.clear();
  await act(() => hover.setActive!(101));
  expect([...commits.keys()]).toEqual([100, 101]);
  expect(Array.from(container.querySelectorAll('tr')).every((row, index) => row === originalRows[index])).toBe(true);
});
