# ADR 0002: Thin base + independent modules

> Live status of decisions and features: see [docs/../registry/](../registry/README.md).

Status: accepted (B0, Oct 2026)

One repo, one app, one database. The base owns identity, permissions, people/teams/editions, the task
engine (B2), notifications, audit, flags, events and the landing page. Each module owns its folder,
tables (prefixed), migrations, screens and manifest, and talks to others only through base services
and domain events. Enforced by ESLint boundaries and `pnpm check:modules`. Full rules:
`docs/MODULE_RULEBOOK.md`.

Rulebook choices taken: Biome + an ESLint boundaries-only rule; the item catalogue stays in
procurement; one route folder per module with a guarded layout (plus a guarded page, because Next.js
layouts don't re-render on client navigation).

Per-module migrations work with drizzle-kit 0.31 (`tablesFilter` + per-module migrations table), so
the shared-folder fallback is not used.
