# Spec: Obligations module (AfrikaBurn deadlines)

**Status:** draft for Ruchir's review (15 Oct 2026, ET). **Plan:** `PLAN.md` "Module: Obligations"
(was S4), §4.3 (escalation), §4.7. **Tables:** `DATA_MODEL.md` §10. **Rulebook:** worked example in
`MODULE_RULEBOOK.md`. **Traceability:** row 40 (ORG-01..24, BLD-19..25, LOG-07..09, ORG-24).

## 1. What it is (and isn't)
An **obligation** is something the *camp* owes AfrikaBurn or another authority by a date:
theme-camp registration, WAP requests, MV registration and DMV licensing, sound plan, LNT plan,
fire safety, gas/fuel, water and ice orders, Food Safety Form, supplier registration, final LNT
exit sign-off. Each one is a **base task** (`kind = "obligations.obligation"`) with a 1:1 detail
row. It is **not** per-member dues, deposits, shifts or attendance: member payments are out of V1
(Howler + the dues sheet), shifts are their own module.

## 2. Data
`obligation_details` (module table, FK to base `tasks` only):
`task_id` PK · `key` (stable slug, unique per edition, e.g. `mv_registration`, used for seeding
and the year rollover) · `edition_id` · `authority` (`afrikaburn`, `dmv`, `fuel_team`,
`sound_team`, `supplier_depot`, `quicket`, `internal`) · `category` (`registration`, `wap`,
`mutant_vehicle`, `sound`, `lnt`, `fire_safety`, `gas_fuel`, `water_ice`, `food_safety`,
`supplier`, `tickets`, `exit_signoff`, `other`) · `source_url` · `source_doc_slug` (rules corpus) ·
`date_confirmed` · `previous_year_date` · `submitted_at` ·
`confirmation_ref` · `notes` · timestamps + `version`.

`obligation_documents` (the "You'll need" checklist): `task_id` FK · `position` · `name` (unique
per obligation) · `status` (`needed`, `done`) · `done_at` · `done_by_person_id`.

All obligations live in one base project per edition, "AfrikaBurn obligations <year>" (project
kind `obligations`), owned by the **Camp infrastructure** team (decision D1).

## 3. Rules (pure, `rules/`)
- **Due label:** confirmed date → the date in camp time ("Fri 26 Feb"); unconfirmed with a last-year
  date → "TBC (2026: 28 Feb)"; nothing → "No date yet".
- **State:** `done` (submitted), `late` (open, due passed), `due_soon` (≤ 14 days), `no_owner`,
  `open`. Board sorts late → due soon → no owner → by due date.
- **Escalation:** an overdue obligation goes **straight to the camp lead** (level 2) on day 1, like a
  milestone. Implemented by a manifest flag on the task kind (`escalateOverdueImmediately`), read
  by the base alerts job.

## 4. Capabilities
| Capability | Who | Notes |
|---|---|---|
| `obligations.view` | confirmed members, admins | See the list and each obligation (read-only) |
| `obligations.manage` | admins, camp leads | Assign owner, edit dates/links/documents, confirm a date, reopen |
| `obligations.submit` | confirmed members | **Record check:** only the obligation's owner, or a manager, may mark it submitted |
Base task permissions still apply underneath (`ctx.tasks` runs as the acting person).

## 5. Screens
- **Members (phone-first) `/obligations`:** "Camp deadlines" list in sand cards: title, authority
  chip, due label (TBC shown in the typewriter accent), owner, state chip. "Mine" filter on top.
- **Leads (laptop-first, night theme) `/obligations`:** the same route shows managers a board table
  (late / due soon / no owner / done counts at the top, then rows with owner, due, confirmed?,
  source link, documents).
- **Detail `/obligations/<taskId>`:** fields, required documents, source link, "Mark submitted"
  (with confirmation ref) for the owner/manager; manager form to set owner, due date, confirmed?,
  source link, notes.
- **Home:** an "AfrikaBurn deadlines" tile (badge = open obligations due within 14 days) and a
  "my stuff" nudge for obligations I own whose date is still TBC.

## 6. Audit and events
Every change writes an audit row in the same transaction (`obligations.obligation.updated`,
`.submitted`, `.reopened`, `.owner_changed` via the base). Emits
`obligations.obligation.submitted` (v1: taskId, editionId, confirmationRef).

## 7. Seed (fake, idempotent)
The 12 obligations from the plan with **2026 dates marked tentative** and source links to public
AfrikaBurn pages; a few owned by the fake officers (MV contact, sound officer, fire safety
officer), one late, one submitted, one with no owner. Safe to re-run (`key` is unique).

## 8. Base changes this module needs
1. `ctx.tasks` on the module action context (create, update, setOwner, ensureProject), running the
   existing engine functions in the action's transaction as the acting person.
2. Task kinds may set `escalateOverdueImmediately`; the alerts job passes it to the pure rule.
3. `ModuleSeedContext.tasks`: the same engine helpers acting as the seed admin, so module seeds
   create tasks through the base API, not by writing base tables.

## 9. Out of scope (V1)
Document uploads (R2 not set up; links only), the Binder exit-checklist section (Binder module),
templates/year rollover (base templates slice), any email to AfrikaBurn.

## 10. Decisions for Ruchir
- **D1** Which team owns obligations (default Camp infrastructure; alerts' "team lead" level goes there).
- **D2** Who may manage: default camp leads + admins only. Should officers (MV, sound, fire, LNT)
  edit their own obligation's details, not just mark it submitted?
- **D3** Do members see all obligations (default yes, read-only), or leads only?
- **D4** Conditional ones (Food Safety Form only if gifting food; MV only if the art car goes):
  seed them all and let the camp lead cancel, or leave them out?
- **D5** 2027 dates: who checks AfrikaBurn's site and confirms them, and when?
