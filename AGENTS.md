<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules

This is the Burning Man camp app (adapted from the Oe-aa-sies AfrikaBurn camp app). Follow `docs/MODULE_RULEBOOK.md` (modules import only
`@/base/api`, `@/contracts/*`, `@/components/ui/*`, `@/lib/*`). See `CONTRIBUTING.md`.

## Hard rules (CI enforces most of these)

1. **Spec first.** Build only what the task or an approved spec (`docs/specs/`) says. If the spec is
   missing, ambiguous, or contradicts the code or tests: stop and write `FLAG FOR HUMAN: <reason>`
   in the PR. Don't guess.
2. **Tests first, and never weaken them.** Write or extend tests before the code, in their own
   commit (`test: ...`). After that, don't edit, delete, skip or loosen a test to make it pass.
   No special-casing inputs, changed expectations, extra mocks, or caught-and-ignored errors.
3. **Test/spec conflict = FLAG FOR HUMAN.** If a test looks wrong or conflicts with the spec, stop
   and write `FLAG FOR HUMAN: <test name> — <why>` in the PR instead of working around it.
4. **Permissions on the server, per action and per record.** Every module page goes through
   `guardModuleLayout`/`guardModulePage`; every mutation through `moduleAction` with a capability;
   every query returning someone else's data filters by the caller's permissions. Hidden UI,
   client checks and middleware are not access control.
5. **Every capability gets an allow and a deny test** in the module's `permissionMatrix`, plus a
   "wrong record" test wherever a record id is involved.
6. **Money is integer cents (ZAR)**, never floats. Approvals are state machines with audit rows.
   **Nobody approves their own request.**
7. **Never log medical or dietary data**, and never put it in errors, exports or the Burn Binder
   unless a spec says so. It's read only via the base people API with the explicit capability.
8. **New packages:** verify the package really exists on npmjs.com, is widely used and maintained,
   and is needed. List each one in the PR (name, npm link, why). Prefer what's already installed.
   The PR needs the `new-dependency` label.
9. **No suppressions or shortcuts:** no `any`/`as any`, non-null `!` in `src/`, `@ts-ignore`,
   `eslint-disable`, `biome-ignore`, `sql.raw`, empty `catch`, or `.only`/`.skip`/`it.todo`.
10. **Protected paths** (tests, `.github/`, lint/TS/test/coverage configs, `.semgrep/`,
    `scripts/ci/`, `docs/MODULE_RULEBOOK.md`, this file, auth/authz/guard/audit code, migrations):
    change them only when the task says so. CI fails without the `allow-protected-change` label,
    and only Ruchir adds that label.
11. **Small PRs:** one behaviour, under ~400 changed lines (CI warns at 400, fails at 600 excluding
    the lockfile, migration snapshots and docs). Stack PRs if it gets bigger.
12. **Show evidence:** paste the commands you ran and the tail of their output, and list what was
    not tested.
13. Never touch production data or real credentials.

## Every PR gets a plain-language summary comment

Ruchir doesn't read code; he reads this comment as his review. Post it on the PR (as a comment,
not only in the description) right after opening it, and update it if the PR changes. No jargon
without a one-line explanation. Sections, in this order:

1. **What this PR is** (one or two sentences).
2. **What it does**, in plain words: what a member / lead / admin can now do or will notice.
3. **Risk areas touched:** auth/permissions, money, personal data, database. Say yes/no for each,
   and how it's covered.
4. **How it was checked:** test counts, CI result, what was tried by hand.
5. **Size:** lines changed, with notes on generated files (lockfile, migration snapshots, docs).
6. **Known follow-ups**, including any `FLAG FOR HUMAN`.
7. **What to check as a reviewer (5 min):** the two or three questions only Ruchir can answer.

Example: PR #1, https://github.com/Rupyro/oe-aa-sies-camp/pull/1#issuecomment-6097426341
