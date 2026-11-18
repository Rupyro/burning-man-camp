// Flat (single-project) Vitest config used only by Stryker (stryker.config.mjs): its per-test
// coverage doesn't map tests across Vitest `projects`, so unit and DB tests run as one project
// here, sequentially, with the DB setup. Normal runs use vitest.config.ts.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const emptyModule = fileURLToPath(new URL("./tests/support/empty-module.ts", import.meta.url));

export default defineConfig({
  resolve: { tsconfigPaths: true, alias: { "server-only": emptyModule } },
  test: {
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts", "tests/db/**/*.db.test.ts"],
    environment: "node",
    globalSetup: ["tests/support/global-setup.ts"],
    setupFiles: ["tests/support/db-setup.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
