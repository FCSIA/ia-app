---
tags: [frontend, react, components, hooks]
---

# Components and Hooks

[Home](../index.md) / [Frontend overview](frontend-overview.md)

This page is both a short React primer and a guide to the app's current frontend
patterns.

## React State

Use `useState` for local UI state:

```tsx
const [search, setSearch] = useState('');
const [open, setOpen] = useState(false);
const [tab, setTab] = useState<'members' | 'settings'>('members');
```

State should stay close to the component that owns the interaction. Move it up
only when multiple children need to coordinate.

## Effects

Use `useEffect` for browser side effects, not for data fetching from Convex:

```tsx
useEffect(() => {
  const onKeyDown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      setCommandOpen((open) => !open);
    }
  };

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, []);
```

## Convex Reads

Use `useQuery` from `convex/react`:

```tsx
const clubs = useQuery(api.clubs.management.getAll) ?? [];
```

Pass `'skip'` when the query should not run yet:

```tsx
const club = useQuery(api.clubs.detail.get, clubId ? { clubId } : 'skip');
```

Use `usePaginatedQuery` for large lists:

```tsx
const { results, loadMore, status } = usePaginatedQuery(
  api.notifications.inbox.listPage,
  {},
  { initialNumItems: 50 },
);
```

## Convex Writes

Use `useMutation` from `convex/react`:

```tsx
const markRead = useMutation(api.notifications.inbox.markRead);

await markRead({ notificationId });
```

Mutations are the place where backend permissions and side effects happen. The
frontend should not try to duplicate authorization decisions beyond hiding UI
that the current user obviously cannot use.

## Generated Types

Prefer generated Convex types for props that depend on backend return values:

```tsx
type ClubDetail = NonNullable<FunctionReturnType<typeof api.clubs.detail.get>>;
```

This avoids stale DTOs and keeps component props aligned with the active Convex
surface.

## Layout Components

`AppShell` renders authenticated navigation, unread notification count, profile
menu, admin links, and the global command palette.

For normal pages, prefer the layout wrappers:

- `ScrollPageLayout` for standard scrolling list/detail pages.
- `FillPageLayout` for viewport-height panes, tables, and split views.
- `PageFrame`, `HeroBand`, `HeroStat`, and `Panel` for page structure.

These wrappers keep spacing and responsive constraints consistent.

## Component Guidelines

- Prefer shadcn/ui and local components under `apps/web/src/components/ui`.
- Keep feature-specific components under `components/<feature>` or the route's
  local `_components` folder.
- Use `children`, slots, or small composed components instead of prop drilling.
- Keep loading, empty, and error states near the data read.
- Use `id`, `_id`, and route params carefully: Convex documents use `_id`.

## Lists

Every mapped item needs a stable key:

```tsx
{clubs.map((club) => (
  <ClubCard key={club._id} club={club} />
))}
```

## Chat Surfaces

Use the local `MessageScroller` components for message timelines and threads.
They wrap shadcn's headless `@shadcn/react` behavior so streaming updates,
live-edge following, restored transcripts, and stable message anchors do not
need to be rebuilt at each call site. Give each `MessageScrollerItem` a stable
message ID. Compose each row with `Message`, use `Bubble` for its visible
surface, and use `AttachmentGroup` plus `Attachment` for sent and pending files.
`Message` is a transparent, full-width positioning canvas for row-level
`MessageActions`; `Bubble` stays fit-content and owns its reactions. Do not
stretch or decorate the row just to place the action toolbar, and do not anchor
reactions to the row.

The scrollable viewports use shadcn's CSS-only `scroll-fade` utilities so edge
hints follow the current scroll position without adding React scroll state.

The chat text stack has separate jobs:

- Plate owns the interactive composer, rich marks, and structured mention
  nodes. `bodyRich` preserves that editor structure while `body` remains the
  searchable plain-text projection.
- `bodyMarkdown` is the portable message format. The composer serializes its
  supported Plate nodes to GFM, including `http`/`https` links and stable
  `user://` mention links.
- `react-markdown` with `remark-gfm` parses message history into read-only React
  elements. Keep this display path lighter than mounting a read-only editor for
  every message in a timeline.
- The global shadcn/typeset stylesheet, with the compact `typeset-chat` preset,
  styles those rendered elements. Typeset supplies typography, not Markdown
  parsing or editor behavior.

Keep message chrome and controls outside the typeset container so typography
rules only affect the rendered body. External links open in a new tab; images
and unsupported URL schemes are not rendered from message Markdown.

## Forms

Use controlled inputs for simple forms:

```tsx
const [title, setTitle] = useState('');

<Input value={title} onChange={(event) => setTitle(event.target.value)} />
```

For larger validated forms, prefer the app's existing `react-hook-form` and
shadcn form primitives.

## Modals and Drawers

Use the existing dialog/sheet/drawer primitives. Avoid custom fixed overlays
unless the primitive cannot support the interaction.

## Related

- [Frontend overview](frontend-overview.md)
- [Routing](routing.md)
- [Styling](styling.md)
- [Frontend authentication](frontend-auth.md)
