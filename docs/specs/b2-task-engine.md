# Spec B2: shared task engine, notifications, digests, simple dashboards

**Status:** draft for Ruchir's review (13 Oct 2026, ET). **Slice:** `docs/PLAN.md` §4.2, §4.3 and B2.
**Tables:** `docs/DATA_MODEL.md` §3 (work engine) and §12 (notifications, alerts, outbox, jobs).
**Contract for modules:** `docs/MODULE_RULEBOOK.md` §6 (`ctx.tasks`, `ctx.notify`, `ctx.alerts`).
**Code:** `src/base/engine/` (tasks, dependencies, claiming), `src/base/notifications/`
(notifications, alerts, digests, outbox), `src/base/jobs/` (tick). Screens under `src/app/(app)/`.

This spec covers the **core** of B2. Templates, recurrence, attachments (R2), board/calendar views,
search and the landing-page "my stuff" design are **later slices** (§7).

## 1. What this part of B2 delivers

- **Projects** owned by a team, optionally nested one level (workstreams), with a lead and a status.
- **Tasks** in a project: title, description, status (`todo` → `in_progress` → `done`, or
  `blocked` with a reason, or `cancelled`), priority (`must`/`should`/`could`), one accountable
  **owner** (or none = unowned), due date, `is_critical`, kind (base `task`/`milestone`, or a kind a
  module registered), optional source soft-reference to a module row.
- **Dependencies** (finish-to-start) between tasks. A loop is refused.
- **Helpers and claims:** a lead adds helpers, or opens a task to volunteers (`open` or
  `open_with_approval`, with a number of helpers wanted). A confirmed member claims it.
- **Checklist items, comments, watchers** on a task.
- **Notifications:** an in-app notification centre, per-person preferences, and an **email outbox**.
  In this slice the outbox is sent through the existing **dev console / memory adapter only**: nothing
  leaves the box, no email provider account, no real sends.
- **Alert rules** with dedupe and escalation, run by a **jobs tick** function (no deployed cron in
  this slice): due soon, overdue (owner → team lead → camp lead), unowned, dependency risk.
- **Digests:** non-urgent notifications grouped into one email per person, skipped when empty.
- **Plain screens:** My tasks (owned / helping / overdue), a project's task list with simple forms,
  a task page, the notification centre, and a simple readiness table per team for leads.

## 2. Ground rules

1. **One engine.** Everything "someone has to do by a date" is a base task. Modules create and
   update tasks only through the base API (`ctx.tasks`) inside their transaction.
2. **Server-side permissions, per action and per record** (AGENTS.md rule 4). Hidden buttons are
   decoration. A crafted request for someone else's record is refused.
3. **Deterministic rules, no AI.** Every alert rule is a pure function `(now, facts) → alerts` with
   unit tests, run by an idempotent job. Running the tick twice changes nothing the second time.
4. **Clock is injectable** (`now`) everywhere, so tests fast-forward time.
5. **Camp time.** Due dates are instants (`timestamptz`), shown in camp time (SAST).
6. **Quiet by default.** At most one digest per person per day; immediate email only for things
   needing that person's action (assigned to you, claim decided, approvals later).
7. **No sensitive fields** in notification titles, bodies or email payloads (contacts, diets).
8. Every task status change, owner change, claim decision and dependency change writes an
   `audit_events` row in the same transaction (the activity feed reads it).

## 3. Capabilities (base)

"Lead of T" = `lead` or `co_lead` of team T this edition. Camp lead = `camp_lead` role. Admins pass
every base capability. The resource is the task's or project's **owning team**, plus its owner.

| Capability | Resource | Allowed |
|---|---|---|
| `task.view` | none | Confirmed members (every confirmed member sees every base task: work is open by default) |
| `project.manage` | `{teamId}` | Camp lead; leads of that team (create/rename/close a project) |
| `task.create` | `{teamId}` | Camp lead; leads **and members** of that team |
| `task.manage` | `{teamId}` | Camp lead; leads of that team (set owner, helpers, claim mode, decide claims, dependencies, cancel) |
| `task.edit` | none, or `{teamId, ownerPersonId}` | Without a resource: unchanged from B0 (confirmed member). With one: `task.manage`, or the task's owner (title, description, status, due date, checklist) |
| `task.claim` | none | Confirmed members (unchanged); the engine also checks the task is open and has room |
| `task.comment` | none | Confirmed members |
| `readiness.view` | none, or `{teamId}` | Camp lead (camp-wide); leads of that team (their team) |

