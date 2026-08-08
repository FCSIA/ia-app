---
tags: [architecture, frontend, state, react]
---

# Client State Ownership

[Home](../index.md)

## Decision

Do not adopt Zustand or XState now. Correct the current ownership boundaries
with feature-scoped React contexts, reducers, and pure TypeScript transition
functions first. Convex remains the owner of server data, and URL-addressable
state remains in the router.

This is a no-adoption decision, not a permanent ban. The adoption triggers and
stop conditions below define when the decision should be revisited.

## Ownership Boundaries

| State kind | Owner | Examples | Boundary |
| --- | --- | --- | --- |
| Server state | Convex query or mutation | schedules, friends, courses, upload records | Do not mirror it into a client store or machine. |
| URL state | Next or Expo Router | active schedule tab, deep-link section | Keep shareable navigation state addressable in the URL. |
| Local UI state | nearest component | open dialogs, selected weekday, search input | Lift only when multiple real consumers need to coordinate. |
| Feature-shared client state | focused React context or reducer | schedule draft and pending commands | Keep one lifecycle and reset policy per feature. |
| Persisted preferences | platform adapter plus schema | web `localStorage`, mobile AsyncStorage | Share validation and migrations, not storage implementations. |
| Secrets and credentials | secure platform adapter | mobile push token | Use SecureStore; never put these in a general client store. |
| Workflow state | pure transition function, then reducer if needed | attachment upload, navigation delay | Add XState only when product requirements exceed this model. |

## Evidence

### Web schedule workspace

`ScheduleWorkspaceProvider.tsx` currently combines URL interpretation, two
Convex subscriptions, draft synchronization, search, permissions, admin edit
state, mutations, pending actions, derived schedule state, toasts, and a DOM
ref. The maintenance problem is its breadth, not the absence of selectors.

The single `pendingAction: string | null` also cannot represent independent
operations running at the same time. Draft synchronization compares the source
object by reference and has no explicit policy for preserving or discarding a
dirty local draft when server data changes.

A Zustand store would move the same mixed responsibilities without defining
their ownership. First split query composition, navigation, draft editing, and
commands. Put draft transitions in a reducer, represent pending work by keyed
state such as `Set<string>`, and specify source-change/reset behavior. Profile
consumer renders afterward; hook count alone is not adoption evidence.

### Mobile chat attachments

`use-managed-chat-attachments.ts` is a real per-item workflow: pick, validate,
upload, finalize, remove, abandon, consume, and clean up. It also coordinates
generation guards, task cancellation, server cleanup, and unmount behavior.
However, it is still contained in one hook and has no committed requirement for
retry/backoff, resumable upload, an offline queue, process restoration, or
cross-screen control.

Extract a pure per-item transition function and test valid and invalid
transitions first. XState becomes justified only if one of those product
requirements is accepted and the plain transition model no longer represents
the workflow clearly.

### Mobile push

`push.ts` is a short platform/API sequence, not shared application state.
Registration, permission checks, token persistence, and Convex mutation calls
belong in the push adapter. The response listener has an asynchronous setup and
cleanup race, and terminated-app response handling is a separate adapter gap;
neither defect is solved by Zustand.

### Web navigation loading

`navigation-loading-provider.tsx` has one owner and three timers for delayed
show, minimum visibility, and timeout recovery. It is state-machine-shaped, but
small enough for a reducer or pure transition function plus fake-timer tests.
XState would add a runtime and a second vocabulary without solving a current
cross-component or recovery requirement.

## Library Evaluation

### Zustand

Zustand could provide selector subscriptions for mutable, client-only state
used by distant components. It would not fix mixed server/URL/draft ownership,
define a draft conflict policy, make upload transitions valid, or unify secure
and non-secure persistence across web and mobile.

Adopt it only when all of these are true:

- multiple distant consumers mutate the same client-only state;
- profiling or recurring maintenance defects show the current context boundary
  is the cause;
- the feature has explicit initialization, reset, and disposal rules; and
- selectors provide a measurable benefit over split contexts and reducers.

Stop the pilot if the store starts mirroring Convex results, absorbing URL
state, or collecting unrelated feature state.

### XState

XState could make complex workflow transitions, cancellation, parallel states,
event traces, and model-based tests explicit. It would not improve ordinary
form state, server subscriptions, a single promise, or platform persistence by
itself.

Adopt it only when a product flow requires at least one of:

- retry policy with backoff and terminal failure states;
- coordinated cancellation or parallel workflows;
- offline queuing, resume, or process restoration;
- recurring invalid transitions that types and focused reducers have not
  prevented; or
- event traces or model-based tests needed for support and verification.

Stop the pilot if the machine only wraps one async call, duplicates Convex
state, or requires more adapter code than the workflow it replaces.

## Smallest Justified Pilot

The current pilot is library-free:

1. Extract schedule draft and keyed-pending transitions into a reducer with
   reset/conflict tests.
2. Extract attachment item transitions and test cancellation, late finalize,
   removal, abandonment, and cleanup.
3. Model navigation-loading transitions with a reducer or pure function and
   fake-timer tests.
4. Fix push listener cleanup and cold-start routing in the platform adapter.
5. Profile the split schedule consumers before reconsidering Zustand.

If future attachment requirements include retry or offline resume, evaluate
XState there first. Reconsider Zustand for the schedule workspace only after
the split and profiling show a remaining selector-subscription problem.
