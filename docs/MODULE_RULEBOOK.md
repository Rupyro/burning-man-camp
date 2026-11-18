# Module rulebook: Oe-aa-sies camp operations platform

**Prepared:** Sat 10 Oct 2026 (ET), for Ruchir. Companion to `PLAN.md` §4 (architecture) and `REPO_SETUP.md` §3 (folder layout). Nothing here is implemented yet; the code blocks show the intended contract, to be proven in slice B0 with one example module.

**The idea in one paragraph.** One repo, one deployed Next.js app, one database. A thin **base** owns everything every module needs: login and permissions, people/teams/roles/editions, the shared task engine, notifications and digests, the audit log, domain events, feature flags and the **landing page**. Everything else is a **module** in its own folder with its own tables and screens. A module only talks to the base. It never imports another module. If you delete a module's folder (and run its drop migration), the rest of the app still builds and passes its tests.

Modules planned for V1: `obligations`, `finance`, `procurement` (procurement and inventory), `logistics`, `shifts`, `kitchen`, `programming`, `content` (content and marketing views), `exports` (knowledge export), `binder` (Burn Binder).

Words used below: **MUST** = CI or review rejects the PR if it's broken. **SHOULD** = default; break it only with a one-line reason in the PR.

---

## 1. The ten rules (short version)

1. A module lives entirely in `src/modules/<id>/` and has a `manifest.ts`. (MUST)
2. A module imports only from `@/base/api`, `@/contracts/*`, `@/components/ui`, `@/lib/*` and its own folder. Never from another module, and never from base internals. Enforced by ESLint `boundaries`. (MUST)
3. Every server action and route handler runs through the base guard (`moduleAction` / `guardModulePage`), which checks the session, the module's feature flag and a declared capability **on the server**. Hiding a tile or button is not security. (MUST)
4. A module's tables start with its `tablePrefix` (e.g. `finance_`). Foreign keys point only at its own tables or base tables. References to another module's rows are **soft references** (a uuid plus a type, no FK). (MUST)
5. Each module has its own Drizzle schema file and its own migrations folder and migrations table. (MUST)
6. Tasks, notifications, alerts, audit events, documents and domain events are created **only** through base APIs, inside the transaction the base hands you. (MUST)
7. Modules talk to each other **only** through base domain events, shared tasks or soft references. Event payload types live in `src/contracts/events/<emitting-module>.ts`. (MUST)
8. Scheduled work is declared in the manifest and run by the base tick; every job is idempotent. (MUST)
9. Anything the knowledge export or the Burn Binder needs is provided through export and Binder hooks declared in the manifest. (SHOULD for every module that has data worth keeping; MUST for anything shown in the Binder.)
10. A module can be switched off with a feature flag without breaking anything: tile hidden, routes 404, actions refused, jobs and event handlers skipped, data kept. (MUST)

---

## 2. Folder layout

```
src/
├─ app/                              # Next.js routes only. Thin files.
│  ├─ (auth)/login, invite/[token]
│  ├─ (app)/layout.tsx               # session required; renders shell + nav from the registry
│  ├─ (app)/page.tsx                 # THE LANDING PAGE (base)
│  ├─ (app)/me, people, teams, projects, tasks, settings/...   # base screens
│  ├─ (app)/finance/                 # one folder per module route, see §2.2
│  │   ├─ layout.tsx                 # export default guardModuleLayout("finance")
│  │   └─ [[...slug]]/page.tsx       # export { default } from "@/modules/finance/ui/router"
│  └─ api/ auth/[...all], jobs/tick, uploads, events/dispatch
├─ base/                             # the shared base. Modules may NOT import from here,
│  ├─ api/index.ts                   #   except this file (the public base API)
│  ├─ auth/  authz/  people/  teams/  editions/
│  ├─ engine/                        # tasks, projects, dependencies, claiming, templates, recurrence
│  ├─ notifications/  alerts/  digests/  outbox/
│  ├─ audit/  events/  documents/  flags/  jobs/
│  ├─ registry/                      # reads the module list, validates manifests
│  ├─ landing/                       # tiles + "my stuff" strip
│  └─ schema/                        # base Drizzle tables (unprefixed)
├─ contracts/                        # types + zod schemas only; no logic, no db
│  ├─ events/finance.ts, procurement.ts, ...
│  └─ refs.ts                        # soft-reference type names
├─ modules/
│  ├─ index.ts                       # the ONLY file that imports every manifest (composition root)
│  └─ <id>/
│     ├─ manifest.ts                 # the contract (§3)
│     ├─ schema.ts                   # Drizzle tables, all prefixed (§5)
│     ├─ migrations/                 # drizzle-kit output for this module only
│     ├─ drizzle.config.ts           # points at schema.ts and migrations/, own migrations table
│     ├─ permissions.ts              # capabilities this module declares (§4)
│     ├─ rules/                      # pure TypeScript business rules: no next/*, no drizzle
│     ├─ server/                     # actions.ts, queries.ts, handlers/ (event handlers), exports.ts, my-items.ts
│     ├─ ui/                         # router.tsx, pages/, components/, print/
│     ├─ jobs/                       # scheduled jobs (§8)
│     ├─ binder/                     # Binder sections (react-pdf + html), if any (§9)
│     ├─ seed.ts                     # deterministic fixtures for this module
│     ├─ tests/                      # unit (rules), db (actions/permissions/jobs), e2e smoke
│     └─ README.md                   # what it does, tables, events emitted/handled, open questions
├─ components/ui/                    # shadcn components (shared UI kit, no business logic)
└─ lib/                              # env, dates/camp time, money, ids, r2, resend (no business logic)
```