## 4. Behaviour (Given / When / Then)

### Tasks and projects
- **T1** Given a lead of Gift Projects, when they create the project "Cloud" for Gift Projects, then
  it exists with them as project lead and is audited (`project.created`). **(deny)** A plain member,
  or the lead of another team, is refused.
- **T2** Given a member of Gift Projects, when they add a task to "Cloud", then it's created as
  `todo`, unowned unless they set themselves, and audited (`task.created`). **(deny)** A member of
  another team gets Forbidden; a waitlisted person too.
- **T3** Given a task, when its status becomes `blocked` without a reason, then it's refused with a
  validation message. With a reason it's saved. Leaving `blocked` clears the reason.
- **T4** When a task becomes `done`, `completed_at` is stamped; when it's reopened, it's cleared.
- **T5** Given the owner of a task, when they change its title, due date or status, it works. **(deny)**
  When they try to change its owner or cancel it, it's refused (that's `task.manage`). A member who
  isn't the owner or a lead of the team can't edit it at all (crafted request → Forbidden).
- **T6** A task's `kind` must be `task`, `milestone` or a kind registered in a module's manifest
  (registered kinds stay valid while a module is switched off); anything else is refused.
- **T7** Changing a task's owner notifies the new owner (`task.assigned`, immediate) and is audited
  (`task.owner_changed`).

### Dependencies
- **D1** Given tasks A and B in the same edition, when a lead makes B depend on A, then the link is
  saved and audited (`task.dependency_added`).
- **D2** A task can't depend on itself, and a link that would close a loop (A→B→C→A) is refused with
  "That would create a loop". The check runs inside the insert transaction.
- **D3** Adding the same dependency twice is a no-op, not an error.
- **D4 (at risk)** A task is **at risk** when any prerequisite is not done and is overdue or
  blocked (PLAN.md §4.2).

### Helpers and claims
- **C1** Given a task with `claim_mode = open` and room (`claim_capacity` 2, 1 active helper), when a
  confirmed member claims it, then they become an active helper and it shows in their My tasks.
- **C2** With `open_with_approval`, a claim starts `pending_approval`; a lead approves or declines it;
  the claimer is notified (`claim.decided`, immediate). Nobody approves their own claim.
- **C3 (deny)** Claiming a `closed` task, a full task, a `done`/`cancelled` task, or claiming twice is
  refused with a readable message. A waitlisted person can't claim (Forbidden).
- **C4** A helper can withdraw their own claim; a lead can remove a helper.

### Checklist, comments, watchers
- **K1** The owner, helpers and leads of the team can tick checklist items (`done_by`, `done_at`).
- **K2** Any confirmed member can comment. Comment authors and owners are added as watchers; watchers
  get a digest notification on new comments (not the comment author).
- **K3** A member can watch or unwatch any task they can see.

### Alerts, escalation, notifications (fast-forwarded clock in tests)
- **A1 Due soon:** an open task (not done/cancelled) with an owner, due in ≤ 3 days, notifies the owner
  once at "3 days" and once at "1 day" (`alert_rules.due_soon.params.days_before`, default `[3,1]`).
- **A2 Overdue:** once it's past due (the first tick after the due time), the owner gets `task.overdue` (level 0). After 3 more days, the
  leads of the project's team (level 1). After 7 days, the camp leads (level 2). A **milestone** or a
  critical task skips straight to level 2 as well. Params: `escalate_after_days` default `[3,7]`.
