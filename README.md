# Burning Man camp app

An open-source camp-management app for Burning Man theme camps: members and teams, applications,
dues and spending, shifts, gear and packing, travel, tasks and a home screen that shows each
person what to do next. It's adapted from a camp app built for an AfrikaBurn camp (Oe-aa-sies),
and is being reworked for Black Rock City: placement, tickets and passes, Leave No Trace and
strike, and the Burning Man calendar.

**Status:** early. This is the starting copy. Some screens, wording, dates and the currency
(rand) still come from the AfrikaBurn version and are being replaced step by step. Everything in
the repo is demo data with made-up people.

The app is modular: a camp turns on only the packs it needs (for example sound, a mutant vehicle,
or big power), so a 20-person art camp and a 150-person sound camp can both use it.

Stack: Next.js 16, TypeScript, Drizzle ORM, Postgres (Neon), hosted on Vercel. Free plans are
enough for one camp.

## Set up your own camp

Each camp runs its **own copy**: its own code, its own database and its own website. Nothing is
shared between camps, so one camp's member data can never mix with another's. There's no central
service and nobody pushes updates to you; when you want newer features, pull them from this repo
yourself.

1. **Get the code.** Fork this repo on GitHub, or copy it into a new repo of your own
   (keep it private if you like).
2. **Create a free Vercel project** from your repo (vercel.com → Add New → Project → import it).
   Vercel uses `pnpm vercel-build` from `vercel.json`.
3. **Add a free Neon Postgres database** to that project (Vercel → Storage → Neon, free plan). This
   sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for you. Production deploys run the database
   migrations automatically.
4. **Set the other environment variables in Vercel** (never in the repo): at least
   `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `BETTER_AUTH_URL` (your site's address) and
   `CAMP_TIMEZONE` (`America/Los_Angeles` for Black Rock City). `.env.example` lists every name.
   To try it with fake people first, also set `DEMO_MODE=true` and `DEMO_RESEED=1` for one deploy.
5. **Make it yours.** Run `pnpm camp:setup` (a few questions that rewrite `camp.config.ts`: name,
   packs, money and so on), swap the art in `camp-art/` and the wording in `camp-content/`, then
   commit and push. Vercel redeploys.
6. **Invite your leads** with `pnpm invite you@example.com "Your Name"` against your database, or
   from the admin screens.

Secrets (database URLs, auth secret, API keys) belong in Vercel's environment variables or your
camp's password manager, never in git.

For the camp-lead side of setup (the setup questions, picking packs and the event, writing your
camp's words, and the yearly date update), see [`docs/new-camp-guide.md`](docs/new-camp-guide.md).

## Run it locally

Needs Node 24 (`.nvmrc`), pnpm 10 (`corepack enable`) and Postgres 16 (Docker, or any local install).

```bash
pnpm i
cp .env.example .env.local          # then set BETTER_AUTH_SECRET: openssl rand -base64 32
pnpm db:up                          # Postgres 16 in Docker (skip if you run Postgres yourself)
pnpm seed                           # runs every migration (base, then modules), then demo data
pnpm dev                            # http://localhost:3000
```

No Docker? Point `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `TEST_DATABASE_URL` in `.env.local` at
any Postgres 16+ and create the two databases (`camp_dev`, `camp_test`) yourself.

**Logging in.** Go to `/login` and enter `admin@example.test`, `lead@example.test` or
`member@example.test` (seeded, fake). There is no real email yet: the magic link is printed in the
`pnpm dev` console (`📧 [dev email]`). Any email that hasn't been invited gets the same "check your
inbox" screen but no link, and a `auth.login_refused` audit row. Invite someone new with
`pnpm invite you@example.com "Your Name"` (the invite link is printed too).

**Switching a module off.** `pnpm module:flag logistics off` (or `on`, `pilot`, `admins`, `everyone`).
Its tile disappears and `/logistics` returns 404 straight away; its data and migrations stay.

### Checks (what CI runs)

| Command | What |
|---|---|
| `pnpm lint` | Biome (format + lint) and ESLint, which only enforces module boundaries |
| `pnpm check:modules` | every module's manifest, table prefixes, FKs, route folder and actions follow the rulebook |
| `pnpm typecheck` | `tsc --noEmit`, strict |
| `pnpm test` | unit tests (no DB) |
| `pnpm test:db` | DB tests against `TEST_DATABASE_URL` (wiped and migrated on every run) |
| `pnpm db:check` | `drizzle-kit check` for the base and each module |
| `pnpm build` | production build |

