import { describe, expect, it } from "vitest";
import {
  addedDependencies,
  checkHygiene,
  checkNewDependencies,
  checkProtectedPaths,
  checkPrSize,
  checkTestIntegrity,
  countAssertions,
  countTests,
  isProtected,
  LABELS,
  scriptsChanged,
} from "./guardrails-lib";

const none: string[] = [];

describe("protected paths", () => {
  it.each([
    ".github/workflows/ci.yml",
    "src/modules/finance/tests/permissions.test.ts",
    "src/base/__tests__/access.test.ts",
    "tests/unit/boundaries.test.ts",
    "vitest.config.ts",
    "biome.json",
    "docs/MODULE_RULEBOOK.md",
    "AGENTS.md",
    "src/base/authz/permissions.ts",
    "src/modules/hello/migrations/0001_x.sql",
    "scripts/ci/guardrails.ts",
  ])("%s is protected", (path) => {
    expect(isProtected(path)).toBe(true);
  });

  it.each(["src/modules/hello/server/actions.ts", "src/lib/dates.ts", "docs/PLAN.md", "README.md"])(
    "%s is not protected",
    (path) => {
      expect(isProtected(path)).toBe(false);
    },
  );

  it("fails without the label, warns with it, and counts renamed-away paths and package scripts", () => {
    const files = [{ status: "R" as const, path: "src/lib/x.ts", from: "tests/x.test.ts" }];
    const blocked = checkProtectedPaths(files, none, true);
    expect(blocked.ok).toBe(false);
    expect(blocked.errors[0]).toContain("tests/x.test.ts");
    expect(blocked.errors[0]).toContain('package.json "scripts"');
    const allowed = checkProtectedPaths(files, [LABELS.protected], true);
    expect(allowed.ok).toBe(true);
    expect(allowed.warnings).toHaveLength(1);
    expect(checkProtectedPaths([{ status: "M", path: "src/lib/x.ts" }], none, false).ok).toBe(true);
  });
});

describe("test integrity", () => {
  const base = {
    files: [],
    labels: none,
    testCountBase: 10,
    testCountHead: 10,
    assertions: [],
    addedTestLines: [],
  };

  it("counts tests and assertions", () => {
    const src = `it("a", () => { expect(1).toBe(1); expect.soft(2).toBe(2); });
      test.each([1])("b %s", () => {}); it.each([1, 2])("c", () => {}); obj.it("x"); expect(3)`;
    expect(countTests(src)).toBe(3); // it(, test.each(…)(, it.each(…)( but not obj.it(
    expect(countAssertions(src)).toBe(3);
  });

  it("passes a clean PR that only adds tests", () => {
    const r = checkTestIntegrity({
      ...base,
      files: [{ status: "A", path: "src/modules/x/tests/new.test.ts" }],
      testCountHead: 12,
    });
    expect(r.ok).toBe(true);
  });

  // Built from parts so this file doesn't trip the very check it tests.
  const dot = (a: string, b: string) => [a, b].join(".");
  it.each([
    `${dot("it", "only")}("x", () => {})`,
    `${dot("describe", "skip")}("x", () => {})`,
    `${dot("it", "todo")}("later")`,
    `${["x", "it"].join("")}("x", () => {})`,
    `${dot("test", "skipIf")}(true)("x", () => {})`,
  ])("always fails on %s, even with the label", (line) => {
    const r = checkTestIntegrity({
      ...base,
      labels: [LABELS.protected],
      addedTestLines: [{ path: "a.test.ts", line }],
    });
    expect(r.ok).toBe(false);
  });

  it("deleted or changed tests, fewer tests, fewer assertions: fail unless labelled", () => {
    const input = {
      ...base,
      files: [
        { status: "D" as const, path: "src/a.test.ts" },
        { status: "M" as const, path: "src/b.test.ts" },
      ],
      testCountHead: 8,
      assertions: [{ path: "src/b.test.ts", base: 5, head: 3 }],
    };
    const blocked = checkTestIntegrity(input);
    expect(blocked.ok).toBe(false);
    expect(blocked.errors.join("\n")).toMatch(
      /deleted[\s\S]*changed[\s\S]*dropped from 10 to 8[\s\S]*from 5 to 3/,
    );
    const approved = checkTestIntegrity({ ...input, labels: [LABELS.protected] });
    expect(approved.ok).toBe(true);
    expect(approved.warnings).toHaveLength(4);
  });
});

