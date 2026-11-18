import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const emptyModule = fileURLToPath(new URL("./tests/support/empty-module.ts", import.meta.url));

export default defineConfig({
  resolve: { tsconfigPaths: true, alias: { "server-only": emptyModule } },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary", "html"],
      include: ["src/**/*.{ts,tsx}", "scripts/lib/**/*.ts"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/tests/**",
        "**/__tests__/**",
        "**/migrations/**",
        "**/*.d.ts",
        "src/base/api/testing.ts",
        "src/base/api/testing-db.ts",
        "src/components/ui/**", // vendored shadcn components
      ],
      // Ratchet: raise these as coverage grows, never lower them (protected path; see CONTRIBUTING).
      // Baseline 10 Oct 2026: lines 74.8, statements 74.2, branches 72.0, functions 68.6.
      thresholds: {
        lines: 74,
        statements: 73,
        branches: 71,
        functions: 68,
        // The security core: who can do what, server guards, the audit trail, module business rules.
        "src/base/authz/**": { lines: 90, branches: 90, functions: 90, statements: 90 },
        "src/base/guard/**": { lines: 90, branches: 90, functions: 90, statements: 90 },
        "src/base/audit/**": { lines: 90, branches: 90, functions: 90, statements: 90 },
        "src/modules/*/rules/**": { lines: 90, branches: 90, functions: 90, statements: 90 },
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "scripts/**/*.test.ts", "tests/unit/**/*.test.ts"],
          exclude: ["**/*.db.test.ts", "node_modules/**"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["src/**/*.db.test.ts", "tests/db/**/*.db.test.ts"],
          environment: "node",
          globalSetup: ["tests/support/global-setup.ts"],
          setupFiles: ["tests/support/db-setup.ts"],
          fileParallelism: false,
          testTimeout: 20000,
          hookTimeout: 60000,
        },
      },
    ],
  },
});
