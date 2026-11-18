// Scripts (seed, check:modules, CLIs) run outside Next.js, where `import "server-only"`
// would throw. Resolve it to an empty module for these Node processes only.
import { registerHooks } from "node:module";

const empty = new URL("../../tests/support/empty-module.ts", import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: empty, shortCircuit: true, format: "module" };
    return next(specifier, context);
  },
});
