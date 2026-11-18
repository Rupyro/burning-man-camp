// ESLint is used ONLY for module boundaries (MODULE_RULEBOOK.md §2.1).
// Biome does formatting and all general linting.
import tsParser from "@typescript-eslint/parser";
import boundaries from "eslint-plugin-boundaries";

const el = (type, captured) => ({ element: captured ? { type, captured } : { type } });
const sameModule = { module: "{{from.element.captured.module}}" };

export default [
  { ignores: [".next/**", "node_modules/**", "**/migrations/**"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
    },
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: { project: "./tsconfig.json" } },
      "boundaries/elements": [
        { type: "base-api", pattern: "src/base/api/**" },
        { type: "base-rules", pattern: "src/base/*/rules/**" },
        { type: "base", pattern: "src/base/**" },
        { type: "contracts", pattern: "src/contracts/**" },
        { type: "ui-kit", pattern: "src/components/ui/**" },
        { type: "lib", pattern: "src/lib/**" },
        { type: "module-rules", pattern: "src/modules/*/rules/**", capture: ["module"] },
        { type: "module", pattern: "src/modules/*/**", capture: ["module"] },
        { type: "app", pattern: "src/app/**" },
        // mode "file" still needed in boundaries 7.2 for single files (prints a deprecation notice).
        // Files directly in src/modules (only index.ts, the composition root). Must come after "module".
        { type: "registry", pattern: "src/modules/index.ts", mode: "file" },
        // Files directly in src (only instrumentation.ts, the Next.js boot hook that wires the
        // composition root into the base registry). Must be last.
        { type: "bootstrap", pattern: "src/instrumentation.ts", mode: "file" },
      ],
    },
    rules: {
      "boundaries/no-unknown-files": "error",
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          checkAllOrigins: true,
          message:
            "Boundary violation: {{from.element.types.[0]}} may not import {{to.element.types.[0]}} ({{dependency.source}}). See docs/MODULE_RULEBOOK.md §2.1",
          policies: [
            // npm packages and node built-ins are fine everywhere (narrowed for rules/ below)
            {
              from: { element: { type: "*" } },
              allow: { to: { module: { origin: ["external", "core"] } } },
            },
            {
              from: el("base"),
              allow: {
                to: ["base", "base-api", "base-rules", "contracts", "ui-kit", "lib"].map((t) =>
                  el(t),
                ),
              },
            },
            {
              from: el("base-api"),
              allow: {
                to: ["base", "base-api", "base-rules", "contracts", "lib"].map((t) => el(t)),
              },
            },
            {
              from: el("base-rules"),
              allow: { to: ["base-rules", "contracts", "lib"].map((t) => el(t)) },
            },
            { from: el("contracts"), allow: { to: [el("contracts"), el("lib")] } },
            { from: el("lib"), allow: { to: [el("lib")] } },
            { from: el("ui-kit"), allow: { to: [el("ui-kit"), el("lib")] } },
            {
              from: el("module"),
              allow: {
                to: [
                  el("base-api"),
                  el("contracts"),
                  el("ui-kit"),
                  el("lib"),
                  el("module", sameModule),
                  el("module-rules", sameModule),
                ],
              },
            },
            {
              from: el("module-rules"),
              allow: { to: [el("contracts"), el("lib"), el("module-rules", sameModule)] },
            },
            { from: el("registry"), allow: { to: [el("module"), el("base-api")] } },
            {
              from: el("app"),
              allow: {
                to: ["app", "base", "base-api", "ui-kit", "lib", "registry", "module"].map((t) =>
                  el(t),
                ),
              },
            },
            {
              from: el("bootstrap"),
              allow: { to: [el("registry"), el("base-api"), el("base"), el("lib")] },
            },
            // rules/ folders are pure: no Next.js, no Drizzle, no server code
            ...["module-rules", "base-rules"].map((type) => ({
              from: el(type),
              disallow: {
                to: {
                  module: {
                    source: ["next", "drizzle-orm", "server-only", "postgres", "better-auth"],
                  },
                },
              },
              message:
                "rules/ must stay pure TypeScript: no next/*, drizzle-orm or server code ({{dependency.source}})",
            })),
          ],
        },
      ],
    },
  },
];
