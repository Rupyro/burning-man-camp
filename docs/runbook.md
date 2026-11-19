# Runbook (B0 stub, filled in through B2 and the hardening slice)

- **Invite someone:** `pnpm invite <email> "<name>"` (admin UI arrives in B1).
- **Switch a module off / to pilot:** `pnpm module:flag <id> off|on|pilot|admins|everyone`. Audited.
  Data and migrations stay; the route returns 404 and the tile disappears.
- **Run migrations:** `pnpm db:migrate` (base first, then each module; safe to re-run).
- **Backups and restore:** `.github/workflows/backup.yml` runs nightly (2:17 AM Pacific) and on
  demand (Actions → backup → Run workflow). It saves a `pg_dump` (custom format), encrypted with
  `BACKUP_PASSPHRASE`, as the `db-backup` artifact for 7 days. It needs the repo secrets
  `BACKUP_DATABASE_URL` (unpooled Neon URL) and `BACKUP_PASSPHRASE`, and skips without them. A
  copy of the passphrase is in Vercel (production env, `BACKUP_PASSPHRASE`). To restore: download
  the artifact, then
  `gpg -d db-*.dump.gpg > db.dump` and
  `pg_restore --no-owner --clean --if-exists -d "$DATABASE_URL_UNPOOLED" db.dump` (pg_restore 18).
  Neon's own point-in-time restore (within the plan's history window) is the second safety net.
- To come: add an admin, roll the year, email stopped.

## Deploys and database migrations (Vercel)

- Vercel runs `pnpm vercel-build` (set in `vercel.json`). It runs `scripts/vercel-build.ts`, then `next build`.
- **Production** (`VERCEL_ENV=production`) with `DATABASE_URL_UNPOOLED` set: applies migrations first, base then each module. It's safe to re-run: already-applied files are skipped. If a migration fails, the build fails and the old deploy stays live.
- **Previews and local builds** never touch a database.
- It **never seeds** real data. To refresh the fake demo data after a module adds some, set `DEMO_RESEED=1` on the production env (only works with `DEMO_MODE=true`), redeploy once, then remove it. The demo seed is idempotent.