### 2.1 Who may import what (enforced)

| From → may import | base/api | base/* internals | contracts | components/ui | lib | own module | other modules |
|---|---|---|---|---|---|---|---|
| `src/base/**` | yes | yes | yes | yes | yes | n/a | **no** (gets manifests by injection from `modules/index.ts`) |
| `src/modules/<id>/**` | yes | **no** | yes | yes | yes | yes | **no** |
| `src/contracts/**` | no | no | yes | no | `lib/zod` only | no | no |
| `src/modules/index.ts` | yes | no | no | no | no | `*/manifest.ts` only | — |
| `src/app/**` | yes | yes | no | yes | yes | `ui/router` and manifests only | — |
| `<id>/rules/**` | no | no | yes | no | `lib/money`, `lib/dates`, `lib/ids` | own `rules/` only | no |

ESLint config (only for these boundaries; Biome still does formatting and general linting):

```js
// eslint.config.mjs
import boundaries from "eslint-plugin-boundaries";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { parser: tsParser },
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: true },
      "boundaries/elements": [
        { type: "base-api", pattern: "src/base/api/**" },
        { type: "base", pattern: "src/base/**" },
        { type: "contracts", pattern: "src/contracts/**" },
        { type: "ui-kit", pattern: "src/components/ui/**" },
        { type: "lib", pattern: "src/lib/**" },
        { type: "registry", pattern: "src/modules/index.ts", mode: "file" },
        { type: "module-rules", pattern: "src/modules/*/rules/**", capture: ["module"] },
        { type: "module", pattern: "src/modules/*/**", capture: ["module"] },
        { type: "app", pattern: "src/app/**" },
      ],
    },
    rules: {
      "boundaries/no-unknown-files": "error",
      "boundaries/element-types": ["error", {
        default: "disallow",
        rules: [
          { from: "base", allow: ["base", "base-api", "contracts", "ui-kit", "lib"] },
          { from: "base-api", allow: ["base", "contracts", "lib"] },
          { from: "contracts", allow: ["contracts", "lib"] },
          { from: "module", allow: ["base-api", "contracts", "ui-kit", "lib",
              ["module", { module: "${from.module}" }], ["module-rules", { module: "${from.module}" }]] },
          { from: "module-rules", allow: ["contracts", "lib", ["module-rules", { module: "${from.module}" }]] },
          { from: "registry", allow: ["module", "base-api"] },
          { from: "app", allow: ["base", "base-api", "ui-kit", "lib", "registry", "module"] },
        ],
      }],
    },
  },
];
```

A second, tiny check in CI (`pnpm check:modules`) fails if any module's `schema.ts` declares a table without its prefix, or a `.references()` to a table that isn't its own or a base table.

### 2.2 Routes

Next.js needs real route files, so each module gets one route folder in `src/app/(app)/<route>/` with exactly two files: a `layout.tsx` that calls `guardModuleLayout("<id>")`, and a catch-all `page.tsx` that re-exports the module's `ui/router`. The module's router maps sub-paths to its own pages. `pnpm check:modules` verifies every enabled manifest's `route` has that folder and that the layout calls the guard.

---

## 3. The manifest contract

Every module exports one `manifest` object. The base validates all manifests at boot (unique ids, routes and prefixes; every capability referenced by `access`/`nav` is declared; every handled event exists in `contracts`). Manifests are **server-only**: the landing page sends the browser only the tile fields it needs.

```ts
// src/base/registry/types.ts  (re-exported from @/base/api)
import type { ComponentType } from "react";

export type ModuleId =
  | "obligations" | "finance" | "procurement" | "logistics" | "shifts"
  | "kitchen" | "programming" | "content" | "exports" | "binder";

export type RoleKey = "admin" | "camp_lead" | "finance_approver" | "kitchen_sensitive_viewer"
  | "lnt_lead" | "fire_safety_officer" | "sound_officer" | "mv_dmv_contact" | "information_officer";
