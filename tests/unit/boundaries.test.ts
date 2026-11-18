// Proves the ESLint boundaries rule (MODULE_RULEBOOK.md §2.1) actually bites.
// Lints virtual files; nothing is written to disk.
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: process.cwd() });

async function lint(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result!.messages.map((m) => m.ruleId);
}

const DENIED: [string, string, string][] = [
  [
    "a module importing another module",
    "src/modules/finance/server/x.ts",
    'import { logisticsLoads } from "@/modules/logistics/schema";',
  ],
  [
    "a module importing base internals",
    "src/modules/finance/server/x.ts",
    'import { getDb } from "@/base/db/client";',
  ],
  [
    "the base importing a module",
    "src/base/flags/x.ts",
    'import { manifest } from "@/modules/logistics/manifest";',
  ],
  [
    "the base importing the composition root",
    "src/base/flags/x.ts",
    'import { modules } from "@/modules";',
  ],
  [
    "rules/ importing drizzle",
    "src/modules/logistics/rules/x.ts",
    'import { eq } from "drizzle-orm";',
  ],
  [
    "rules/ importing next",
    "src/modules/logistics/rules/x.ts",
    'import { notFound } from "next/navigation";',
  ],
  [
    "rules/ importing the base API",
    "src/modules/logistics/rules/x.ts",
    'import { moduleAction } from "@/base/api";',
  ],
  [
    "contracts importing the base",
    "src/contracts/events/x.ts",
    'import { getDb } from "@/base/db/client";',
  ],
];

const ALLOWED: [string, string, string][] = [
  [
    "a module importing the base API",
    "src/modules/finance/server/x.ts",
    'import { moduleAction } from "@/base/api";',
  ],
  [
    "a module importing its own files",
    "src/modules/logistics/server/x.ts",
    'import { logisticsLoads } from "../schema";',
  ],
  [
    "a module importing contracts",
    "src/modules/finance/server/x.ts",
    'import { eventContracts } from "@/contracts/events";',
  ],
  [
    "rules/ importing its own rules",
    "src/modules/logistics/rules/x.ts",
    'import { MAX_GREETING_LENGTH } from "./greeting";',
  ],
  [
    "the composition root importing manifests",
    "src/modules/index.ts",
    'import { manifest } from "./logistics/manifest";',
  ],
  [
    "the app importing a module router",
    "src/app/(app)/x/page.tsx",
    'export { default } from "@/modules/logistics/ui/router";',
  ],
];

describe("module boundaries (ESLint)", () => {
  it.each(DENIED)("fails lint: %s", async (_label, file, code) => {
    expect(await lint(file, code)).toContain("boundaries/dependencies");
  });
  it.each(ALLOWED)("passes lint: %s", async (_label, file, code) => {
    expect(await lint(file, code)).toEqual([]);
  });
  it("flags files outside any known element", async () => {
    expect(await lint("src/random.ts", "export const a = 1;")).toContain(
      "boundaries/no-unknown-files",
    );
  });
});
