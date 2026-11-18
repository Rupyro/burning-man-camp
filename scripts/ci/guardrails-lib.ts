// Pure rules for the PR guardrail checks (scripts/ci/guardrails.ts runs them on a git diff).
// Kept free of git/IO so they're unit-tested in guardrails-lib.test.ts.

export type FileStatus = "A" | "M" | "D" | "R";
export interface ChangedFile {
  status: FileStatus;
  path: string;
  /** For renames: the old path. */
  from?: string;
}
export interface CheckResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  notes: string[];
}

export const LABELS = {
  protected: "allow-protected-change",
  suppression: "allow-suppression",
  large: "large-ok",
  newDependency: "new-dependency",
} as const;

const result = (errors: string[], warnings: string[] = [], notes: string[] = []): CheckResult => ({
  ok: errors.length === 0,
  errors,
  warnings,
  notes,
});

// ── protected paths ────────────────────────────────────────────────────────────────────────────

/** Paths an agent must not change quietly: the checks themselves and the security core. */
export const PROTECTED_PATTERNS: readonly RegExp[] = [
  /^\.github\//,
  /^\.semgrep\//,
  /^scripts\/ci\//,
  /^scripts\/check-modules\.ts$/,
  /^scripts\/lib\/checks\.ts$/,
  /^tests\//,
  /^e2e\//,
  /(^|\/)__tests__\//,
  /(^|\/)tests\//,
  /\.(test|spec)\.tsx?$/,
  /^vitest\.config\.ts$/,
  /^playwright\.config\.ts$/,
  /^stryker\.config\.(json|mjs|js|ts)$/,
  /^biome\.json$/,
  /^eslint\.config\.mjs$/,
  /^tsconfig\.json$/,
  /^pnpm-workspace\.yaml$/,
  /^osv-scanner\.toml$/,
  /^\.gitleaks\.toml$/,
  /^AGENTS\.md$/,
  /^CONTRIBUTING\.md$/,
  /^docs\/MODULE_RULEBOOK\.md$/,
  /^src\/base\/(auth|authz|guard|audit)\//,
  /(^|\/)migrations\//,
];

export function isProtected(path: string): boolean {
  return PROTECTED_PATTERNS.some((re) => re.test(path));
}

export function checkProtectedPaths(
  files: readonly ChangedFile[],
  labels: readonly string[],
  packageScriptsChanged: boolean,
): CheckResult {
  const touched = files
    .flatMap((f) => [f.path, f.from].filter((p): p is string => Boolean(p)))
    .filter(isProtected);
  const all = [...new Set(touched)];
  if (packageScriptsChanged) all.push('package.json "scripts"');
  if (all.length === 0) return result([], [], ["No protected paths touched."]);
  const list = all.map((p) => `  - ${p}`).join("\n");
  if (labels.includes(LABELS.protected)) {
    return result([], [`Protected paths changed (approved via "${LABELS.protected}"):\n${list}`]);
  }
  return result([
    `This PR changes protected paths (tests, CI, lint/test configs, rulebook, auth/guard/audit, migrations):\n${list}\nRuchir must add the "${LABELS.protected}" label after checking why.`,
  ]);
}

// ── test integrity ─────────────────────────────────────────────────────────────────────────────

export function isTestFile(path: string): boolean {
  return /\.(test|spec)\.tsx?$/.test(path) || /^e2e\/.*\.tsx?$/.test(path);
}