export type TeamRole = "lead" | "co_lead" | "member";
export type Capability = `${string}.${string}`;          // "finance.spend.approve"

/** Who may see the tile and open the module. Any one match is enough. */
export type AccessRule =
  | { everyone: true }                                    // every confirmed member of the current edition
  | { role: RoleKey }
  | { team: string; teamRoles?: TeamRole[] }               // team key, e.g. "kitchen"
  | { anyTeamLead: true }
  | { capability: Capability };

export interface NavEntry {
  label: string;
  path: string;                                           // relative to the module route, "" = module home
  access?: AccessRule[];                                  // defaults to the module's access
}

export interface MyItem {
  id: string;                                             // stable, used for de-duplication
  moduleId: ModuleId;
  kind: "shift" | "approval" | "alert" | "ride" | "deadline" | "other";
  title: string;                                          // safe text only, never sensitive fields
  dueAt?: Date;
  urgency: "normal" | "soon" | "overdue";
  href: string;                                           // absolute app path
}

export interface ModuleContext {
  actor: Actor;                                           // resolved server-side from the session
  edition: { id: string; year: number };
  now: Date;                                              // injectable clock for tests
  db: ReadOnlyDb;                                         // read-only handle for the module's own queries
}

export type MyItemsProvider = (ctx: ModuleContext) => Promise<MyItem[]>;

export interface JobDecl {
  id: `${ModuleId}.${string}`;
  schedule: "every_tick" | "hourly" | `daily@${string}`;  // daily@07:00 = 07:00 camp time
  run: () => Promise<{ default: JobFn }>;                  // lazy import keeps manifests light
}

export interface ExportHook {
  /** Tables (and the columns to blank) for the edition ZIP. */
  tables: { name: string; sensitiveColumns?: string[] }[];
  /** Optional extra files (e.g. printable PDFs) added to the ZIP. */
  extraFiles?: () => Promise<{ default: ExtraFilesFn }>;
}

export interface BinderSectionDecl {
  id: `${ModuleId}.${string}`;
  title: string;
  order: number;                                          // position in the Binder
  audience: "everyone" | "leads" | "admins";
  render: () => Promise<{ default: BinderSectionRenderer }>; // returns react-pdf + html parts
}

export interface ModuleManifest {
  id: ModuleId;
  name: string;                                           // tile title, "Finance"
  description: string;                                    // one line under the tile title
  icon: string;                                           // lucide icon name, "wallet"
  route: `/${string}`;                                    // "/finance"
  tablePrefix: `${string}_`;                              // "finance_"
  access: AccessRule[];                                   // tile visibility + module entry
  permissions: readonly Capability[];                     // every capability this module checks
  nav: NavEntry[];
  tile?: { order: number; badge?: (ctx: ModuleContext) => Promise<number | null> };
  myItems?: MyItemsProvider;                               // optional "my stuff" feed
  taskKinds?: { key: `${ModuleId}.${string}`; label: string }[];
  notificationTypes?: { key: `${ModuleId}.${string}`; label: string; canMute: boolean }[];
  events?: {
    emits?: readonly string[];                            // names from contracts/events/<id>.ts
    handles?: Record<string, () => Promise<{ default: EventHandler }>>;
  };
  jobs?: JobDecl[];
  exports?: ExportHook;
  binderSections?: BinderSectionDecl[];
  flag: { defaultEnabled: boolean; pilotOnly?: boolean };
}
```

Rules for manifests:
- `id`, `route` and `tablePrefix` never change after the first migration ships.
- `myItems` returns **non-task** items only (shift sign-ups, approvals waiting, ride matches, deadlines). Tasks are base data and the landing page already shows them, so a module returning its tasks would duplicate them.
- `badge` and `myItems` must answer in under 300 ms on seeded data. The landing page gives each provider 1.5 s, then shows "Finance couldn't load" for that module instead of failing the page.

---

## 4. Permissions and the server-side guard

### 4.1 Declaring capabilities
A module declares its capabilities in `permissions.ts` as pure functions of the actor and the resource. The base computes the actor (roles, team memberships, edition status) once per request.

```ts
// src/modules/finance/permissions.ts
import { definePermissions, type Actor } from "@/base/api";
import type { ApprovalStep } from "./rules/approval-policy";

