import { describe, expect, it } from "vitest";
import { getRegistry, registerModules, resetRegistryForTests } from "@/base/registry/runtime";
import { modules } from "@/modules";

describe("registry runtime with the real module list", () => {
  it("validates and registers src/modules/index.ts", () => {
    resetRegistryForTests();
    expect(() => getRegistry()).toThrow(/not initialised/);
    const registry = registerModules(modules);
    expect(registry.get("logistics")?.route).toBe("/logistics");
    expect(registry.get("hello" as never)).toBeUndefined(); // example module removed
    expect(registerModules(modules)).toBe(registry); // idempotent
  });
});