Other scripts: `pnpm format`, `pnpm db:generate [--module <id>]`, `pnpm db:migrate`, `pnpm db:studio`.

## Architecture in one page

```
src/
├─ app/                 Next.js routes only, kept thin
│  ├─ (auth)/           login, invite/[token]
│  ├─ (app)/            signed-in shell; page.tsx = landing page (permitted tiles + "my stuff")
│  │  └─ <module>/      one folder per module, exactly: layout.tsx (guardModuleLayout) + [[...slug]]/page.tsx
│  └─ api/auth/         Better Auth handler
├─ base/                THE BASE. Modules may import only base/api.
│  ├─ api/              public base API for modules (guards, types, read-only base tables, test helpers)
│  ├─ auth/             Better Auth (magic link, invite-only), invites
│  ├─ authz/            Actor, capabilities (definePermissions, can), access rules
│  ├─ registry/         ModuleManifest type, boot-time validation, registry
│  ├─ guard/            moduleAction / sessionAction / publicAction, guardModuleLayout, requireCapability
│  ├─ flags/            module_settings (on/off, audience everyone/pilot/admins), audited
│  ├─ events/           domain_events outbox: emit inside the transaction, dispatch after commit
│  ├─ audit/            audit_events writer
│  ├─ landing/          tile + my-stuff aggregation
│  ├─ email/            console (dev) and memory (tests) adapters; Resend later
│  └─ schema/           base Drizzle tables (unprefixed) + migrations/
├─ contracts/           zod event payloads and soft-reference type names, no logic
├─ modules/
│  ├─ index.ts          composition root: the only file that imports every manifest
├─ components/ui/       shadcn components
└─ lib/                 env (zod), ids (uuidv7), dates (camp time), crypto
```

**The rules that matter** (full text in `docs/MODULE_RULEBOOK.md`):

1. A module lives entirely in `src/modules/<id>/` and imports only `@/base/api`, `@/contracts/*`,
   `@/components/ui/*`, `@/lib/*` and itself. Never another module, never base internals. The base
   never imports modules; it receives their manifests from `src/modules/index.ts`. ESLint fails the build
   otherwise.
2. A module registers itself with a **manifest**: id, route, table prefix, tile, access rule, nav,
   capabilities, "my stuff" provider, events it emits and handles, default flag, seed. The registry
   validates every manifest at boot.
3. Every page and server action is checked **on the server**: `guardModuleLayout` on the route folder,
   `guardModulePage` on the page, `moduleAction(id, { capability }, fn)` on every mutation. A
   module that is off, outside its audience, or not permitted returns 404.
4. Each module owns its tables (all prefixed `<id>_`), its own Drizzle config, migrations folder and
   migrations table (`__drizzle_migrations_<id>`). FKs point only at its own or base tables.
5. Modules talk through **domain events**: emitted in the same transaction as the change (outbox),
   dispatched after commit, each handler in its own transaction with retries; handlers of a module
   that is switched off are skipped.
6. Significant changes write an **audit row** (`ctx.audit.record`); logins, invites, refused logins and
   flag changes are audited by the base.

**Per-module migrations.** drizzle-kit 0.31 handles one config per module: each points at the module's
`schema.ts` with `tablesFilter: ["<id>_*"]`, its own `migrations/` folder and its own migrations table.
Module schemas reference base tables (FKs to `people`, `editions`) without re-exporting them, and the
generated SQL only touches the module's own objects. `pnpm db:migrate` runs base first, then every
module; `tests/db/migrations.db.test.ts` drops the applicants module's tables and re-migrates it alone.
The rulebook's fallback (one shared folder) wasn't needed.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and the module rules in
[`docs/MODULE_RULEBOOK.md`](docs/MODULE_RULEBOOK.md). CI runs typecheck, lint, unit tests, a build
and guardrails (secret scanning, protected paths and a PR size limit) on every pull request.

## License

[MIT](LICENSE) © 2026 Ruchir Thakore.
