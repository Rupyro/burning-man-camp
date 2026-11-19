# Protected-path PRs: approval record

Written Nov 18, 2026 (ET); updated Nov 19, 2026, after the merge run. Each PR below touches
protected paths (migrations, tests, or both). On Nov 18 Ruchir approved all of them, in this
order, so the agent added the `allow-protected-change` label to exactly these PRs. Only #40
also got `large-ok`: with its coverage tests it counted 620 lines, over the 600 limit.

## Status (Nov 19, 2026, about 1:30 AM ET)

Merged (squash), in this order: #16, #17, #18, #30, #34, #39, #42, #20, #21, #26, #27, #32, #35,
#28, #36, #38, #41, #40. Stacked PRs were retargeted to `main` before their base branch was
deleted.

Fixes made on the way, all in protected test files and under the same approval:

- #18: obligations tests expect 12 seeded deadlines (6 event and team deadlines plus the 6
  Burning Man Placement steps), not 6.
- #41 and #40: the global coverage floor (71% branches, 68% functions) failed once the earlier
  modules were on `main`. Added tests for the empty state, the manager view, the demo seed and
  the router, plus `tests/unit/module-tables.test.ts`, which checks that every newer module table
  is prefixed and tied to a year.

The rest of this page is the original queue, kept as the record of what each PR touched and why.

**How to approve one:** read the protected files listed, add the label, mark the PR ready, wait for
every required check to go green, then squash-merge. After each merge, the other open PRs must be
brought up to date (`gh pr update-branch <n>`), because the checks are strict.

**Stacked drafts:** before deleting a merged PR's branch, retarget the PR stacked on it to `main`.
Deleting the base branch closes the stacked PR. Pairs: #16 → #17, #20 → #21, #26 → #27,
#28 → #36, #32 → #35.

**Module drafts share three lines:** `src/modules/index.ts`, the `ModuleId` union in
`src/base/registry/types.ts`, and the expected list in `tests/db/migrations.db.test.ts`. After the
first module draft merges, each later one needs a one-line merge in those files.

**Demo database:** after #16 and #17 merge, reseed the Neon demo database (`DEMO_RESEED=1`) so the
demo camp shows dollars, Pacific time and Burning Man wording.

## Order

### 1. Phase 1 core (the live site keeps AfrikaBurn wording and rand until these merge)

| # | What | Protected files | Why |
|---|---|---|---|
| #16 | Dollars and Pacific time as database defaults; gear owners become ours / borrowed / rented | `src/base/schema/migrations/0013_usd_pacific.sql` (+ meta); `src/modules/finance/migrations/0005_usd.sql` (+ meta); `src/modules/procurement/migrations/0007_neutral_owners.sql` (+ meta); `src/lib/camp-config.test.ts` | Column defaults change from ZAR and Africa/Johannesburg; the owner enum changes (old rows map oeaasies → ours, khoena and shared → borrowed); a new test covers the neutral owners |
| #17 | Burning Man is the default camp ("Your Camp", $, PT, Black Rock City wording); stacked on #16 | 40 existing test files and fixtures, expectations only (list in the PR) | The config flip changes every expected amount, name, date and time zone in tests; the demo logistics seed moves to Black Rock City places, US units and late-August dates (two expectations: the extinguisher's name). No test logic changes |
| #18 | Burning Man Placement steps as tracked deadlines | `src/modules/obligations/migrations/0003_burning_man_authority.sql` (+ meta) | Adds the `burning_man` value to the `obligation_authority` enum. Merge after #17. #17's tests expect 6 seeded deadlines, so #18 then needs one expectation update (12) |

### 2. Tests for work already on main (no app code)

| # | What | Protected files | Why |
|---|---|---|---|
| #30 | Tests for the event packs, water plan and fuel plan | `src/lib/event-packs.test.ts`, `src/lib/water-plan.test.ts`, `src/lib/fuel-plan.test.ts` (all new) | New test files are protected. These also lift branch coverage, which is at the 71% floor |

### 3. Small features carrying their own tests (no schema change)

