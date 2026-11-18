// pnpm clean:dry-run <members|tools|family> <file.csv> [report.json]
// Dry run only: reads a raw CSV, prints a summary and writes the shareable report (no values).
import { readFileSync, writeFileSync } from "node:fs";
import { cleanFile, type Kind } from "../src/base/ingest/clean";

const [kind, file, out] = process.argv.slice(2);
if (!["members", "tools", "family"].includes(kind ?? "") || !file) {
  console.error("usage: pnpm clean:dry-run <members|tools|family> <file.csv> [report.json]");
  process.exit(2);
}
const report = cleanFile(kind as Kind, readFileSync(file, "utf8"));
console.log(
  JSON.stringify(
    { counts: report.counts, issues: report.issues, warnings: report.warnings },
    null,
    2,
  ),
);
if (out) writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