- **A3 Unowned:** an open task due within 14 days with no owner notifies the team leads (level 1);
  7 days later (i.e. once it's due within 7 days, or overdue), the camp leads too (level 2).
- **A4 Dependency risk:** an open task due within 14 days whose prerequisite is overdue or blocked
  notifies the task's owner and the team leads.
- **A5 Dedupe:** each (rule, task, level, fingerprint) fires once. Re-running the tick sends nothing
  new. The fingerprint is the due date, so **moving the due date resets** the alert.
- **A6 Resolve:** when the task is done or cancelled, its open alert states are resolved and nothing
  more fires.
- **A7 Disabled rule:** an `alert_rules` row with `enabled = false` fires nothing.
- **N1** Notifications carry a safe title and a link; recipients see only their own (crafted request
  for someone else's → nothing).
- **N2 Preferences:** per type, a person chooses `in_app`, `email_immediate`, `email_digest` or `off`.
  Default: assignments and claim decisions are `email_immediate`; alerts and comments `email_digest`.
- **N3 Outbox:** every email goes through `email_outbox` with a unique dedupe key, so the same email
  is never queued twice. The send job delivers pending rows through the configured adapter (console
  in dev, memory in tests), marks them `sent`, and respects the daily cap (`EMAIL_DAILY_CAP`), leaving
  the rest `pending` for the next day.
- **N4 Digest:** once a day per person (camp time `digest_hour_local`, default 07:00), all their
  undigested `digest` notifications go into **one** email, grouped by type; they're marked digested.
  No email when there's nothing new.
- **J1 Tick:** `runTick(now)` runs the base jobs (alerts, digest, outbox send) one at a time, each
  recording a `job_runs` row with stats, and is safe to run twice.

### Screens (plain markup; landing page design is pending)
- **S1 My tasks** (`/tasks`): my owned tasks and tasks I'm helping on, overdue first, then by due date,
  with "at risk" and "blocked" shown as text. Also "Available work": open tasks I could claim.
- **S2 Project** (`/projects/[id]`): the project's tasks with status, owner, due, plus a form to add a
  task (for those allowed) and links to each task.
- **S3 Task** (`/tasks/[id]`): fields, dependencies, helpers/claims, checklist, comments, and the
  actions the caller is allowed (computed on the server). Others' 404 rules as for every base page.
- **S4 Notifications** (`/notifications`): my notifications, newest first, mark read.
- **S5 Readiness** (`/readiness`): per team, counts of open / unowned / overdue / blocked / at risk /
  done, for camp leads (all teams) and team leads (their teams). **(deny)** plain members: 404.

## 5. Module API (`ctx.tasks`, `ctx.notify`, `ctx.alerts`)
Added to `ActionContext`, bound to the transaction: `tasks.create`, `tasks.update`,
`tasks.createProject`, `tasks.addDependency`; `notify.send({type, to, title, href, urgency})`;
`alerts.raise({rule, entity, level, fingerprint, to, title, href})` and `alerts.resolve(...)`.
Module notification types and alert rule keys must be namespaced (`<module>.<name>`) and declared in
the manifest. Exposed through `@/base/api` once the engine lands.

## 6. Not in this part
Templates and "apply to 2027", recurrence, attachments (R2), board/calendar views, search, a deployed
`/api/jobs/tick` route and cron (built in the automations PR; needs `CRON_SECRET` set in Vercel), a real email provider
(Resend), the landing page "my stuff" strip visuals, task activity feed UI.

## 7. FLAG FOR HUMAN
- **Who sees tasks:** this spec says every confirmed member can see every base task (work is open by
  default; modules restrict their own detail tables). Confirm, or say which tasks should be private.
- **Who can create tasks:** leads *and members* of the owning team (T2). Confirm, or limit to leads.
- **Owner powers:** the owner can edit title, due date, status and the checklist, but not reassign
  or cancel (T5). Confirm.
- **Escalation timings and recipients** follow PLAN.md §4.3 (3 and 7 days; milestones/critical
  straight to the camp lead). PLAN.md §7 lists "reminder frequency defaults (B2)" as still to decide;
  these are placeholders in `alert_rules`, tunable without a deploy.
- **Default notification preferences** (N2) are a guess; PLAN.md says "quiet by default".
