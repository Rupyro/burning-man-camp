# Contributing

Read [`docs/MODULE_RULEBOOK.md`](docs/MODULE_RULEBOOK.md) before writing a module. It is the
contract; this page is the checklist.

- Tables: [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) · Module specs: [`docs/specs/`](docs/specs/)
  · Decisions: [`docs/adr/`](docs/adr/)
- Work on a branch, open a PR to `main`, keep commits small. CI must be green; don't merge your own
  base or contracts changes once there is a second admin.
- Agents: follow the hard rules in [`AGENTS.md`](AGENTS.md).
- No real member data outside production. No secrets in git, chat or Drive.

## Adding a module (`<id>`)

Copy a small existing module such as `src/modules/applicants/` as a skeleton (see rulebook §13) and then:

1. Rename everything: manifest `id`, `route`, `tablePrefix` (`<id>_`), capabilities (`<id>.<thing>.<verb>`).
2. `schema.ts`: every table, enum and index starts with `<id>_`; FKs only to your own or base tables
   (import base tables from `@/base/api/schema`).
3. `drizzle.config.ts`: `out: ./src/modules/<id>/migrations`, `migrations.table: __drizzle_migrations_<id>`,
   `tablesFilter: ["<id>_*"]`. Then `pnpm db:generate --module <id>` and `pnpm db:migrate`.
4. Add the manifest to `src/modules/index.ts` (the only shared file you touch).
5. Route folder `src/app/(app)/<route>/` with exactly `layout.tsx`
   (`export default guardModuleLayout("<id>")`) and `[[...slug]]/page.tsx`
   (`export { default } from "@/modules/<id>/ui/router"`).
6. Events: add zod payloads to `src/contracts/events/<id>.ts` and spread them into
   `src/contracts/events/index.ts`.
7. Tests: a `permissionMatrix` (allow + deny per capability), a flag-off test, and DB tests using
   `@/base/api/testing-db`.
8. `pnpm lint && pnpm check:modules && pnpm typecheck && pnpm test && pnpm test:db`.

Definition of done: rulebook §11.

## Review: what CI checks, and what Ruchir checks

Nobody reads every line, so the review is split. **Automated gates** catch mechanical problems
and attempts to weaken the checks. **Ruchir** reads a plain-language summary comment and decides
whether the behaviour and the risks are right.

### The PR summary comment (required on every PR)

Right after opening a PR, the author (human or agent) posts a comment titled
"Plain-language summary (for Ruchir's review)" with these sections: what this PR is; what it
does in plain words; risk areas touched (auth/permissions, money, personal data, database); how it
was checked; size, with notes on generated files; known follow-ups; and what to check as a reviewer
in 5 minutes. See [`AGENTS.md`](AGENTS.md#every-pr-gets-a-plain-language-summary-comment) and the
[PR #1 example](https://github.com/Rupyro/oe-aa-sies-camp/pull/1#issuecomment-6097426341).

### CI gates

| Workflow / job | Fails when |
|---|---|
| `ci / check` | lint (Biome + ESLint, any warning), module rules, typecheck (strict + `noUncheckedIndexedAccess`), tests, drizzle check, seed twice, build |
| `security / secrets (gitleaks)` | a secret anywhere in git history |
| `security / sast (semgrep)` | Semgrep CE OWASP / Next.js / React / TypeScript findings, or a repo rule in `.semgrep/camp-rules.yml` (unguarded server action, route handler or module layout; `sql.raw`; logging dietary/medical data) |
| `security / dependency audit` | a high or critical advisory (`pnpm audit`, OSV-Scanner). Accepted exceptions live in `pnpm-workspace.yaml` and `osv-scanner.toml`, each with a reason and expiry |

| `guardrails / protected-paths` | the PR changes tests, `.github/`, lint/TS/test/coverage configs, `.semgrep/`, `scripts/ci/`, the module rulebook, `AGENTS.md`, this file, `package.json` scripts, auth/authz/guard/audit code or migrations, unless labelled `allow-protected-change` |
| `guardrails / test-integrity` | a test file is deleted or edited, the number of tests drops, or a changed test file loses assertions (unless `allow-protected-change`); any `.only`/`.skip`/`.todo`/`xit` is added (no override) |
| `guardrails / hygiene` | added lines contain `as any`, `sql.raw(`, a lint/type/coverage suppression, an empty `catch {}` or `.catch(() => {})`, unless `allow-suppression` |
| `guardrails / pr-size` | more than 600 changed lines (warns above 400), not counting the lockfile, migration snapshots, `docs/` and Markdown, unless `large-ok` |
| `guardrails / new-dependencies` | `package.json` gains a package, unless `new-dependency` |

### Labels: only Ruchir adds them

The labels are the human sign-off. An agent must never add `allow-protected-change`,
`allow-suppression`, `large-ok` or `new-dependency` to its own PR; it asks in the PR summary
comment and explains why. The guardrail script runs from the base branch, so a PR can't loosen
the rules it is judged by. Until GitHub branch protection is on (needs GitHub Pro for a private
repo), a red check doesn't physically block the merge button: don't merge on red.

Run the same checks locally before opening a PR: `pnpm guardrails all --base origin/main`.

Supply chain: pnpm won't resolve a version published less than 3 days ago
(`minimumReleaseAge`), Dependabot opens weekly grouped PRs, and every action is pinned to a commit
SHA.
