# Local Dev Migration Guide: Next.js 16 + Convex

This guide helps teammates and their coding agents migrate local environments to the new architecture.

## Overview of Changes
- **Backend Shift**: Moved from NestJS/Prisma to **Convex**.
- **Frontend Upgrade**: Upgraded to **Next.js 16**.
- **Interception Layer**: Replaced legacy `middleware.ts` with the new **`proxy.ts`** pattern.
- **Authentication**: Using **Better Auth** (cookie-based) instead of the custom architecture with bearer tokens.

---

## Migration Steps for Humans

1. **Pull Latest Main**:
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Clean Install**:
   ```bash
   pnpm install
   ```

3. **Convex Environment Setup**:
   Run the dev server to link your local project to a Convex dev deployment:
   ```bash
   pnpx convex dev
   ```
   *Note: This will create/update `apps/convex/.env.local`.*

4. **Web Environment Setup**:
   Ensure your `apps/web/.env.local` (or root `.env.local`) contains:
   - `NEXT_PUBLIC_CONVEX_URL` (from your Convex dashboard)
   - `NEXT_PUBLIC_CONVEX_SITE_URL` (from your Convex dashboard)

5. **Legacy Cleanup**:
   Delete any untracked or leftover files from the old architecture:
   - `apps/api/` (no longer used)
   - `apps/web/src/middleware.ts` (replaced by `proxy.ts`)
   - `apps/web/src/lib/api.ts` (replaced by Convex hooks)

---

## Instructions for Coding Agents

If you are an agent tasked with setting up or verifying this environment, follow these technical verification steps:

1. **Verify Next.js 16 Proxy**:
   - Check `apps/web/src/proxy.ts`. It must use `export async function proxy(request: NextRequest)`.
   - Run `pnpm build` in `apps/web` and verify the output contains `ƒ Proxy (Middleware)`.

2. **Verify Auth Flow**:
   - Confirm `apps/web/src/lib/auth-server.ts` is correctly initializing `convexBetterAuthNextJs`.
   - Ensure `apps/web/src/app/providers.tsx` wraps the app in `ConvexBetterAuthProvider`.

3. **Check Build & Lint**:
   - `pnpm lint` must pass across the workspace.
   - `pnpm build` must succeed to ensure all legacy REST types are removed and replaced by generated Convex types.

4. **Environment Check**:
   - Validate that `NEXT_PUBLIC_CONVEX_URL` is accessible.
   - If `pnpm dev` fails, it is likely because `pnpx convex dev` hasn't been run to generate the `_generated/` folder.

5. **Other Information**:
   - Cross check the Convex AI guidelines (`apps/convex/src/_generated/ai`), which come from `pnpx convex ai-files install`

---

## Common Troubleshooting
- **"Middleware not found" warnings**: Next.js 16 might warn if a legacy `middleware.ts` is still present in the tree. Ensure it is deleted or renamed to `proxy.ts`.
- **Missing generated files**: If imports from `_generated/api` fail, run `pnpx convex dev` or `pnpx convex codegen`.
- **Vercel Login Screen**: If preview deployments ask for a Vercel login, use `pnpx vercel project protection disable <project-name> --sso`.