export const financePermissions = definePermissions("finance", {
  "finance.view": (a: Actor) => a.isConfirmedMember,
  "finance.spend.request": (a: Actor, r: { teamId: string }) => a.isMemberOf(r.teamId),
  "finance.spend.approve": (a: Actor, r: { requesterId: string; step: ApprovalStep }) =>
    a.personId !== r.requesterId && a.canFillApprovalStep(r.step),   // nobody approves their own
  "finance.report.view": (a: Actor) => a.hasRole("finance_approver") || a.hasRole("camp_lead") || a.isAnyTeamLead,
});
```

Base-provided capabilities modules may reuse (never redefine): `task.edit`, `task.claim`, `member.view_contacts`, `admin.settings`. Module capabilities are always prefixed with the module id (the kitchen's named-allergy access is `kitchen.dietary.view_named`).

### 4.2 Using the guard
Every mutation and every data read that isn't public to all members goes through one of three helpers. They resolve the session, check the module flag, check the module `access`, check the capability against the resource, open a transaction, and give you the base APIs bound to that transaction.

```ts
// src/base/api (shape)
export function moduleAction<I, O>(
  moduleId: ModuleId,
  opts: { input: ZodType<I>; capability: Capability; resource?: (input: I, ctx: ModuleContext) => Promise<unknown> },
  fn: (ctx: ActionContext, input: I) => Promise<O>,
): (input: I) => Promise<O | ActionFailure>; // ActionFailure = { ok: false; code; error }

export function guardModuleLayout(moduleId: ModuleId): (props: { children: ReactNode }) => Promise<ReactNode>;
export async function requireCapability(ctx: ModuleContext, cap: Capability, resource?: unknown): Promise<void>; // throws Forbidden
```

`ActionContext` = `ModuleContext` + `tx` (Drizzle transaction) + `tasks`, `notify`, `alerts`, `audit`, `events`, `documents`, `people` (safe fields only) bound to `tx`.

Rules:
- Refuse with `throw new ValidationError("plain words")` (or `ForbiddenError`) inside the handler. The guard turns it into a **returned** `{ ok: false, code, error }`, because Next.js hides the message of anything thrown from a server action in production. Client code checks `isActionFailure(r)` (from `@/base/api/action-result`) and shows `r.error`. Anything else thrown is a bug and still throws. Tests use `ok(action(...))` from `@/base/api/testing` to unwrap.
- Pages call `requireCapability` before loading anything not visible to every member. Queries filter by what the actor may see (e.g. finance detail only for that team's leads), so a crafted URL gets nothing.
- Never pass a sensitive field to a client component unless the actor has the capability. Client code may hide buttons using a `can` map the server computed, but the server re-checks.
- A test generated from the manifest asserts that every declared capability has at least one allow and one deny case (§11).

---

## 5. Database rules

| Rule | Detail |
|---|---|
| Prefix | Every table, enum and view the module creates starts with its `tablePrefix`: `finance_spend_requests`, `finance_spend_status` (enum), `finance_v_budget_summary` (view). Base tables are unprefixed, and no module may add an unprefixed table. |
| Foreign keys | Only to the module's own tables or to base tables (`people`, `editions`, `edition_members`, `teams`, `projects`, `tasks`, `documents`). Never to another module's table. |
| Soft references | To point at another module's row, store `<name>_ref_type varchar(40)` + `<name>_ref_id uuid` with no FK, e.g. `source_ref_type = 'procurement.need'`. Type names live in `contracts/refs.ts`. The owning module tells you if the row changes or disappears, through an event. Show a fallback ("item no longer listed") when the ref can't be resolved. |
| Conventions | Same as `DATA_MODEL.md` §0: UUIDv7 ids, `created_at/updated_at/deleted_at/version`, money as integer cents + currency, `timestamptz`, soft deletes, `on delete restrict` for anything financial or audited. |
| Migrations | One Drizzle schema file and one migrations folder per module, with its own migrations table (`__drizzle_migrations_<id>`). `pnpm db:migrate` runs base first, then every module in alphabetical order. Because modules never reference each other, order between modules doesn't matter. Migrations run even when a module's flag is off, so switching it on never needs a deploy. |
| Changing base tables | A module never alters a base table. If it needs a new base column, that is a base PR with a base migration. Module-specific data about a person or task goes in the module's own table keyed by the base id (e.g. `shift_member_quotas.edition_member_id`). |
| Removing a module | Delete the folder, remove it from `modules/index.ts`, and keep a final migration that drops its tables (run by a one-off script). Base keeps any tasks, notifications and audit rows the module created; they still render, with the module name shown as "retired". |
| Sensitive columns | Declared in the export hook's `sensitiveColumns` and in the module README. Reading them by name writes an audit event (`<id>.<entity>.viewed_sensitive`). |

```ts
// src/modules/<id>/drizzle.config.ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/finance/schema.ts",
  out: "./src/modules/finance/migrations",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED! },
  migrations: { table: "__drizzle_migrations_finance", schema: "public" },
  tablesFilter: ["finance_*"],
});
```

B0 must prove this works with drizzle-kit's current version (generate, migrate and `check` per module, with a module schema that references base tables but doesn't re-export them). If it doesn't, the fallback is one shared migrations folder with a CI check that each migration file only touches one prefix.

---

## 6. Using base services (tasks, notifications, alerts, audit, documents)

A module never writes to base tables directly. It calls the base API it got in `ActionContext`, inside the same transaction as its own writes, so either everything commits or nothing does.

```ts
// inside a moduleAction handler
const task = await ctx.tasks.create({
  projectId,                                  // base project; a module may create its own projects via ctx.tasks.createProject
  kind: "finance.purchase",                   // must be listed in manifest.taskKinds
  title: `Buy: ${input.title}`,
  ownerPersonId: ctx.actor.personId,
  dueAt: input.neededBy,
  source: { refType: "finance.spend_request", refId: request.id },  // soft ref back to the module row
});

