# Convex WebSocket Sync Wire Protocol — `convex@1.43.0`

Extracted from the installed npm package at `node_modules/convex/src/browser/sync/`
(shipped TypeScript sources, not minified). Primary files:

- `src/browser/sync/protocol.ts` — wire type definitions (quoted verbatim below)
- `src/browser/sync/web_socket_manager.ts` — URL use, ping/inactivity, close codes, backoff, TransitionChunk reassembly
- `src/browser/sync/client.ts` (`BaseConvexClient`) — URL derivation, Connect message, mutation/action submission
- `src/browser/sync/local_state.ts` — ModifyQuerySet + Authenticate construction, restart/resume
- `src/browser/sync/request_manager.ts` — mutation/action retry-on-reconnect semantics
- `src/browser/sync/remote_query_set.ts` — transition application
- `src/browser/sync/authentication_manager.ts` — JWT lifecycle
- `src/browser/sync/paginated_query_client.ts`, `pagination.ts`, `udf_path_utils.ts` — pagination
- `src/values/value.ts`, `src/values/base64.ts` — value encodings

---

## 1. WebSocket URL derivation

From `client.ts:324-339` (`BaseConvexClient` constructor):

```ts
// Substitute http(s) with ws(s)
const i = address.search("://");
if (i === -1) {
  throw new Error("Provided address was not an absolute URL.");
}
const origin = address.substring(i + 3); // move past the double slash
const protocol = address.substring(0, i);
let wsProtocol;
if (protocol === "http") {
  wsProtocol = "ws";
} else if (protocol === "https") {
  wsProtocol = "wss";
} else {
  throw new Error(`Unknown parent protocol ${protocol}`);
}
const wsUri = `${wsProtocol}://${origin}/api/${version}/sync`;
```

`version` is exported at `src/index.ts:1`: `export const version = "1.43.0";`

So the exact path is **`/api/<full-semver>/sync`** (three-part semver, dots included):

- `http://127.0.0.1:3210` → `ws://127.0.0.1:3210/api/1.43.0/sync`
- `https://small-mouse-123.convex.cloud` → `wss://small-mouse-123.convex.cloud/api/1.43.0/sync`

No auth headers / subprotocol / query string on the upgrade request. Auth travels
in-band via `Authenticate` messages after connect.

## 2. Framing

One JSON object per WebSocket **text** frame, both directions. No batching.

## 3. Outbound (Client → Server) messages

Discriminated union on `"type"` (`protocol.ts:199-205`). All messages below are
sent as JSON; optional fields are simply omitted when undefined.

### 3.1 `Connect` (handshake, first message after every socket open)

```ts
type Connect = {                       // protocol.ts:119-126
  type: "Connect";
  sessionId: string;                   // UUID v4, generated once per BaseConvexClient (session.ts:1-14)
  connectionCount: number;             // 0 on first ever connect; incremented AFTER each successful open
  lastCloseReason: string | null;      // "InitialConnect" on first ever connect, else reason or null
  maxObservedTimestamp?: TS | undefined;
  clientTs: number;                    // epoch ms (monotonic-millis), see web_socket_manager.ts:100-108
};
```

Sent in `onOpen` (`client.ts:421-429`):

```ts
this.webSocketManager.sendMessage({
  ...reconnectMetadata,                // connectionCount, lastCloseReason, clientTs
  type: "Connect",
  sessionId: this._sessionId,
  maxObservedTimestamp: this.maxObservedTimestamp,
});
```

- `maxObservedTimestamp`: highest `ts` the client has observed (Transition
  `endVersion.ts` or successful MutationResponse `ts`). Wire format is the
  encoded u64 string (see §5). Omitted entirely until first observed.
- Immediately after `Connect`, on every reconnect (`client.ts:431-444`):
  1. `Authenticate` if auth is set (`baseVersion: 0`, identityVersion resets to 1)
  2. `ModifyQuerySet` with `baseVersion: 0, newVersion: 1` containing one `Add`
     per active query, each carrying its stored `journal`
  3. Every outstanding mutation message re-sent verbatim (same `requestId`);
     in-flight **actions are NOT re-sent** — they fail locally with
     errorMessage `"Connection lost while action was in flight"`.

Example first-connect frames:

```json
{"type":"Connect","sessionId":"8b7f...","connectionCount":0,"lastCloseReason":"InitialConnect","clientTs":1771849200000}
```

with maxObservedTimestamp present:

