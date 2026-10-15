# Contributing to the IA App

IA students are welcome to propose fixes and features. A contribution is a
reviewed proposal: opening a pull request never gives it access to school data,
shared deployments, or production.

## Before you start

1. Pick an issue with clear acceptance criteria, or open an issue first.
2. Comment with the part you plan to own so two students do not duplicate work.
3. Read `AGENTS.md` and the relevant page under `docs/`.
4. For Convex work, read the generated guidance and use an isolated local
   deployment. Never select a shared or production deployment for contributor
   development.

Ask a maintainer to clarify an issue marked `still-writing` before coding.

## Local setup

Follow [the developer setup guide](docs/reference/getting-started.md). Create a
branch with a short issue-based name:

```bash
git switch -c student/65-contribution-guide
```

Keep the change focused. Do not combine a feature, a dependency upgrade, and an
unrelated cleanup in one pull request.

## Student-data safety

Never commit or paste:

- real student or staff records, IDs, schedules, grades, attendance, or contact
  information;
- screenshots containing real accounts or school-only content;
- `.env*` files, API keys, cookies, tokens, private keys, or exported
  credentials;
- production logs, database exports, or files downloaded from a shared Convex
  deployment.

Use the documented demo accounts and synthetic seed data. If a bug can only be
shown with sensitive data, stop and report it privately using
[SECURITY.md](SECURITY.md).

Contributor pull-request CI receives no repository secrets and must never
deploy. Do not change that boundary to make a check pass.

## Build and test

Run the narrowest relevant check while developing, then run the repository
gate before requesting review:

```bash
bun run brand:check
bun run devlog:check
bun run lint
bun run test
bun run build
```

For Convex schema or function signature changes, also run the codegen and
typecheck steps from `AGENTS.md` against your isolated local deployment. Add
negative authorization tests when access rules change.

## Release notes

Students read a devlog in the app, and it is built from your commit subjects.
If a commit changes something a student would notice, add a `Devlog:` trailer
with the sentence they should read:

```
clubs: add unit-aware channel policies

Devlog: Clubs can give each unit its own channels and decide who sees them.
```

Never edit `CHANGELOG.md` or `packages/devlog/src/releases.generated.ts` by
hand; both are generated, and `bun run devlog:check` fails if they drift. See
[versioning and the devlog](docs/reference/versioning.md).

## Pull requests

- Link the issue and explain the user-visible outcome.
- List the commands you actually ran and their results.
- Use synthetic data in screenshots or recordings.
- Call out migrations, new environment variables, permission changes, or
  deployment steps.
- Keep review findings open until the code or documentation is updated.

A maintainer must review every contribution. Changes to auth, roles, storage,
uploads, moderation, deployment, workflows, or Convex schema require the
security-sensitive CODEOWNER. Passing CI is necessary, but it is not approval
to merge or deploy.

See [the maintainer review runbook](docs/reference/contributor-review.md) for the
review and future security-scanner gates.
