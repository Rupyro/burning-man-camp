import { describe, expect, it } from "vitest";
import { definePermissions } from "@/base/authz/permissions";
import { buildRegistry } from "@/base/registry/runtime";
import type { ModuleManifest } from "@/base/registry/types";
import { validateManifests } from "@/base/registry/validate";
import { noopAsync } from "@/lib/noop";

definePermissions("finance", { "finance.view": () => true });

const valid = (over: Partial<ModuleManifest> = {}): ModuleManifest => ({
  id: "finance",
  name: "Finance",
  description: "Budgets",
  icon: "wallet",
  route: "/finance",
  tablePrefix: "finance_",
  access: [{ everyone: true }],
  permissions: ["finance.view"],
  nav: [{ label: "Home", path: "" }],
  flag: { defaultEnabled: true },
  ...over,
});

const check = (manifests: ModuleManifest[]) =>
  validateManifests({
    manifests,
    eventNames: new Set(["applicants.application.accepted", "finance.spend.decided"]),
    isCapabilityDefined: (c) => c === "finance.view",
  });

describe("manifest validation", () => {
  it("accepts a valid manifest", () => {
    expect(check([valid()])).toEqual([]);
  });

  it("rejects duplicate ids, routes and prefixes", () => {
    const problems = check([valid(), valid({ id: "procurement" })]);
    expect(problems.join("\n")).toMatch(/route "\/finance" is already used/);
    expect(problems.join("\n")).toMatch(/prefix "finance_" is already used/);
  });

  it("rejects bad prefixes, reserved routes and undeclared capabilities", () => {
    const problems = check([
      valid({
        tablePrefix: "Fin" as `${string}_`,
        route: "/settings",
        access: [{ capability: "finance.approve" }],
      }),
    ]).join("\n");
    expect(problems).toMatch(/tablePrefix "Fin"/);
    expect(problems).toMatch(/reserved/);
    expect(problems).toMatch(/undeclared capability "finance.approve"/);
  });

  it("rejects capabilities without a check or with another module's prefix", () => {
    const problems = check([
      valid({ permissions: ["finance.view", "finance.approve", "kitchen.view"] }),
    ]).join("\n");
    expect(problems).toMatch(/"finance.approve" has no check/);
    expect(problems).toMatch(/"kitchen.view" must start with "finance."/);
  });

  it("rejects events without a contract, or emitted by someone else", () => {
    const problems = check([
      valid({
        events: {
          emits: [
            "finance.spend.decided",
            "applicants.application.accepted",
            "finance.ghost.happened",
          ],
          handles: { "nobody.thing.done": async () => ({ default: noopAsync }) },
        },
      }),
    ]).join("\n");
    expect(problems).not.toMatch(/"finance.spend.decided"/);
    expect(problems).toMatch(/emits "applicants.application.accepted"/);
    expect(problems).toMatch(/"finance.ghost.happened" which has no contract/);
    expect(problems).toMatch(/handles "nobody.thing.done"/);
  });

  it("rejects un-namespaced task kinds, jobs and export tables", () => {
    const problems = check([
      valid({
        taskKinds: [{ key: "logistics.x" as `finance.${string}`, label: "x" }],
        exports: { tables: [{ name: "spend_requests" }] },
      }),
    ]).join("\n");
    expect(problems).toMatch(/"logistics.x" must start with "finance."/);
    expect(problems).toMatch(/export table "spend_requests"/);
  });
});

describe("buildRegistry", () => {
  it("throws on invalid manifests at boot", () => {
    expect(() => buildRegistry([valid(), valid()])).toThrow(/Invalid module manifests/);
  });
});