```json
{"type":"Connect","sessionId":"8b7f...","connectionCount":2,"lastCloseReason":"Transient","maxObservedTimestamp":"AAGGf8AAAAAAAAA=","clientTs":1771849300000}
```

### 3.2 `ModifyQuerySet` (subscribe / unsubscribe)

```ts
export type AddQuery = {              // protocol.ts:128-138
  type: "Add";
  queryId: QueryId;                   // nonnegative int; client-assigned counter starting at 0
  udfPath: string;                    // canonicalized "module:function" (see §6)
  args: JSONValue[];                  // ARRAY WITH EXACTLY ONE ELEMENT: convexToJson(argsObject)
  journal?: QueryJournal | undefined; // opaque string | null; server cursor-decision state
  componentPath?: string | undefined; // internal; omit for root component
};

export type RemoveQuery = {           // protocol.ts:140-143
  type: "Remove";
  queryId: QueryId;
};

export type QuerySetModification = {  // protocol.ts:145-150
  type: "ModifyQuerySet";
  baseVersion: QuerySetVersion;       // int the client believes server has
  newVersion: QuerySetVersion;        // baseVersion + 1 per modification batch
  modifications: (AddQuery | RemoveQuery)[];
};
```

- Live subscribe/unsubscribe sends batches of exactly one modification with
  `newVersion = baseVersion + 1` (`local_state.ts:123-152, 371-406`).
- On reconnect everything is re-sent as a single batch:
  `{type:"ModifyQuerySet", baseVersion: 0, newVersion: 1, modifications:[...all Adds...]}`.
- `journal`: pass the last received journal (`QueryUpdated`/`QueryFailed`
  carry one; store it per query). `null` = empty journal; omit when unknown.

Example:

```json
{"type":"ModifyQuerySet","baseVersion":0,"newVersion":1,
 "modifications":[{"type":"Add","queryId":0,"udfPath":"clubs/channels:list","args":[{"channelId":"k57..."}],"journal":null}]}
```

### 3.3 `Mutation`

```ts
export type MutationRequest = {       // protocol.ts:152-160
  type: "Mutation";
  requestId: RequestId;               // client counter starting at 0, monotonically increasing
  udfPath: string;                    // sent as provided ("clubs/channels:postMessage"); NOT canonicalized client-side
  args: JSONValue[];                  // ARRAY WITH EXACTLY ONE ELEMENT: convexToJson(argsObject)
  componentPath?: string | undefined; // only for non-root components w/ admin auth
};
```

Built at `client.ts:974-980`. `args` missing → `{}` (`parseArgs`, `common/index.ts:7`).

```json
{"type":"Mutation","requestId":3,"udfPath":"clubs/channels:postMessage","args":[{"channelId":"k57","body":"hi"}]}
```

Mutations are idempotent-by-requestId on the server and re-sent verbatim
(same requestId) on reconnect until acknowledged AND a transition covers their
commit `ts`.

### 3.4 `Action`

```ts
export type ActionRequest = {         // protocol.ts:162-170
  type: "Action";
  requestId: RequestId;
  udfPath: string;
  args: JSONValue[];                  // single-element array, same wrapping
  componentPath?: string | undefined;
};
```

Built at `client.ts:1024-1030`. Never retried on reconnect.

### 3.5 `Authenticate`

```ts
export type Authenticate =            // protocol.ts:172-192
  | {
      type: "Authenticate";
      tokenType: "Admin";
      value: string;                  // admin token
      baseVersion: IdentityVersion;   // int; version this update builds on
      impersonating?: UserIdentityAttributes | undefined;
    }
  | {
      type: "Authenticate";
      tokenType: "User";
      value: string;                  // JWT
      baseVersion: IdentityVersion;
    }
  | {
      type: "Authenticate";
      tokenType: "None";
      baseVersion: IdentityVersion;
    };
```

- Sent whenever auth changes while connected, and always right after `Connect`
  on reconnect when auth exists (`local_state.ts:289-334`).
- `baseVersion` starts at 0 on each new connection (identity versioning resets
  per connection); subsequent live updates increment by 1.
- There is no sessionToken field on `Connect`; the JWT goes ONLY here.
- `UserIdentityAttributes` (impersonation payload) is a free-form object of the
  identity attributes (`server/authentication.ts`); omit unless using admin
  impersonation.

### 3.6 `Event` (optional telemetry)