describe("hygiene", () => {
  it.each([
    ["src/a.ts", "const x = y as any;"],
    ["src/a.ts", "db.execute(sql.raw(input));"],
    ["src/a.ts", "// eslint-disable-next-line no-console"],
    ["src/a.ts", "// biome-ignore lint/x: y"],
    ["src/a.ts", "// @ts-expect-error"],
    ["src/a.test.ts", "/* v8 ignore next */"],
    ["src/a.ts", "} catch {}"],
    ["src/a.ts", "} catch (e) { }"],
    ["src/a.ts", "p.catch(() => {});"],
    ["src/a.ts", "p.catch((e) => undefined)"],
  ])("flags %s: %s", (path, line) => {
    expect(checkHygiene([{ path, line }], none).ok).toBe(false);
  });

  it("allows as any / sql.raw in tests, ignores non-code files and the checker itself", () => {
    expect(checkHygiene([{ path: "src/a.test.ts", line: "x as any" }], none).ok).toBe(true);
    expect(checkHygiene([{ path: "tests/support/db.ts", line: "sql.raw(x)" }], none).ok).toBe(true);
    expect(checkHygiene([{ path: "AGENTS.md", line: "no `as any`" }], none).ok).toBe(true);
    expect(checkHygiene([{ path: "scripts/ci/x.ts", line: "biome-ignore" }], none).ok).toBe(true);
    expect(checkHygiene([{ path: "src/a.ts", line: "const anyThing = 1" }], none).ok).toBe(true);
  });

  it("the suppression label turns failures into warnings", () => {
    const r = checkHygiene([{ path: "src/a.ts", line: "x as any" }], [LABELS.suppression]);
    expect(r.ok).toBe(true);
    expect(r.warnings).toHaveLength(1);
  });
});

describe("PR size", () => {
  const n = (path: string, added: number) => ({ path, added, deleted: 0 });
  it("excludes lockfile, migration snapshots and docs", () => {
    const r = checkPrSize(
      [
        n("pnpm-lock.yaml", 5000),
        n("src/m/migrations/meta/0001_snapshot.json", 900),
        n("docs/x.md", 900),
        n("README.md", 50),
        n("src/a.ts", 100),
      ],
      none,
    );
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([]);
    expect(r.notes[0]).toMatch(/^100 changed lines/);
  });
  it("warns above 400, fails above 600 unless large-ok", () => {
    expect(checkPrSize([n("src/a.ts", 401)], none)).toMatchObject({
      ok: true,
      warnings: [expect.any(String)],
    });
    expect(checkPrSize([n("src/a.ts", 400)], none).warnings).toEqual([]);
    expect(checkPrSize([n("src/a.ts", 601)], none).ok).toBe(false);
    expect(checkPrSize([n("src/a.ts", 600)], none).ok).toBe(true);
    expect(checkPrSize([n("src/a.ts", 601)], [LABELS.large]).ok).toBe(true);
  });
});

describe("new dependencies", () => {
  const before = { dependencies: { zod: "^4" }, devDependencies: { vitest: "^5" } };
  it("lists only added names (version bumps and moves are fine)", () => {
    const after = {
      dependencies: { zod: "^5", "left-pad": "1" },
      devDependencies: {},
      optionalDependencies: { vitest: "^5" },
    };
    expect(addedDependencies(before, after)).toEqual(["left-pad"]);
  });
  it("fails without the label, with npm links", () => {
    const after = {
      ...before,
      devDependencies: { ...before.devDependencies, "@stryker-mutator/core": "^9" },
    };
    const r = checkNewDependencies(before, after, none);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain("https://www.npmjs.com/package/@stryker-mutator/core");
    expect(checkNewDependencies(before, after, [LABELS.newDependency]).ok).toBe(true);
    expect(checkNewDependencies(before, before, none).ok).toBe(true);
  });
  it("detects package.json script changes", () => {
    expect(scriptsChanged({ scripts: { test: "vitest" } }, { scripts: { test: "vitest" } })).toBe(
      false,
    );
    expect(scriptsChanged({ scripts: { test: "vitest" } }, { scripts: { test: "true" } })).toBe(
      true,
    );
  });
});
