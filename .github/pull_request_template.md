<!-- Also post the plain-language summary as a PR comment (AGENTS.md). This description is the
     detailed record; the comment is what Ruchir reviews. -->

## What changed (plain language)
<!-- What a member / lead / admin can now do or will notice. No code talk. -->

## Spec / task
<!-- Link the spec or task. Any FLAG FOR HUMAN items go here. -->

## Risk areas touched
- [ ] Auth / permissions
- [ ] Money
- [ ] Personal data (incl. dietary / medical)
- [ ] Database migrations
- [ ] None of the above

<!-- For each ticked box: one sentence on what changed and how it is tested. -->

## How to demo
<!-- 3–6 steps someone can follow locally (or on a preview) to see it work, as member then lead/admin.
     Include one thing that should be refused. -->

## Test evidence
<!-- New test names (the it("…") strings), deny cases covered, and the tail of:
     pnpm lint && pnpm check:modules && pnpm typecheck && pnpm test && pnpm test:db -->

## New dependencies
<!-- none | name — npm link — why (needs the `new-dependency` label) -->

## Protected paths touched
<!-- none | list + why (needs the `allow-protected-change` label, added by Ruchir) -->

## Not tested / known gaps

## Checklist
- [ ] CI green
- [ ] Plain-language summary comment posted
- [ ] Server-side permission checks on every new page and action (`guardModuleLayout`/`guardModulePage`, `moduleAction`)
- [ ] Permission matrix: an allow and a deny test per new capability (and a wrong-record test where ids are involved)
- [ ] New tables carry the module prefix; FKs only to own or base tables; migration generated per module
- [ ] Flag-off test (route 404, tile gone, handlers skipped)
- [ ] Significant changes write audit rows; money in integer cents; no self-approval
- [ ] No secrets, no real member data, nothing copied from other codebases
