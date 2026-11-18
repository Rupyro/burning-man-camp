# Spec B3-demo: demo mode for testing and feedback

**Status:** draft for Ruchir's review (13 Oct 2026, ET). Asked for by Ruchir on 13 Oct.

## 1. Switch
- `DEMO_MODE=true` (exactly) turns it on. Default off.
- Even with the flag, demo mode stays **off** unless the database is the fake demo one: every
  person's email is on `@example.test`, and the five personas exist. One real imported member
  (any other domain) turns it off. It fails closed.

## 2. Sign-in
- The login page becomes a themed role picker with five fake personas: **Member** (Sam, Kitchen
  member), **Team lead** (Alex, Kitchen lead), **Diet viewer** (Jo, has `kitchen_sensitive_viewer`),
  **Finance approver** (Jules, Finance lead with `finance_approver`; added with the finance
  module), **Admin**.
- A click calls a public server action, which asks Better Auth for the persona's normal magic link and
  sends the browser to it instead of emailing it. Invite check, session creation and the login
  audit row are the production path; permissions are exactly the persona's.
- With demo mode off, that action refuses and the login page is the usual email form.
- The magic-link form stays in the code, hidden while demo mode is on.

## 3. Banner
Every app page shows "Demo: viewing as <name> — switch role" (back to the picker).

## 4. Data
`pnpm seed:demo` runs `pnpm seed`, then adds (once; re-running is harmless, one transaction):
the personas, three Kitchen projects with late, blocked, in-progress and done tasks owned by the
personas, an open-with-approval task with Sam's pending offer to help, and unread notifications.
Dates are relative to today. Refuses Neon unless `SEED_ALLOW_REMOTE=1`.

## 5. Tests
Flag off by default; picker and endpoint unreachable when off; refused with a real member or
without personas; each persona's allow/deny powers; the link is captured, not emailed.