| # | What | Protected files | Why |
|---|---|---|---|
| #34 | Meal plan with the health-permit check (`/meals`) | `src/lib/meal-plan.test.ts` (new) | Without tests, coverage drops under the floor |
| #39 | First-timer quiz (`/camp/quiz`) | `src/lib/first-timer-quiz.test.ts` (new) | Same |
| #42 | Participation balance (`/shifts/balance`) | `src/modules/shifts/tests/balance.db.test.ts` (new) | Same |

### 4. New modules (each: one additive migration, new tests, and one line in the migrations test)

| # | What | Protected files | Why |
|---|---|---|---|
| #20, then #21 | Tickets and passes, Gate-ready check; #21 adds the forms | `src/modules/tickets/migrations/0000_tickets_init.sql` (+ meta); `src/modules/tickets/tests/{permissions,gate,tickets.db}.test.ts`; `tests/db/migrations.db.test.ts` | New tables and enums; new tests; the migrations test lists every module's migration table. #21 itself touches no protected file |
| #26, then #27 | Sound plan and neighbor log; #27 adds the forms | `src/modules/sound/migrations/0000_sound_init.sql` (+ meta); `src/modules/sound/tests/{permissions,sound,sound.db}.test.ts`; `tests/db/migrations.db.test.ts`. #27: `src/modules/sound/tests/sound.db.test.ts` | Same; #27 adds two asserts that the form shows only to managers |
| #32, then #35 | Safety registers: fuel, flame effects, art burns, stakes; #35 adds the forms | `src/modules/registers/migrations/0000_registers_init.sql` (+ meta); `src/modules/registers/tests/{permissions,registers,registers.db}.test.ts`; `tests/db/migrations.db.test.ts` | Same. #35 touches no protected file |
| #28, then #36 | Camp schedule with the event-guide CSV (Workshops pack); #36 adds the forms | `src/modules/schedule/migrations/0000_schedule_init.sql` (+ meta); `src/modules/schedule/tests/{permissions,schedule,schedule.db}.test.ts`; `tests/db/migrations.db.test.ts`. #36: `src/modules/schedule/tests/schedule.db.test.ts` | Same; #36 mocks `next/navigation` for the forms |
| #38 | Exodus departure schedule and sweep crew | `src/modules/exodus/migrations/0000_exodus_init.sql` (+ meta); `src/modules/exodus/tests/{permissions,exodus,exodus.db}.test.ts`; `tests/db/migrations.db.test.ts` | Same |
| #41 | Art car driver roster (Mutant vehicle pack) | `src/modules/mv/migrations/0000_mv_init.sql` (+ meta); `src/modules/mv/tests/{permissions,mv,mv.db}.test.ts`; `tests/db/migrations.db.test.ts` | Same |
| #40 | Village/HUB shared resources | `src/modules/village/migrations/0000_village_init.sql` (+ meta); `src/modules/village/tests/{permissions,village,village.db}.test.ts`; `tests/db/migrations.db.test.ts` | Same |

Modules are in rough order of when a camp needs them: tickets by February, then sound, safety,
schedule, Exodus, and the pack-only ones (#41, #40) last. Any order works apart from the stacked
pairs.

## Not drafts, but also waiting on Ruchir

- Personal names still in protected files: a comment in `src/base/guard/module-nav.ts`, the
  pilot-audience line in `docs/MODULE_RULEBOOK.md`, and first names used as fake people in test
  fixtures. They are also in the git history copied from the original repo.
- Dependabot PRs #1–#6: untouched on purpose.
- Vercel auto-deploy: the Vercel GitHub app needs access to this repo. Until then, deploys are
  manual.
- Demo database: the `DEMO_RESEED=1` deploy ran after #17 (and the variable was removed), but the
  demo seed only inserts missing rows. Rows seeded under AfrikaBurn stay as they were: the
  anchor dates ("AfrikaBurn opens", April 2027), the AfrikaBurn deadlines, and the logistics
  places and loads (Tankwa site, Cape Town). New modules' demo rows are fine. Clearing the
  demo database and seeding it fresh would fix this. It deletes data (fake only), so it's
  Ruchir's call.
