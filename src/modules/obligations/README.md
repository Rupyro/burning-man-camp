# `obligations`: AfrikaBurn deadlines

Spec: `docs/specs/obligations.md`.

| | |
|---|---|
| Route | `/obligations` (board for managers, list for members), `/obligations/<taskId>` |
| Tile | "AfrikaBurn deadlines", order 100, badge = open obligations due within 14 days |
| Access | everyone (confirmed members); admins always |
| Capabilities | `obligations.view` (members), `obligations.manage` (camp lead, admin), `obligations.submit` (the owner, or a manager) |
| Tables | `obligation_details` (1:1 with base tasks of kind `obligations.obligation`); enums `obligation_authority`, `obligation_category` |
| Migrations | `migrations/`, table `__drizzle_migrations_obligations` |
| Task kinds | `obligations.obligation` (overdue escalates to the camp lead on day 1) |
| Events emitted | `obligations.obligation.submitted` |
| Events handled | none |
| My items | "Confirm the 2027 date" for obligations I own whose date is still TBC |
| Jobs | none (base alerts cover due soon / overdue) |
| Export | `obligation_details` (no sensitive columns) |
| Binder | none yet (exit sign-off section comes with the Binder module) |
| Sensitive data | none |

Open questions: see spec §10.
