# Agent Guidance

## Start Here
- Read `agent-notes/STATE.md` first for current agent work and recent handoff context.
- Read `agent-notes/README.md` to understand the agent notes map before editing those files.
- Use `docs/` for durable human-facing product, architecture, feature, and reference docs.
- Use `agent-notes/` for volatile handoff state, constraints, and agent coordination.
- Treat stale notes as a bug: update the smallest relevant note when your work changes the handoff picture.

## Product Context
- Users are Innovation Academy students, teachers, sponsors, and school admins.
- The app should feel clear, capable, school-centered, organized, and dependable.
- Prefer readable density and practical hierarchy over decorative UI (no spamming text everywhere and no yap with card components).
- Do not repeat information (e.g. page titles in both shell/header and the main content) when one is enough.

## Common Agent Failure Modes
- Do not trust chat history over files. Inspect source, config, seed data, and docs before changing behavior.
- Do not overwrite user or other-agent changes. Check `git status --short` and stage only your intended files.
- Do not hide failures with broad lint/build ignores. Fix the underlying drift or document a narrow exception.
- Do not hand-roll framework primitives when shadcn, Radix, Fluid, Prisma, or Nest already provide the contract.
- Do not let docs drift from code. If seed data, roles, env, commands, or setup behavior changes, update the relevant doc in the same slice.
- Do not mix unrelated commits. Keep fixes, docs, infra, and refactors separate unless one cannot stand without the other.

## Fluid Functionalism Direction
- Fluid Functionalism is the primary UI system for the web app (along with shadcn and Tailwind v4).
- Fluid is new and changing quickly. Check the latest Fluid Functionalism docs before UI work, even for small changes.
- Prefer current Fluid primitives and registry APIs over old local assumptions. Do not freeze component lists in repo instructions because the available surface may change.
- Do not add compatibility layers or old shadcn-style aliases back into Fluid primitive files. Use Radix/shadcn only where Fluid does not cover a required accessibility or semantic behavior.
- Keep hover, focus, pressed, selected, unread, disabled, and loading states visible and consistent.
- Prevent button and badge text wrapping/overflow by default.

## Skills And References
- Use these skills when available in the agent environment, and search/install from skills.sh if missing:
  - `building-components`: components.build guidance for reusable component design and API quality. Reference: https://www.components.build/, https://skills.sh/vercel/components.build/building-components
  - `vercel-composition-patterns`: composition patterns for scalable React components. skills.sh listing: https://skills.sh/vercel-labs/agent-skills/vercel-composition-patterns
  - `vercel-react-best-practices`: Vercel React/Next.js performance rules. skills.sh listing: https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices
- Use the latest public docs instead of relying on stale memory when the library, skill, or framework behavior may have changed.

## Verification
- For focused UI changes, run `pnpm --filter web exec tsc --noEmit`.
- For UI primitive, lint, or build-config changes, also run `pnpm --filter web lint` and `pnpm --filter web build`.
- For backend/schema changes, run `pnpm --filter api exec tsc --noEmit` and regenerate Prisma client if schema changed.
- For Nix changes, run `nix flake check --no-build`.
- Do not clear `.next` or run full builds repeatedly unless diagnosing a build-specific problem.
- Commit coherent functional slices regularly.

## Commits
- Use Conventional Commits: `type(scope): summary`.
- Keep summaries concise and imperative.
- Use multi-line commit bodies when useful to explain why the change exists, not to repeat the diff.
- Prefer separate commits for unrelated docs, infra, feature, and fix work.