await ctx.notify.send({
  type: "finance.spend.awaiting_approval",    // listed in manifest.notificationTypes
  to: approverIds,
  title: `Approval needed: ${request.refCode}`, // never include amounts the recipient can't see
  href: `/finance/requests/${request.id}`,
  urgency: "immediate",
});

await ctx.audit.record({
  action: "finance.spend.submitted",
  entity: { type: "finance.spend_request", id: request.id },
  changes: { status: ["draft", "submitted"] },
  significance: "significant",
});
```

| Base API | What a module uses it for | Notes |
|---|---|---|
| `ctx.tasks` | Create/update tasks and projects, link dependencies, open work to volunteers, apply templates | Tasks keep a `source` soft ref back to the module row. The task engine's alert rules (due soon, overdue, unowned, dependency risk) then apply automatically. |
| `ctx.notify` | Direct notifications (assigned, decided, mentioned) | Digesting, preferences, the 100/day email cap and the outbox are the base's job. |
| `ctx.alerts.raise` / `resolve` | Module-specific alert rules (shift gap, load gap, approval waiting) | The base dedupes by (rule, entity, level, fingerprint) and handles escalation (owner → team lead → camp lead) using `alert_rules` params. |
| `ctx.audit.record` | Every money change, permission-relevant change, status change on obligations/milestones, sensitive view, export | Written in the same transaction. The task activity feed reads this too. |
| `ctx.documents` | Upload/attach/sign URLs | Visibility is checked by the base. |
| `ctx.people` | Display names, teams, arrival/departure, skills | Contacts only through `ctx.people.contacts(personId)`, which checks `member.view_contacts`. |
| `ctx.anchors` | Build start, Container Day, event dates | For "build start − 14 days" style dates. |
| `ctx.events.emit` | Tell other modules something happened (§7) | |

---

## 7. Cross-module communication

Modules never call each other. There are three allowed ways to cooperate, in this order of preference:

1. **A shared task.** If the hand-off is "someone needs to do something", create a base task the other team can see and claim. Example: kitchen publishes the Cape Town shopping list as a task for the procurement lead with the list attached.
2. **A domain event.** If the other module needs data to act on, emit an event. The emitter defines the payload in `src/contracts/events/<emitter>.ts`; any module can handle it by listing it in `manifest.events.handles`. The emitter doesn't know or care who listens.
3. **A soft reference.** Store the other module's row id and type to link back (e.g. a logistics load item pointing at a procurement need). Resolve it for display through the owning module's event payloads or a denormalised snapshot, never by querying its tables.

How events run:
- `ctx.events.emit` writes a row to the base `domain_events` table **in the same transaction** as the change (an outbox). After commit, the base dispatches it to each handler right away; anything that fails or times out is retried by the jobs tick with backoff, and after 5 failures it shows on the admin "stuck events" list.
- Handlers are idempotent (they may see the same event twice), run in their own transaction with a system actor, and only write to their own module plus base APIs.
- Handlers in a disabled module are skipped and the delivery is marked `skipped` (no backlog replay when the module is switched on; the module's own "sync now" action covers that if needed).
- Event names are `<emitter>.<entity>.<past-tense verb>`, payloads carry ids plus the few fields a listener needs (no sensitive fields), and a version number. Adding fields is fine; removing or renaming one means a new version.

**Worked example: procurement → logistics → finance, with no imports**

```ts
// src/contracts/events/procurement.ts
import { z } from "zod";
export const procurementEvents = {
  "procurement.need.marked_critical": z.object({
    v: z.literal(1), needId: z.string().uuid(), editionId: z.string().uuid(),
    itemName: z.string(), quantity: z.number(), unit: z.string(), neededBy: z.coerce.date().optional(),
  }),
  "procurement.need.purchase_requested": z.object({
    v: z.literal(1), needId: z.string().uuid(), teamId: z.string().uuid(),
    title: z.string(), estimatedCents: z.number().int(), currency: z.string().length(3),
    supplierName: z.string().optional(), requesterPersonId: z.string().uuid(),
  }),
} as const;

