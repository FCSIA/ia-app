---
tags: [backend, uploads, storage, convex]
---

# Storage and Uploads

[Home](../index.md)

File uploads use Convex storage. The browser uploads directly to a generated
storage URL, then a domain mutation records the resulting storage ID or public
URL.

## Backend Surface

`apps/convex/src/uploads/files.ts` exposes:

- `api.uploads.files.generateUploadUrl`
- `api.uploads.files.finalizeChatAttachment`
- `api.uploads.files.finalizeClubImage`

The generate step returns a short-lived upload URL. The finalize step verifies
the user, gets the Convex storage URL, and returns metadata for the domain flow.

## Web Helpers

`apps/web/src/lib/convex-upload.ts` contains `uploadFileToConvex()`, which:

1. calls the provided `generateUploadUrl`,
2. posts the browser `File` to that URL,
3. returns the Convex storage ID.

Feature components then call the matching finalize mutation.

## Current Consumers

- Club hero images use `finalizeClubImage`.
- Club channel attachments use `finalizeChatAttachment`.
- Volunteer-hours proof photos use `finalizeVolunteerProof`. They are validated
  images, stored by storage ID, and served through an authenticated HTTP
  action that rechecks the submitter or club reviewer on every request. The
  browser never receives a reusable Convex storage URL. Unsubmitted staged
  proofs expire. Once submitted, a proof cannot be staged or consumed again.
  Rejected-finalization and staged-upload cleanup preserve any storage object
  referenced by a submitted volunteer log, including stale pre-upgrade stages.

## Rules

- Store storage IDs or resolved URLs through Convex mutations, not ad hoc local
  paths.
- Keep attachment metadata bounded: file name, URL, MIME type, size, and domain
  owner fields.
- Add feature-specific validation before exposing uploads to a new surface.

## Related

- [Uploads feature](../features/uploads.md)
- [Data flow](../architecture/data-flow.md)