```ts
export type Event = {                 // protocol.ts:194-198
  type: "Event";
  eventType: string;
  event: any;
};
```

Emitted by this client version only for debug/network-recovery:
- `{eventType:"ClientConnect", event: MarkJson[]}` — marks report (only with
  `reportDebugInfoToConvex`)
- `{eventType:"NetworkRecoveryReconnect", event:{timeSavedMs:number}}`
- `{eventType:"ClientReceivedTransition", event:{transitionTransitTime:number,messageLength:number}}`

Safe to never send.

### Ping/Pong cadence (important)

- The **server** sends sync-level `{"type":"Ping"}` roughly every 15s in the
  absence of other traffic (comment at `web_socket_manager.ts:235-239`).
- The client does **NOT reply**. `Ping`'s only purpose is resetting the client's
  server-inactivity timer (`web_socket_manager.ts:434-443`). There is **no
  `Pong` message anywhere in v1.43.0** (grep confirms zero occurrences).
- If no server message arrives within `serverInactivityThreshold = 60000` ms,
  the client closes and reconnects with closeReason `"InactiveServer"`
  (`web_socket_manager.ts:239, 557-569`).

## 4. Inbound (Server → Client) messages

Wire union (`protocol.ts:325-355`): `Transition | TransitionChunk |
MutationResponse | ActionResponse | FatalError | AuthError | Ping`.
(There is **no `AuthUpdate`** and no `QueryStop` in this version.)

### 4.1 `Transition`

```ts
export type StateVersion = {          // protocol.ts:229-233
  querySet: QuerySetVersion;          // int
  ts: TS;                             // u64 Long; WIRE: base64 LE string
  identity: IdentityVersion;          // int
};

type StateModification =
  | {
      type: "QueryUpdated";           // protocol.ts:237-243
      queryId: QueryId;
      value: JSONValue;               // Convex-value JSON (§5); may be absent → treat as null (remote_query_set.ts:50)
      logLines: LogLines;             // string[]
      journal: QueryJournal;          // string | null — persist for reconnects
    }
  | {
      type: "QueryFailed";            // protocol.ts:244-251
      queryId: QueryId;
      errorMessage: string;
      logLines: LogLines;
      errorData: JSONValue;           // ConvexError data, may be undefined
      journal: QueryJournal;
    }
  | {
      type: "QueryRemoved";           // protocol.ts:252-255
      queryId: QueryId;
    };

export type Transition = {            // protocol.ts:257-264
  type: "Transition";
  startVersion: StateVersion;         // must equal client's current version exactly
  endVersion: StateVersion;           // becomes the new current version
  modifications: StateModification[];
  clientClockSkew?: number;           // ms; (clientTs - serverReceiveTs) from Connect
  serverTs?: number;                  // nanoseconds(!) — divided by 1_000_000 for ms math (web_socket_manager.ts:905)
};
```

Semantics (`remote_query_set.ts:30-87`):
- Validate `startVersion` == current `{querySet, ts, identity}`; else fatal
  mismatch error (reconnect).
- Apply modifications in order; `QueryRemoved` deletes local result.
- After processing, current version := `endVersion`.
- `endVersion.identity > startVersion.identity` ⇒ the transition reflects the
  latest Authenticate; this is how the client learns its token was accepted
  (`authentication_manager.ts:188-233`).

### 4.2 `TransitionChunk` (large transitions split across frames)

```ts
export type TransitionChunk = {       // protocol.ts:266-272
  type: "TransitionChunk";
  chunk: string;                      // JSON text fragment
  partNumber: number;                 // 0-based, strictly sequential
  totalParts: number;
  transitionId: string;               // constant across parts of one transition
};
```

Reassembly (`web_socket_manager.ts:300-347`): concatenate `chunk`s in
`partNumber` order until count == `totalParts`, then `JSON.parse` of the joined
string must be a `Transition` (encoded form). Any gap/order/id change aborts the
buffer. Chunks never reach higher layers individually.

### 4.3 `MutationResponse`

```ts
type MutationSuccess = {              // protocol.ts:274-281
  type: "MutationResponse";
  requestId: RequestId;
  success: true;
  result: JSONValue;                  // return value (Convex-value JSON)
  ts: TS;                             // commit timestamp; WIRE: base64 LE u64 STRING
  logLines: LogLines;
};
type MutationFailed = {               // protocol.ts:282-289
  type: "MutationResponse";
  requestId: RequestId;
  success: false;
  result: string;                     // error MESSAGE (string, not object)
  logLines: LogLines;
  errorData?: JSONValue;              // ConvexError .data when thrown via throw new ConvexError(x)
};
```

