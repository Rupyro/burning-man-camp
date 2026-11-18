# ADR 0001: Stack

> Live status of decisions and features: see [docs/../registry/](../registry/README.md).

Status: accepted (B0, Oct 2026)

Next.js 16 (App Router) + React 19 + TypeScript strict, pnpm 10, Postgres 16 with Drizzle ORM and
drizzle-kit, Better Auth (magic link, invite-only), Tailwind 4 + shadcn/ui, Zod, Vitest, Biome for
format/lint plus ESLint used only for `eslint-plugin-boundaries`. Hosting later on Vercel + Neon, email
via Resend, files on Cloudflare R2, errors in Sentry. Reasons and costs: `docs/PLAN.md` §3.

Local-first until the cloud accounts exist: Docker or local Postgres, a console email adapter, and a
configurable `DATABASE_URL` so Neon drops in without code changes.
