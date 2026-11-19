# Spec: Finance module (budgets, spend requests, approvals, receipts, pay-backs)

**Status:** draft for Ruchir's review (16 Oct 2026, ET). **Plan:** `PLAN.md` "Module: Finance"
(was S5), §2 rows 9–10, §4.7. **Tables:** `DATA_MODEL.md` §7. **Rulebook:** `MODULE_RULEBOOK.md`
(finance is the worked example). **Traceability:** row 27 (NR-19, NR-20, FIN-01..51, RPT-06).

## 1. What it is (and isn't)
Each team gets a **budget** for the year. A member asks to spend money with a **spend request**
(`OEA-SR-017`). The request goes through an **approval chain** picked by amount and budget
headroom. Once approved, the requester buys the thing and **records the actual amount** with a
receipt link. If they paid out of pocket, a **pay-back** (reimbursement) is owed until finance marks
it paid. Leads see budget, committed, actual and remaining per team. Every step is audited.

**Not:** member dues, deposits or ticket money (Howler + the dues sheet, out of V1), ledgers,
bank matching (the spike's bank matcher stays parked), bank details of any kind, multi-currency
roll-ups (rand only in V1; the column exists for later).

## 2. Data (`finance_` tables, FKs to base tables only)
- `finance_budgets`: edition, team (null = camp-level), name, `amount_cents bigint`, currency
  (`ZAR`), status (`draft`, `approved`, `closed`), notes. One per team per edition.
- `finance_approval_policies`: edition, name, `min_cents`, `max_cents?`, `within_budget_only`,
  `sort_order`, active. Its approvers are rows in `finance_policy_steps`: policy, `position`,
  `approver_kind` (`team_lead`, `role`), `role_id?` (FK to base `roles`, set exactly for role steps).
- `finance_spend_requests`: edition, `ref_seq` + `ref_code` (unique), budget, team, requester,
  title, justification, `estimated_cents`, currency, supplier name, needed-by date, status
  (`draft`, `submitted`, `needs_info`, `approved`, `rejected`, `cancelled`, `purchased`,
  `closed`), policy, submitted/decided times,
  `task_id?` (the requester's base task), `source_ref_type/id?` (for procurement later), version.
- `finance_request_steps`: the policy's steps **copied at each submit** (a `round`), so policy
  edits don't move the goalposts: request, `round`, `position`, approver kind + role, `status`
  (`pending`, `approved`, `rejected`, `needs_info`), `decided_by_person_id`, `comment`,
  `decided_at`. The waiting step is the first pending one; pending steps exist only while the
  request is `submitted` (a send-back, turn-down or cancel drops the rest of the round). The
  requester is copied in so a DB check stops decider = requester as well as the rule.
- `finance_expenses`: request (optional later; required in V1 screens), payer, paid with
  (`personal`, `camp_card`, `camp_cash`, `supplier_invoice`), `amount_cents`, spent on, description,
  `receipt_url?` (a link, decision F6), category.
- `finance_reimbursements`: one per out-of-pocket expense: payee, amount, status (`owed`, `paid`,
  `declined`), paid at/by, `method_note` ("EFT 12 Mar"; **never account numbers**).

Committed and actual are **computed in queries, never stored**:
- **Committed** = estimates of requests that are `approved` but have no expense yet.
- **Actual** = sum of recorded expenses.
- **Remaining** = budget − committed − actual (can go negative; shown in red).

## 3. Rules (pure, `rules/`, 90% coverage gate)
- **Money:** integer cents. Parse "4500", "4 500", "R4,500.50"; reject negatives, more than two
  decimals and anything over R10 million. Format as "R4,500" / "R4,320.50".
- **Reference:** `OEA-SR-017`, from the camp's `ref_prefix` and a per-edition sequence (ported from
  Ruchir's spike generator, rewritten without the old prefix helper).
- **Policy pick:** active policies in `sort_order`; the first whose range holds the amount, and
  whose `within_budget_only` is satisfied (remaining ≥ amount), wins. Placeholders (decision F1):
  1. up to R1,500 and within budget → team lead;
  2. up to R10,000 and within budget → a finance approver;
  3. anything else (over R10,000 or over budget) → a finance approver, then the camp lead.
- **Who may decide a step:** `team_lead` = a lead or co-lead of the request's team;
  `role:x` = anyone holding role x. A **camp lead may stand in for any step** (the plan's
  delegate). **Nobody decides their own request**, ever, at any step.
- **State machine:** draft → submitted → (approved step by step) → approved → purchased →
  closed. Any step can reject (final) or send back for more info (→ `needs_info`; the requester
  edits and resubmits, which restarts the chain with a fresh policy pick). The requester can
  cancel until it's purchased. Closed = all its pay-backs settled (or none needed).

## 4. Capabilities
| Capability | Who | Notes |
|---|---|---|
| `finance.view` | confirmed members, admins | Their own requests only (no team or camp totals) |
| `finance.spend.request` | confirmed members of the team | Record check: `{ teamId }` |
| `finance.spend.view` | requester; leads of its team; finance approvers; camp leads | Record check per request; others get 404 |
| `finance.spend.approve` | per step (§3) | Record check: `{ requesterId, teamId, approver }`; never the requester |
| `finance.report.view` | finance approvers, camp leads, any team lead | Team leads see their own teams' requests; finance approvers and camp leads see all, plus the CSV export |
| `finance.manage` | finance approvers, camp leads | Set budgets, mark pay-backs paid or declined (not their own) |
Admins get **no money powers** by default (decision F3); they see only their own requests, like members.

## 5. Screens
- **Members (phone-first) `/finance`:** "Money" header; **Waiting for you** (approvals I can
  decide), **My requests** (ref, title, amount, status chip, what's next), a **New request**
  button. No team budgets or camp totals (F2).
- **Leads (laptop-first) `/finance`:** summary counters, team budget cards (budget, spent,
  committed, remaining bar), the approval inbox,
  and a requests table (theirs or all, by permission), plus "Download CSV".
- **New request `/finance/new`:** team (the teams I'm on), what, amount (R), why, supplier,
  needed by; save as draft or submit.
- **Request `/finance/r/<id>`:** amounts, the approval chain with who decided what, comments,
  and the right buttons for the person looking: approve / send back / reject (approvers), submit,
  edit, cancel, record what it cost (requester), mark the pay-back paid (finance).
- **Home:** a "Money" tile (badge = approvals waiting for me) and my-items: "Approve OEA-SR-017",
  "Add the receipt for OEA-SR-017", "OEA-SR-017 was turned down", "Pay back Sam R4,320".

## 6. Shared task engine, audit and events
- On submit the requester gets a **base task** (`finance.purchase`, "OEA-SR-017: buy it and add
  the receipt") in their team's "Spending <year>" project, so it shows on their task list with
  the engine's reminders. Recording the expense marks it done. Cancelling (or putting away a turned-down request)
  closes it: cancelled when a team lead does it, otherwise marked done, because the base only
  lets leads cancel tasks. The project
  is seeded per team; if it doesn't exist and the requester can't create it, no task is made.
- Every change writes an audit row in the same transaction with before/after values
  (`finance.spend.submitted`, `.decided`, `.cancelled`, `finance.expense.recorded`,
  `finance.reimbursement.paid`, `finance.budget.updated`).
- Emits `finance.spend.decided` (v1: spendRequestId, refCode, decision, editionId).
  Handles `procurement.need.purchase_requested` (with procurement): drafts a request for the
  person who asked, with `source_ref_type/id` pointing at the need; the later
  `finance.spend.decided` carries it as `source`. Skipped when the team has no budget.

## 7. Seed (fake, idempotent)
Budgets for every team (Kitchen R60,000, Camp infrastructure R85,000, Gift projects R40,000 …),
the three placeholder policies, and about ten requests in every state, including the plan's demo:
Kitchen's **R4,500 gas bottles** waiting for the finance approver, an approved R900 one
with a receipt, one over budget, one sent back, one turned down, and a pay-back owed.

## 8. Base changes this module needs
A **demo finance approver persona** ("Jules (demo finance approver)", finance team lead +
`finance_approver`) so the role picker can show the approval side. Changes the persona count
tests (4 → 5), which trips test-integrity: needs the `allow-protected-change` label.

## 9. Out of scope (V1)
Receipt photo uploads (no file storage yet; a link to the photo instead), budget lines, batched
pay-backs, euro fees, procurement events, print view, editing policies in the app (seed/SQL only).

## 10. Decisions for Ruchir and the treasurer (defaults in brackets)
- **F1** Approval limits [the plan's placeholders above; the treasurer sets real numbers].
- **F2** Can members see the camp budget by team? **Decided (Ruchir): no.** Members see only
  their own requests. Team budgets and camp totals are for leads (`finance.report.view`) only.
- **F3** Admins approve or pay? [no; only finance approvers and camp leads hold money powers].
- **F4** Camp lead as stand-in for any step [yes]. A camp lead's own big request needs a
  *different* camp lead for the camp-lead step [yes; if there's only one camp lead it waits, and
  we flag it].
- **F5** Who sees a request's details [requester, its team's leads, finance approvers, camp leads].
- **F6** Receipts [a link to the photo (e.g. Drive or WhatsApp) until file storage exists].
- **F7** Rand only in V1 [yes].