On success the client records `ts` as `maxObservedTimestamp` and holds the
mutation's promise until a Transition's `endVersion.ts >= ts` (read-your-writes,
`request_manager.ts:141-166`, `client.ts:478-494`).

ConvexError shape: `result` stays a plain string (message); the structured
payload arrives in `errorData` as a decoded Convex value. Client surfaces
`errorData` as `ConvexError.data` (`logging.ts:168-174`).

Duplicate/unknown `requestId` responses are ignored (`request_manager.ts:74-103`).

### 4.4 `ActionResponse`

Identical to `MutationFailed`/`ActionSuccess` but **no `ts` field**:

```ts
type ActionSuccess = {                // protocol.ts:291-297
  type: "ActionResponse"; requestId: RequestId; success: true; result: JSONValue; logLines: LogLines;
};
type ActionFailed = {                 // protocol.ts:298-305
  type: "ActionResponse"; requestId: RequestId; success: false; result: string; logLines: LogLines; errorData?: JSONValue;
};
```

### 4.5 `AuthError`

```ts
export type AuthError = {             // protocol.ts:307-315
  type: "AuthError";
  error: string;
  baseVersion: IdentityVersion;       // the (unadvanced) auth version the failure applies to
  authUpdateAttempted: boolean;       // true iff this errored a fresh Authenticate message
};
```

Handling (`authentication_manager.ts:235-325`) — see §7.

### 4.6 `FatalError`

```ts
type FatalError = { type: "FatalError"; error: string };   // protocol.ts:316-319
```

Client logs `[CONVEX FATAL ERROR] <error>`, **terminates** the WebSocket
permanently (no reconnect) and throws (`client.ts:504-508`).

### 4.7 `Ping`

`{"type":"Ping"}` — no fields. Resets the 60s inactivity timer; otherwise dropped
(`web_socket_manager.ts:441-443`). Send nothing back.

## 5. Value encodings (decoder requirements)

All `JSONValue` payloads above use Convex value JSON (`values/value.ts`).
Decoding rules for `jsonToConvex` (`value.ts:233-307`):

| Convex value | JSON encoding |
|---|---|
| `null`, `bool` | literal |
| Float64 (normal) | JSON number |
| Float64 special (`NaN`, `±Infinity`, `-0`) | `{"$float": "<base64>"}` — 8-byte IEEE-754 double **little-endian**, standard base64 (`value.ts:267-283, 367-374`) |
| Int64 / BigInt | `{"$integer": "<base64>"}` — two's-complement signed 64-bit **little-endian**, standard base64 (`value.ts:169-189, 359-366`) |
| Bytes (ArrayBuffer) | `{"$bytes": "<base64>"}` — standard base64 of raw bytes |
| commitTs placeholder | `{"$commitTs": null}` (internal `db.vars.commitTs`) |
| Array | JSON array, recursive |
| Object | JSON object; keys **sorted lexicographically** on encode; keys must not start with `$`, ≤1024 chars, non-control ASCII (`value.ts:199-219, 412-428`) |

Base64 alphabet is standard with `+/` and `=` padding (`values/base64.ts:14`),
decoding additionally tolerates url-safe `-`/`_` inputs.

**Timestamps on the wire** (`TS`, `protocol.ts:10-18, 86-87, 225-226`): any
field typed `TS` (`StateVersion.ts`, `MutationResponse.ts`,
`Connect.maxObservedTimestamp`) is `Base64.fromByteArray(long.toBytesLE())` —
i.e. base64 string of 8-byte little-endian unsigned long. Decode symmetrically.

## 6. Function path format & canonicalization

- Format: `"module:function"`, e.g. `"clubs/channels:postMessage"`; default
  export is `"module": "default"`.
- Queries are canonicalized before sending (`udf_path_utils.ts:3-18`): split on
  the LAST `:`; strip a trailing `.js` from the module part; rejoin as
  `module:function`. Mutations/actions are sent as given (no canonicalization in
  `enqueueMutation`/`actionInternal`), so sending canonical form is safest.
- Client-side dedup token (local only, never on wire):
  `JSON.stringify({udfPath, args: convexToJson(args)})`.

## 7. Session token (JWT) lifecycle

There is no token on `Connect` or in upgrade headers. Sequence
(`authentication_manager.ts`):

