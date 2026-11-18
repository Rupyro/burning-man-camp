# `finance`: Money (budgets, spend requests, approvals, pay-backs)

Spec: `docs/specs/finance.md`.

| | |
|---|---|
| Route | `/finance` (phone list for members, laptop board for leads), `/finance/new`, `/finance/r/<id>` |
| Tile | "Money", order 110, badge = approvals waiting for me |
| Access | everyone (confirmed members); admins see the summary only |
| Capabilities | `finance.view`, `finance.spend.request`, `finance.spend.view`, `finance.spend.approve`, `finance.report.view`, `finance.manage` |
| Tables | `finance_budgets`, `finance_approval_policies`, `finance_spend_requests`, `finance_policy_steps`, `finance_request_steps` (one row per approval step per submit, with its decision), `finance_expenses`, `finance_reimbursements` |
| Migrations | `migrations/`, table `__drizzle_migrations_finance` |
| Task kinds | `finance.purchase` (the requester's "buy it and add the receipt" task) |
| Events emitted | `finance.spend.decided` |
| Events handled | `procurement.need.purchase_requested`: drafts a spend request for the person who asked, with a soft ref to the need (skipped when the team has no budget or no estimate). The decision's `finance.spend.decided` carries that ref as `source`. |
| Export | all finance tables (no bank details are ever stored) |
| Sensitive data | none: no account numbers; pay-back notes are free text like "EFT 12 Mar" |

Open questions: see spec §10.