// src/contracts/events/finance.ts
export const financeEvents = {
  "finance.spend.decided": z.object({
    v: z.literal(1), spendRequestId: z.string().uuid(), refCode: z.string(),
    decision: z.enum(["approved", "rejected"]),
    source: z.object({ refType: z.string(), refId: z.string().uuid() }).optional(),
  }),
} as const;
```

- Procurement flags a generator as critical → emits `procurement.need.marked_critical`. Logistics handles it by creating an **unassigned** `logistics_load_items` row (soft ref to the need). Logistics' own load-gap job then alerts if it has no load or destination 10 days before Container Day.
- Procurement turns a gap into a purchase → emits `procurement.need.purchase_requested`. Finance handles it by creating a draft spend request with a soft ref back. When it's approved or rejected, finance emits `finance.spend.decided`; procurement handles it and moves the need to `to_buy` or back to `needed`.
- If finance is switched off, procurement still works: the need just stays "purchase requested" and a lead handles it by hand.

---

## 8. Scheduled jobs

- Declared in `manifest.jobs`. The base `/api/jobs/tick` runs every enabled module's due jobs, one at a time, each with a time budget (default 20 s) and a `job_runs` row. It runs every 15 minutes on Vercel Pro (daily on Hobby) plus the hourly GitHub Actions backstop.
- Jobs MUST be idempotent: running twice in a row changes nothing the second time. Use `ctx.alerts.raise` (deduped by the base) rather than sending notifications directly.
- Jobs receive an injected clock (`ctx.now`) so tests can fast-forward.
- Jobs work in batches and record progress, so a timeout picks up where it stopped.
- Alert-style jobs read thresholds from the base `alert_rules` table (key `<module>.<rule>`), so leads can tune them without a deploy.

---

## 9. Export hooks (knowledge export and Burn Binder)

- **Knowledge export** (`exports` module): for the edition ZIP, the exports module asks the registry for every enabled module's `exports.tables` and writes one CSV and one JSON file per table into `/<module>/`, plus `extraFiles` (e.g. the printable timetable) and a README listing tables and columns. Columns in `sensitiveColumns` are blanked unless an admin ticks "include sensitive" (audited). The exports module never imports a module; it uses the registry and a read-only export reader the base provides.
- **Burn Binder** (`binder` module): the Binder asks the registry for every enabled module's `binderSections`, sorts by `order`, and calls each renderer with the Binder config (which contacts may be shown, which days). Each renderer returns a react-pdf fragment and an HTML fragment of the same content, black-and-white and A4-legible. A section that throws is replaced by a clearly marked "section failed: regenerate" page so the rest of the Binder still prints.
- A module with nothing for the Binder simply omits `binderSections`.

```ts
// src/base/api (shape)
export type BinderSectionRenderer = (ctx: BinderContext) => Promise<{ pdf: ReactElement; html: string }>;
export interface BinderContext extends ModuleContext {
  days: Date[]; contactVisibility: "leads_and_emergency" | "none";   // ctx.db is read-only here
}
```

---

## 10. UI conventions

- **Components:** shadcn/ui from `src/components/ui` only; module-specific components in the module's `ui/components`. No other UI library. Icons from lucide.
- **Mobile first:** design at 360 px wide first. Tap targets at least 44 px. Tables become stacked cards under 640 px. The primary action for a screen is reachable with one thumb.
- **Server first:** pages are server components; client components only for interaction. Forms use zod schemas shared with the server action and show server errors inline.
- **Printable views:** every list a lead might print (rota, shopping list, load sheet, timetable, budget summary) has a `/print` sub-route with a print stylesheet: A4, black and white, no navigation, "generated at" timestamp and edition, page numbers.
- **Consistency:** module home = a short summary plus the module's main list; "My …" filters first; empty states say what to do next; dates shown in camp time (`Africa/Johannesburg`) with a label, with the viewer's own zone on hover/tap when different.
- **Navigation:** the app shell renders the module's `nav` entries; a module never builds its own top-level navigation.
- **Accessibility basics:** labels on inputs, visible focus, colour never the only signal (status also as text or icon).

---

## 11. Testing and definition of done

A module PR is done when:
- [ ] `manifest.ts` validates at boot; README lists tables, events emitted/handled, jobs, Binder sections and open questions.
- [ ] Boundaries lint and `pnpm check:modules` pass (no cross-module imports, prefixed tables, FKs only to own/base tables, guarded route folder).
- [ ] Migrations generated for this module only, and `drizzle-kit check` passes for its config.
- [ ] **Unit tests** for everything in `rules/` (pure functions, no DB).
- [ ] **Permission tests**: generated from `manifest.permissions`, at least one allow and one deny per capability, run against the seeded roles; plus a crafted-request test proving the server refuses what the UI hides.
- [ ] **Event tests**: each handler handles a duplicate delivery without double-writing; each emitted event validates against its contract.
- [ ] **Job tests**: each job run twice with a fast-forwarded clock fires once; thresholds come from `alert_rules`.
- [ ] **Flag test**: with the module switched off, its tile is gone, its routes 404, its actions return Forbidden, its jobs and handlers are skipped, and the rest of the test suite still passes.
- [ ] **Export test**: the export hook's tables round-trip into an empty database; sensitive columns are blank by default.
- [ ] **Delete test** (run in CI weekly, not per PR): build and test the app with this module removed from `modules/index.ts`.
- [ ] `seed.ts` adds realistic data for the 100-person seed, and a 5-minute demo script is in the PR description.
- [ ] Phone check: the module's main flow works at 360 px; its print views print on A4.

---

## 12. Feature flags (switching a module on or off)

- One row per module in the base `module_settings` table: `enabled`, `audience` (`everyone` | `pilot` | `admins`), `updated_by`, `updated_at`. Default comes from `manifest.flag`. Admins change it on **Settings → Modules**; every change is audited.
- `pilot` audience: only people with the `pilot` tag (set by admins) see the tile and can enter, which is how Remo, Jory and a logistics lead can try a module before everyone else.
- Environment override for previews and tests: `MODULES_DISABLED=kitchen,programming`.
- Switching off never deletes data or tasks. Tasks the module created stay visible in base views, labelled with the module name, but their deep links show "this module is switched off".
- Flags are module-level only. Feature toggles inside a module are ordinary settings in that module's tables, not more flags.

---

## 13. Example module skeleton

A tiny but real module: **`obligations`** (AfrikaBurn deadlines). It adds one detail table on top of base tasks, declares two capabilities, shows a tile to everyone, feeds "my stuff" with deadlines the user owns, raises an escalation job, exports its table and adds a Binder section.

```ts
// src/modules/obligations/manifest.ts
import "server-only";
import type { ModuleManifest } from "@/base/api";
import { obligationsPermissions } from "./permissions";
import { myObligations } from "./server/my-items";