1. `setAuth(fetchToken)` → fetch token (`forceRefreshToken:false`) → send
   `Authenticate{tokenType:"User", value:<jwt>, baseVersion:<n>}`, bump identity
   version.
2. Server acceptance signal = a `Transition` where
   `endVersion.identity > startVersion.identity` and ≥ local identity version
   (`authentication_manager.ts:188-210`).
3. Proactive refresh: schedule refetch at `exp - refreshTokenLeewaySeconds`
   (default 10s, option `authRefreshTokenLeewaySeconds`), capped 20 days; for
   reused cached tokens remaining lifetime uses `Date.now() -
   clientClockSkewMs` as server-now estimate. Refetch → new `Authenticate`.
4. On `AuthError`:
   - If `authUpdateAttempted === false` while awaiting confirmation of a token →
     ignore (it came from function execution with stale auth).
   - Else stop socket, refetch token with `forceRefreshToken:true`, resend
     `Authenticate`, restart socket. Max 2 confirmation attempts for fresh
     tokens; then clear auth locally (`tokenType:"None"` equivalent path) and
     report unauthenticated.
5. On reconnect with auth present: `Authenticate{..., baseVersion:0}`
   immediately after `Connect` (before the `ModifyQuerySet`).

## 8. Reactive pagination through subscriptions

Paginated pages are ordinary query subscriptions whose args embed
`paginationOpts` (`paginated_query_client.ts:481-511`):

```json
args: { ...userArgs, "paginationOpts": {"cursor": null | "...", "numItems": N, "id": M, "endCursor": "..."?} }
```

- `cursor: null` = first page; `id` groups pages of one paginated query.
- Page results decode to `PaginationResult` (`server/pagination.ts:28-58`):
  `{page: T[], isDone: boolean, continueCursor: string, splitCursor?: string|null, pageStatus?: "SplitRecommended"|"SplitRequired"|null}`.
- Loading more: subscribe next page with `cursor = previous page.continueCursor`.
- Gapless reactive pagination relies on (a) the per-query `journal` echoed in
  `QueryUpdated`/`QueryFailed` and resent in `Add`, which pins end cursors, and
  (b) `endCursor` pinning during splits.
- Splits (`paginated_query_client.ts:359-476`): if `pageStatus` is
  `SplitRecommended`/`SplitRequired` (or page > 2×initialNumItems), subscribe
  two halves — `{cursor: startCursor, endCursor: splitCursor}` and
  `{cursor: splitCursor, endCursor: continueCursor}` — then unsubscribe the
  original once both halves deliver.

## 9. Reconnect / close behavior

Close codes treated as routine (retry silently): `1000`, `1001` (mobile
backgrounding), `1005`, and Convex-specific **`4040`** ("destination not found";
still retried — transient during pushes) (`web_socket_manager.ts:11-19, 484-489`).
Any other code logs `WebSocket closed with code <code>: <reason>`.

Backoff (`web_socket_manager.ts:114-149, 870-883`): initial 100ms for
client-initiated closes; known server errors map to 1000–3000ms seeds
(e.g. `InternalServerError`→1000, `SubscriptionsWorkerFullError`→3000);
unknown→1000ms. Then `seed * 2^retries`, capped 16000ms, ±50% jitter. Backoff
resets once all pre-reconnect queries/mutations have been reconfirmed.

## 10. Minimal Swift checklist

- [ ] URL: replace scheme http→ws / https→wss, append `/api/1.43.0/sync`
- [ ] Text frames, one JSON object each; keep a JSONEncoder/Decoder pair with
      snake-case-free exact field names above
- [ ] On open: `Connect` (+`Authenticate` if authed, + full `ModifyQuerySet`
      replay, + mutation replay; cancel actions)
- [ ] Handle `TransitionChunk` reassembly before dispatch
- [ ] Decode `ts` fields as base64 → UInt64 little-endian
- [ ] Decode values recursively handling `$integer`, `$float`, `$bytes`,
      `$commitTs`; encode args with sorted keys, single-element `args` array
- [ ] Track `querySet`/`identity` versions; validate transition `startVersion`;
      bump `maxObservedTimestamp` from transitions and successful mutations
- [ ] 60s server-inactivity watchdog reset on ANY inbound frame incl. `Ping`;
      never respond to `Ping`
- [ ] Treat close codes 1000/1001/1005/4040 as clean retries; exponential
      backoff with jitter capped at 16s
