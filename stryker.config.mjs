// Mutation testing (nightly + manual, see .github/workflows/mutation.yml). Stryker makes small
// changes ("mutants") to the security core and checks that some test fails for each one. A
// surviving mutant means tests run that code without really checking it.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  // Command runner: @stryker-mutator/vitest-runner 10.0 doesn't activate mutants under Vitest 5
  // (every mutant "survives"). The command runner sets __STRYKER_ACTIVE_MUTANT__ per run instead,
  // and runs the whole (small) suite for each mutant.
  testRunner: "command",
  commandRunner: { command: "node scripts/ci/mutation-run.mjs" },
  plugins: [],
  mutate: [
    "src/base/guard/**/*.{ts,tsx}",
    "src/base/authz/**/*.ts",
    "src/base/audit/**/*.ts",
    "src/modules/*/rules/**/*.ts",
    "!**/*.test.ts",
  ],
  coverageAnalysis: "off",
  // Each run claims its own test database (scripts/ci/mutation-run.mjs).
  concurrency: 4,
  // Generous: a whole-suite run takes ~15–35 s under load, and a run that is merely slow must
  // not count as "killed".
  timeoutMS: 60000,
  incremental: true,
  incrementalFile: "reports/stryker-incremental.json",
  reporters: ["clear-text", "progress", "html", "json"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  // Ratchet: `break` sits a little under the measured score; raise it, never lower it.
  // Baseline 10 Oct 2026: 90.2% (322 killed, 18 timed out, 37 survived of 377);
  // 85.4% counting timeouts as survivors.
  thresholds: { high: 90, low: 80, break: 80 },
  tempDirName: ".stryker-tmp",
  cleanTempDir: "always",
};