export const manifest = {
  id: "obligations",
  name: "AfrikaBurn deadlines",
  description: "Registrations, WAPs, MV paperwork, safety plans",
  icon: "calendar-check",
  route: "/obligations",
  tablePrefix: "obligation_",
  access: [{ everyone: true }],
  permissions: obligationsPermissions.keys,
  nav: [
    { label: "All deadlines", path: "" },
    { label: "Mine", path: "mine" },
    { label: "Print", path: "print", access: [{ anyTeamLead: true }] },
  ],
  tile: { order: 20 },
  myItems: myObligations,
  taskKinds: [{ key: "obligations.obligation", label: "AfrikaBurn obligation" }],
  notificationTypes: [{ key: "obligations.due", label: "AfrikaBurn deadline coming up", canMute: false }],
  events: { emits: ["obligations.obligation.submitted"] },
  jobs: [{ id: "obligations.escalate-unconfirmed", schedule: "daily@07:00", run: () => import("./jobs/escalate-unconfirmed") }],
  exports: { tables: [{ name: "obligation_details" }] },
  binderSections: [{
    id: "obligations.exit-checklist", title: "AfrikaBurn exit sign-off", order: 90, audience: "leads",
    render: () => import("./binder/exit-checklist"),
  }],
  flag: { defaultEnabled: true },
} satisfies ModuleManifest;
```

```ts
// src/modules/obligations/schema.ts
import { pgTable, pgEnum, uuid, text, boolean, date, timestamp } from "drizzle-orm/pg-core";
import { tasks } from "@/base/api/schema";      // base tables are exported read-only for FKs

export const obligationAuthorityEnum = pgEnum("obligation_authority",
  ["afrikaburn", "dmv", "fuel_team", "sound_team", "supplier_depot", "quicket", "internal"]);

export const obligationDetails = pgTable("obligation_details", {
  taskId: uuid("task_id").primaryKey().references(() => tasks.id, { onDelete: "restrict" }), // FK to BASE only
  authority: obligationAuthorityEnum("authority").notNull(),
  category: text("category").notNull(),
  sourceUrl: text("source_url"),
  sourceDocSlug: text("source_doc_slug"),
  dateConfirmed: boolean("date_confirmed").notNull().default(false),
  previousYearDate: date("previous_year_date"),
  requiredDocuments: text("required_documents").array().notNull().default([]),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  confirmationRef: text("confirmation_ref"),
});
```

```ts
// src/modules/obligations/permissions.ts
import { definePermissions, type Actor } from "@/base/api";

export const obligationsPermissions = definePermissions("obligations", {
  "obligations.view": (a: Actor) => a.isConfirmedMember,
  "obligations.manage": (a: Actor) => a.hasRole("camp_lead") || a.hasRole("admin") || a.isAnyTeamLead,
});
```

```ts
// src/modules/obligations/rules/status.ts  (pure: no db, no next)
export type DueLabel = { text: string; tentative: boolean };

