// PR guardrails. Usage: pnpm guardrails <check> [--base <ref>] [--head <ref>]
//   checks: protected-paths | test-integrity | hygiene | pr-size | new-dependencies | all
// In CI the base/head SHAs and labels come from the pull_request event.
// Locally: `pnpm guardrails all --base origin/main` (labels via GUARDRAIL_LABELS=a,b).
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import {
  type ChangedFile,
  type CheckResult,
  checkHygiene,
  checkNewDependencies,
  checkProtectedPaths,
  checkPrSize,
  checkTestIntegrity,
  countAssertions,
  countTests,
  type FileStatus,
  isTestFile,
  scriptsChanged,
} from "./guardrails-lib";

const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

interface PullRequestEvent {
  pull_request?: { base: { sha: string }; head: { sha: string }; labels: { name: string }[] };
}
function readEvent(): PullRequestEvent {
  const path = process.env.GITHUB_EVENT_PATH;
  if (!path) return {};
  return JSON.parse(readFileSync(path, "utf8")) as PullRequestEvent;
}

const event = readEvent();
const base = arg("base") ?? event.pull_request?.base.sha ?? "origin/main";
const head = arg("head") ?? event.pull_request?.head.sha ?? "HEAD";
const labels =
  event.pull_request?.labels.map((l) => l.name) ??
  (process.env.GUARDRAIL_LABELS ?? "").split(",").filter(Boolean);
const mergeBase = git("merge-base", base, head).trim();

function changedFiles(): ChangedFile[] {
  return git("diff", "--name-status", "-M", `${mergeBase}`, head)
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status = "", a = "", b] = line.split("\t");
      const s = status[0] as FileStatus;
      return s === "R" ? { status: "R", path: b ?? a, from: a } : { status: s, path: a };
    });
}

function addedLines(): { path: string; line: string }[] {
  const out: { path: string; line: string }[] = [];
  let path = "";
  for (const line of git("diff", "-U0", "--no-color", mergeBase, head).split("\n")) {
    if (line.startsWith("+++ ")) path = line.replace(/^\+\+\+ (b\/)?/, "");
    else if (line.startsWith("+") && !line.startsWith("+++"))
      out.push({ path, line: line.slice(1) });
  }
  return out;
}

function show(ref: string, path: string): string | null {
  try {
    return git("show", `${ref}:${path}`);
  } catch {
    return null; // file doesn't exist at that ref
  }
}

function testFilesAt(ref: string): string[] {
  return git("ls-tree", "-r", "--name-only", ref).split("\n").filter(isTestFile);
}

function totalTests(ref: string): number {
  return testFilesAt(ref).reduce((sum, f) => sum + countTests(show(ref, f) ?? ""), 0);
}

function pkgAt(ref: string) {
  return JSON.parse(show(ref, "package.json") ?? "{}") as Record<string, never>;
}

const checks: Record<string, () => CheckResult> = {
  "protected-paths": () =>
    checkProtectedPaths(changedFiles(), labels, scriptsChanged(pkgAt(mergeBase), pkgAt(head))),
  "test-integrity": () => {
    const files = changedFiles();
    return checkTestIntegrity({
      files,
      labels,
      testCountBase: totalTests(mergeBase),
      testCountHead: totalTests(head),
      assertions: files
        .filter((f) => (f.status === "M" || f.status === "R") && isTestFile(f.path))
        .map((f) => ({
          path: f.path,
          base: countAssertions(show(mergeBase, f.from ?? f.path) ?? ""),
          head: countAssertions(show(head, f.path) ?? ""),
        })),
      addedTestLines: addedLines().filter((l) => isTestFile(l.path)),
    });
  },
  hygiene: () => checkHygiene(addedLines(), labels),
  "pr-size": () =>
    checkPrSize(
      git("diff", "--numstat", "-M", mergeBase, head)
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [a = "0", d = "0", path = ""] = line.split("\t");
          // Binary files show "-": count them as 0 lines.
          return { path, added: Number(a) || 0, deleted: Number(d) || 0 };
        }),
      labels,
    ),
  "new-dependencies": () => checkNewDependencies(pkgAt(mergeBase), pkgAt(head), labels),
};

const which = process.argv[2] ?? "all";
const names = which === "all" ? Object.keys(checks) : [which];
let failed = false;
for (const name of names) {
  const run = checks[name];
  if (!run) {
    console.error(`Unknown check "${name}". One of: ${Object.keys(checks).join(", ")}, all`);
    process.exit(2);
  }
  const r = run();
  const lines = [`## ${name}: ${r.ok ? "pass" : "FAIL"}`, ...r.notes];
  for (const w of r.warnings) {
    console.log(`::warning title=${name}::${w.replaceAll("\n", "%0A")}`);
    lines.push(`⚠️ ${w}`);
  }
  for (const e of r.errors) {
    console.log(`::error title=${name}::${e.replaceAll("\n", "%0A")}`);
    lines.push(`❌ ${e}`);
  }
  console.log(lines.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n\n")}\n`);
  }
  if (!r.ok) failed = true;
}
console.log(
  `\nlabels: ${labels.join(", ") || "(none)"} · base ${mergeBase.slice(0, 8)} · head ${head}`,
);
process.exit(failed ? 1 : 0);
