# Runbook (B0 stub, filled in through B2 and the hardening slice)

- **Invite someone:** `pnpm invite <email> "<name>"` (admin UI arrives in B1).
- **Switch a module off / to pilot:** `pnpm module:flag <id> off|on|pilot|admins|everyone`. Audited.
  Data and migrations stay; the route returns 404 and the tile disappears.
- **Run migrations:** `pnpm db:migrate` (base first, then each module; safe to re-run).
- **Backups and restore:** this repo has no backup workflow yet (the original camp's nightly
  dump job wasn't carried over). Until one is added, Neon's own restore (point-in-time, within your
  Neon plan's history window) is the safety net. Adding a scheduled, encrypted dump is a to-do; it
  lives in `.github/workflows/`, a protected path, so it needs Ruchir's label.
- To come: add an admin, roll the year, email stopped.

## Deploys and database migrations (Vercel)

- Vercel runs `pnpm vercel-build` (set in `vercel.json`). It runs `scripts/vercel-build.ts`, then `next build`.
- **Production** (`VERCEL_ENV=production`) with `DATABASE_URL_UNPOOLED` set: applies migrations first, base then each module. It's safe to re-run: already-applied files are skipped. If a migration fails, the build fails and the old deploy stays live.
- **Previews and local builds** never touch a database.
- It **never seeds** real data. To refresh the fake demo data after a module adds some, set `DEMO_RESEED=1` on the production env (only works with `DEMO_MODE=true`), redeploy once, then remove it. The demo seed is idempotent.