export function dueLabel(dueAt: Date | null, confirmed: boolean, previousYear: string | null): DueLabel {
  if (!dueAt) return { text: "No date yet", tentative: true };
  if (confirmed) return { text: dueAt.toISOString().slice(0, 10), tentative: false };
  return { text: previousYear ? `TBC (2026: ${previousYear})` : "TBC", tentative: true };
}
```

```ts
// src/modules/obligations/server/actions.ts
"use server";
import { z } from "zod";
import { moduleAction } from "@/base/api";
import { obligationDetails } from "../schema";
import { eq } from "drizzle-orm";

export const markSubmitted = moduleAction(
  "obligations",
  { input: z.object({ taskId: z.string().uuid(), confirmationRef: z.string().max(80) }),
    capability: "obligations.manage" },
  async (ctx, { taskId, confirmationRef }) => {
    await ctx.tx.update(obligationDetails)
      .set({ submittedAt: ctx.now, confirmationRef })
      .where(eq(obligationDetails.taskId, taskId));
    await ctx.tasks.update(taskId, { status: "done" });              // base API, same transaction
    await ctx.audit.record({
      action: "obligations.obligation.submitted",
      entity: { type: "obligations.obligation", id: taskId },
      changes: { confirmationRef: [null, confirmationRef] },
      significance: "significant",
    });
    await ctx.events.emit("obligations.obligation.submitted", { v: 1, taskId, confirmationRef });
  },
);
```

```ts
// src/modules/obligations/server/my-items.ts
import type { MyItemsProvider } from "@/base/api";
import { unconfirmedOwnedBy } from "./queries";            // the module's own read queries
// Tasks already appear on the landing page from base, so this provider adds only
// unconfirmed AfrikaBurn dates the user owns, which need a "check the date" nudge.
export const myObligations: MyItemsProvider = async (ctx) => {
  const rows = await unconfirmedOwnedBy(ctx.db, ctx.edition.id, ctx.actor.personId);
  return rows.map((r) => ({
    id: `obligations:${r.taskId}:confirm`, moduleId: "obligations", kind: "deadline",
    title: `Confirm the 2027 date: ${r.title}`, urgency: "normal",
    href: `/obligations/${r.taskId}`,
  }));
};
```

```ts
// src/modules/obligations/jobs/escalate-unconfirmed.ts
import type { JobFn } from "@/base/api";
import { unconfirmedDueWithin } from "../server/queries";
// Idempotent: alerts.raise dedupes on (rule, entity, level, fingerprint).
const job: JobFn = async (ctx) => {
  const rows = await unconfirmedDueWithin(ctx.db, ctx.edition.id, ctx.now, 30);
  for (const r of rows) {
    await ctx.alerts.raise({
      rule: "obligations.unconfirmed_date", entity: { type: "obligations.obligation", id: r.taskId },
      level: 2, fingerprint: String(r.dueAt), to: "camp_lead",
      title: `AfrikaBurn date still unconfirmed: ${r.title}`, href: `/obligations/${r.taskId}`,
    });
  }
  return { checked: rows.length };
};
export default job;
```

```tsx
// src/app/(app)/obligations/layout.tsx
import { guardModuleLayout } from "@/base/api";
export default guardModuleLayout("obligations");

// src/app/(app)/obligations/[[...slug]]/page.tsx
export { default } from "@/modules/obligations/ui/router";
```

```ts
// src/modules/index.ts  (composition root: the only file importing every manifest)
import { manifest as obligations } from "./obligations/manifest";
import { manifest as finance } from "./finance/manifest";
// ...
export const modules = [obligations, finance /* , ... */] as const;
```

```ts
// src/modules/obligations/tests/permissions.db.test.ts
import { permissionMatrix } from "@/base/api/testing";
import { manifest } from "../manifest";
permissionMatrix(manifest, {
  "obligations.view":   { allow: ["member", "team_lead", "admin"], deny: ["waitlisted", "alumni"] },
  "obligations.manage": { allow: ["team_lead", "camp_lead", "admin"], deny: ["member"] },
});
```

---

## 14. How the landing page uses all this

1. On every request the base loads the registry, drops modules whose flag is off or whose audience excludes the user, then evaluates each manifest's `access` **on the server** against the user's roles and teams. Only the remaining tiles (name, description, icon, route, badge number) are sent to the browser.
2. The **"my stuff" strip** at the top merges: the user's base tasks (owned, helping, claimed), unread notifications and open alerts, and each permitted module's `myItems` (run in parallel, 1.5 s timeout each). Items are de-duplicated by `id`, sorted overdue → soon → by due date, capped at 10 with "see all" to `/me`.
3. Below the tiles: pinned announcements and quick links (camp guide, WhatsApp group links shown as plain links for confirmed members).
4. Opening a tile goes to the module route, where `guardModuleLayout` checks again. A user who types a URL for a module they can't see gets a 404, not a hint that it exists.