const TEST_CALL_RE = /(?<![\w.])(?:it|test)(?:\.each\s*\([^)]*\))?\s*\(/g;
export function countTests(source: string): number {
  return source.match(TEST_CALL_RE)?.length ?? 0;
}
export function countAssertions(source: string): number {
  return source.match(/(?<![\w.])expect(?:\.\w+)?\s*\(/g)?.length ?? 0;
}

/** Focus/skip markers that silently shrink what runs. */
export const FOCUS_SKIP_RE =
  /(?<![\w])(?:(?:it|test|describe|suite)\.(?:only|skip|todo|skipIf|runIf|fails)\b|(?:xit|xtest|xdescribe|fit|fdescribe)\s*\()/;

export interface TestIntegrityInput {
  files: readonly ChangedFile[];
  labels: readonly string[];
  /** Total it()/test() calls in all test files, before and after. */
  testCountBase: number;
  testCountHead: number;
  /** For modified test files: assertion counts before/after. */
  assertions: readonly { path: string; base: number; head: number }[];
  /** Added lines in test files. */
  addedTestLines: readonly { path: string; line: string }[];
}

export function checkTestIntegrity(input: TestIntegrityInput): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const approved = input.labels.includes(LABELS.protected);
  const gate = (msg: string) => (approved ? warnings : errors).push(msg);

  for (const { path, line } of input.addedTestLines) {
    if (FOCUS_SKIP_RE.test(line)) {
      errors.push(`${path}: adds a focus/skip/todo marker: ${line.trim()}`);
    }
  }
  const deleted = input.files.filter((f) => f.status === "D" && isTestFile(f.path));
  if (deleted.length)
    gate(`Test files deleted:\n${deleted.map((f) => `  - ${f.path}`).join("\n")}`);
  const changed = input.files.filter(
    (f) => (f.status === "M" || f.status === "R") && isTestFile(f.from ?? f.path),
  );
  if (changed.length) {
    gate(`Existing test files changed:\n${changed.map((f) => `  - ${f.path}`).join("\n")}`);
  }
  if (input.testCountHead < input.testCountBase) {
    gate(`Number of tests dropped from ${input.testCountBase} to ${input.testCountHead}.`);
  }
  for (const a of input.assertions) {
    if (a.head < a.base) gate(`${a.path}: assertions dropped from ${a.base} to ${a.head}.`);
  }
  const notes = [`Tests: ${input.testCountBase} → ${input.testCountHead}.`];
  if (errors.length && !approved) {
    errors.push(
      `Changing or removing existing tests needs the "${LABELS.protected}" label from Ruchir. Focus/skip markers are never allowed.`,
    );
  }
  return result(errors, warnings, notes);
}

// ── code hygiene on added lines ────────────────────────────────────────────────────────────────

export const HYGIENE_RULES: readonly { name: string; re: RegExp; tests: boolean }[] = [
  { name: "`as any`", re: /\bas\s+any\b/, tests: false },
  { name: "sql.raw()", re: /\bsql\.raw\s*\(/, tests: false },
  {
    name: "lint/type suppression",
    re: /(eslint-disable|biome-ignore|@ts-ignore|@ts-expect-error|@ts-nocheck|v8 ignore|c8 ignore|istanbul ignore|Stryker disable)/,
    tests: true,
  },
  { name: "empty catch", re: /\bcatch\s*(\([^)]*\))?\s*\{\s*\}/, tests: true },
  {
    name: "swallowed promise rejection",
    re: /\.catch\s*\(\s*(\(\s*\w*\s*\)|\w+)\s*=>\s*(\{\s*\}|undefined|null|void 0)\s*\)/,
    tests: true,
  },
];

const CODE_FILE_RE = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/;

export function checkHygiene(
  addedLines: readonly { path: string; line: string }[],
  labels: readonly string[],
): CheckResult {
  const hits: string[] = [];
  for (const { path, line } of addedLines) {
    if (!CODE_FILE_RE.test(path)) continue;
    if (path.startsWith("scripts/ci/")) continue; // this checker names the patterns it bans
    const inTest = isTestFile(path) || /(^|\/)(tests|__tests__)\//.test(path);
    for (const rule of HYGIENE_RULES) {
      if (inTest && !rule.tests) continue;
      if (rule.re.test(line)) hits.push(`${path}: ${rule.name}: ${line.trim()}`);
    }
  }
  if (!hits.length)
    return result([], [], ["No new suppressions, `as any`, sql.raw or empty catches."]);
  if (labels.includes(LABELS.suppression)) {
    return result([], [`Approved via "${LABELS.suppression}":\n${hits.join("\n")}`]);
  }
  return result([
    `${hits.join("\n")}\nFix the code instead. If one is truly unavoidable, explain why in the PR and ask Ruchir for the "${LABELS.suppression}" label.`,
  ]);
}

// ── PR size ────────────────────────────────────────────────────────────────────────────────────

export const SIZE_WARN = 400;
export const SIZE_FAIL = 600;
const SIZE_EXCLUDE: readonly RegExp[] = [
  /^pnpm-lock\.yaml$/,
  /(^|\/)migrations\/meta\//,
  /(^|\/)__snapshots__\//,
  /\.snap$/,
  /^docs\//,
  /\.md$/,
];

export function countedForSize(path: string): boolean {
  return !SIZE_EXCLUDE.some((re) => re.test(path));
}

export function checkPrSize(
  numstat: readonly { path: string; added: number; deleted: number }[],
  labels: readonly string[],
): CheckResult {
  const counted = numstat.filter((n) => countedForSize(n.path));
  const total = counted.reduce((sum, n) => sum + n.added + n.deleted, 0);
  const excluded = numstat.length - counted.length;
  const note = `${total} changed lines counted (${excluded} generated/doc files excluded).`;
  if (total > SIZE_FAIL) {
    const msg = `PR is ${total} changed lines (limit ${SIZE_FAIL}). Split it into stacked PRs.`;
    return labels.includes(LABELS.large)
      ? result([], [`${msg} (allowed via "${LABELS.large}")`], [note])
      : result([`${msg} Or ask Ruchir for the "${LABELS.large}" label.`], [], [note]);
  }
  if (total > SIZE_WARN) {
    return result([], [`PR is ${total} changed lines; aim for under ${SIZE_WARN}.`], [note]);
  }
  return result([], [], [note]);
}

// ── new dependencies ───────────────────────────────────────────────────────────────────────────

type Pkg = Partial<
  Record<
    "dependencies" | "devDependencies" | "optionalDependencies" | "peerDependencies",
    Record<string, string>
  >
>;
const DEP_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

export function addedDependencies(base: Pkg, head: Pkg): string[] {
  const before = new Set(DEP_FIELDS.flatMap((f) => Object.keys(base[f] ?? {})));
  return [...new Set(DEP_FIELDS.flatMap((f) => Object.keys(head[f] ?? {})))]
    .filter((name) => !before.has(name))
    .sort();
}

export function scriptsChanged(
  base: { scripts?: Record<string, string> },
  head: { scripts?: Record<string, string> },
): boolean {
  return JSON.stringify(base.scripts ?? {}) !== JSON.stringify(head.scripts ?? {});
}

export function checkNewDependencies(base: Pkg, head: Pkg, labels: readonly string[]): CheckResult {
  const added = addedDependencies(base, head);
  if (!added.length) return result([], [], ["No new dependencies."]);
  const list = added.map((n) => `  - ${n}  https://www.npmjs.com/package/${n}`).join("\n");
  if (labels.includes(LABELS.newDependency)) {
    return result([], [`New dependencies (approved via "${LABELS.newDependency}"):\n${list}`]);
  }
  return result([
    `New dependencies:\n${list}\nList each in the PR (npm link, why, weekly downloads). Ruchir adds the "${LABELS.newDependency}" label after checking they're real and needed.`,
  ]);
}
