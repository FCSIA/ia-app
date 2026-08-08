---
tags: [reference, contributing, security, review]
---

# Student contributor review

[Home](../index.md)

This runbook defines the maintainer side of the student contribution workflow.
The public contributor steps live in [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

## Trust boundary

Treat every pull request as untrusted code, including a pull request from an IA
student or a familiar GitHub account.

The `Contributor Validation` workflow intentionally:

- runs on `pull_request`, not `pull_request_target`;
- grants only `contents: read`;
- sets `persist-credentials: false` on checkout;
- receives no deployment key, API key, token, or other repository secret;
- runs static checks, tests, and builds but never deploys or seeds data.

Do not add secrets to that job. A fork can change package scripts and execute
arbitrary code during install, test, or build.

## Review sequence

1. Confirm the issue has acceptance criteria and the pull request is scoped to
   them.
2. Check the file list before running contributor code locally.
3. Look for secrets, real school data, generated binaries, dependency changes,
   and workflow-permission changes.
4. Require CODEOWNER review for auth, roles, storage, uploads, moderation,
   deployment, workflow, and Convex schema changes.
5. Review authorization at both collection and document boundaries. Require a
   denied-access test for another user or role.
6. Confirm CI is green and advisory findings have been addressed or explicitly
   explained.
7. Squash or merge only after the authorized maintainer is satisfied. Merging
   does not authorize a production deployment.

## Codex Security CLI gate

Issue #65 proposes adding Codex Security CLI to contributor CI. The repository
does not currently contain a pinned command, action, version, or authentication
contract for that tool, and the local Codex installation does not expose a
verifiable `security` subcommand. Do not guess a command or expose an API key to
untrusted pull-request code.

Before enabling a Codex Security job, a maintainer must provide and verify all
of the following from the approved tool documentation:

1. the exact pinned action or CLI package and command;
2. whether it supports forked pull requests without a secret;
3. the minimum GitHub permissions it needs;
4. the event model, with no checkout of untrusted code in a privileged
   `pull_request_target` job;
5. the expected report format and failure threshold;
6. a test pull request proving that secrets are unavailable to contributor
   scripts and findings do not leak private code or student data.

If the scanner requires credentials, run it only in a separately approved,
maintainer-controlled workflow after reviewing the diff. Never place the
credential in the existing contributor job.

## Repository settings outside Git

An owner should configure branch protection for `main` to require:

- pull requests instead of direct pushes;
- `Contributor Validation` and the established React Doctor check;
- at least one approving review;
- CODEOWNER approval for protected paths;
- dismissal of stale approvals after new commits;
- conversation resolution before merge.

These settings cannot be proven or changed by repository files alone. Record
the date and owner when they are enabled.
