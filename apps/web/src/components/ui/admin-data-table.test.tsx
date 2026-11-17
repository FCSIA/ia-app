// @vitest-environment jsdom
import { act, createRef } from 'react';
import { createPortal } from 'react-dom';
import { Command, CommandInputSlot, CommandList, CommandItem } from './command';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import {
  useDataTable,
  DataTable,
  DataTableColumnHeader,
  DataTableColumnHeaderLabel,
  DataTableControls,
  DataTableSearchInput,
  DataTableSearch,
  DataTablePagination,
  selectColumn,
  type ColumnDef,
} from './data-table';
import type { RowModel, Table } from '@tanstack/react-table';

type Person = { id: string; name: string };
const people = [
  { id: 'owner', name: 'Zoe' },
  { id: 'member', name: 'Ada' },
  { id: 'guest', name: 'Ben' },
];
const columns: ColumnDef<Person>[] = [
  selectColumn<Person>(),
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
];
let composed = false;
let hits = 0;
const inputRef = createRef<HTMLInputElement>();
const extendedColumns: ColumnDef<Person>[] = [
  selectColumn<Person>(),
  { accessorKey: 'name', header: ({ column }) => <DataTableColumnHeader column={column} title="Name">
    <DataTableColumnHeaderLabel />
    <DataTableControls>
      <button onClick={() => { hits++; }}>Inspect</button>
      {createPortal(<button data-testid="portal-control">Portal action</button>, document.body)}
    </DataTableControls>
  </DataTableColumnHeader> },
  { accessorKey: 'id', header: 'ID' },
];
let table: Table<Person>;
let root: Root;
let container: HTMLDivElement;
function Fixture({ remote = false }: { remote?: boolean }) {
  table = useDataTable({
    data: people,
    columns: composed ? extendedColumns : columns,
    pageSize: 2,
    getRowId: (row) => row.id,
    enableRowSelection: (row) => row.original.id !== 'owner',
    manualPagination: remote,
  });
  return (
    <>
      {composed ? <Command shouldFilter={false} label="People">
        <DataTableSearch table={table}>
          <CommandInputSlot asChild value={String(table.getState().globalFilter ?? '')}>
            <DataTableSearchInput ref={inputRef} aria-label="Find people" aria-expanded={true} />
          </CommandInputSlot>
        </DataTableSearch>
        <CommandList><CommandItem value="Ada" onSelect={() => table.setGlobalFilter('Ada')}>Ada</CommandItem></CommandList>
      </Command> : <DataTableSearch table={table} />}
      <DataTable table={table} reorderColumns />
      {!remote && <DataTablePagination table={table} />}
    </>
  );
}
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn(() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    })),
  });
  Object.assign(globalThis, { CSS: { escape: (value: string) => value } });
  Element.prototype.scrollIntoView = vi.fn();
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  };
});
afterEach(async () => {
  if (root) await act(() => root.unmount());
  container?.remove();
  composed = false;
  hits = 0;
});
async function mount(remote = false) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(() => root.render(<Fixture remote={remote} />));
}
// TanStack lazily computes row models and queues pagination resets. Read them
// inside act so those queued state updates settle before the next interaction.
async function rowIds(model: () => RowModel<Person> = () => table.getRowModel()) {
  let ids: string[] = [];
  await act(async () => {
    ids = model().rows.map((row) => row.id);
  });
  return ids;
}
test('native sorting, search and pagination use accessor values and stable row IDs', async () => {
  await mount();
  expect(await rowIds()).toEqual([
    'owner',
    'member',
  ]);
  await act(() =>
    Array.from(container.querySelectorAll<HTMLButtonElement>('thead button'))
      .find((button) => button.textContent === 'Name')!
      .click(),
  );
  expect(await rowIds()).toEqual([
    'member',
    'guest',
  ]);
  await act(() => table.nextPage());
  expect(await rowIds()).toEqual(['owner']);
  const search = container.querySelector<HTMLInputElement>(
    'input[type="search"]',
  )!;
  await act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!.call(search, 'Ada');
    search.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(await rowIds(() => table.getFilteredRowModel())).toEqual([
    'member',
  ]);
  expect(container.textContent).toContain('Ada');
});
test('native select-all respects permission predicates across all loaded pages', async () => {
  await mount();
  await act(() => table.toggleAllRowsSelected(true));
  expect(table.getState().rowSelection).toEqual({ member: true, guest: true });
  expect(table.getRow('owner').getCanSelect()).toBe(false);
  await act(() => table.nextPage());
  expect(await rowIds(() => table.getSelectedRowModel())).toEqual([
    'member',
    'guest',
  ]);
});
test('manual cursor pages are not sliced again by the client', async () => {
  await mount(true);
  expect(table.getRowModel().rows).toHaveLength(3);
  expect(container.querySelector('tbody')!.rows).toHaveLength(3);
});

test('injected controls keep click and keyboard ownership; default labels still sort', async () => {
  composed = true;
  await mount();
  const inspect = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === 'Inspect')!;
  await act(() => inspect.click());
  expect(hits).toBe(1);
  expect(table.getState().sorting).toEqual([]);
  await act(() => inspect.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true })));
  expect(table.getState().columnOrder).toEqual([]);
  const sort = Array.from(container.querySelectorAll<HTMLButtonElement>('thead button')).find((b) => b.textContent === 'Name')!;
  await act(() => sort.click());
  expect(table.getState().sorting).toEqual([{ id: 'name', desc: false }]);
  await act(() => sort.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true })));
  expect(table.getState().columnOrder).toEqual(['select', 'id', 'name']);
});
test('portal events do not select table rows or reorder columns', async () => {
  composed = true;
  await mount();
  const portal = document.querySelector<HTMLButtonElement>('[data-testid="portal-control"]')!;
  await act(() => portal.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true })));
  await act(() => portal.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true })));
  expect(table.getState().rowSelection).toEqual({});
  expect(table.getState().columnOrder).toEqual([]);
});
test('search decorators receive the actual input ref and preserve one filter state', async () => {
  composed = true;
  await mount();
  const input = inputRef.current!;
  expect(input.tagName).toBe('INPUT');
  expect(input.getAttribute('role')).toBe('combobox');
  expect(input.getAttribute('aria-label')).toBe('Find people');
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Ada');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(table.getState().globalFilter).toBe('Ada');
  expect(table.getState().pagination.pageIndex).toBe(0);
  await act(() => {
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  });
  expect(document.activeElement).toBe(input);
});
