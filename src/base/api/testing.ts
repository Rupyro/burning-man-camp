// Test helpers for modules (import from "@/base/api/testing" in tests only).
import { describe, expect, it } from "vitest";
import { Actor, type ActorData } from "../authz/actor";
import { can } from "../authz/permissions";
import { ForbiddenError, UnauthenticatedError, ValidationError } from "../errors";
import { type ActionFailure, isActionFailure } from "../guard/action-result";
import type { Capability, ModuleManifest } from "../registry/types";

export const TEST_EDITION_ID = "01900000-0000-7000-8000-000000002027";
const TEAM_ID = "01900000-0000-7000-8000-00000000a001";

const base = (over: Partial<ActorData>): ActorData => ({
  kind: "person",
  personId: "01900000-0000-7000-8000-000000000001",
  displayName: "Test person",
  editionId: TEST_EDITION_ID,
  memberStatus: "confirmed",
  roles: [],
  teams: [],
  ...over,
});

/** The seeded role shapes used by permission matrices (MODULE_RULEBOOK.md §11). */
export const PERSONAS = {
  member: base({ personId: "01900000-0000-7000-8000-000000000011" }),
  team_lead: base({
    personId: "01900000-0000-7000-8000-000000000012",
    teams: [{ teamId: TEAM_ID, teamKey: "kitchen", role: "lead" }],
  }),
  camp_lead: base({ personId: "01900000-0000-7000-8000-000000000013", roles: ["camp_lead"] }),
  finance_approver: base({
    personId: "01900000-0000-7000-8000-000000000014",
    roles: ["finance_approver"],
  }),
  admin: base({ personId: "01900000-0000-7000-8000-000000000015", roles: ["admin"] }),
  pilot: base({ personId: "01900000-0000-7000-8000-000000000016", roles: ["pilot"] }),
  waitlisted: base({
    personId: "01900000-0000-7000-8000-000000000017",
    memberStatus: "waitlisted",
  }),
  prospect: base({ personId: "01900000-0000-7000-8000-000000000018", memberStatus: "prospect" }),
  /** Alumni not attending this year: no edition membership. */
  alumni: base({ personId: "01900000-0000-7000-8000-000000000019", memberStatus: null }),
} satisfies Record<string, ActorData>;

export type PersonaName = keyof typeof PERSONAS;

export function persona(name: PersonaName, over: Partial<ActorData> = {}): Actor {
  return new Actor({ ...PERSONAS[name], ...over });
}

export interface MatrixCase {
  allow: PersonaName[];
  deny: PersonaName[];
  /** Resource passed to the check (e.g. { requesterId }) */
  resource?: (actor: Actor) => unknown;
}

/**
 * Generated permission tests: every capability the manifest declares must have
 * at least one allow and one deny persona, and each must hold.
 */
export function permissionMatrix(
  manifest: ModuleManifest,
  matrix: Partial<Record<Capability, MatrixCase>>,
) {
  describe(`${manifest.id} permission matrix`, () => {
    it("covers every declared capability with an allow and a deny case", () => {
      for (const cap of manifest.permissions) {
        const c = matrix[cap];
        expect(c, `missing matrix entry for ${cap}`).toBeDefined();
        expect(c?.allow.length, `${cap} needs an allow case`).toBeGreaterThan(0);
        expect(c?.deny.length, `${cap} needs a deny case`).toBeGreaterThan(0);
      }
    });
    for (const [cap, c] of Object.entries(matrix) as [Capability, MatrixCase][]) {
      for (const name of c.allow) {
        it(`${cap}: allows ${name}`, () => {
          const a = persona(name);
          expect(can(a, cap, c.resource?.(a))).toBe(true);
        });
      }
      for (const name of c.deny) {
        it(`${cap}: denies ${name}`, () => {
          const a = persona(name);
          expect(can(a, cap, c.resource?.(a))).toBe(false);
        });
      }
    }
  });
}

/**
 * Tests only: unwrap a server action's result. A returned ActionFailure is turned back into the
 * matching error, so `await expect(ok(action(x))).rejects.toThrow(ValidationError)` reads as before.
 */
export async function ok<O>(result: Promise<O | ActionFailure>): Promise<O> {
  const r = await result;
  if (!isActionFailure(r) || !("code" in r)) return r;
  if (r.code === "VALIDATION") throw new ValidationError(r.error);
  if (r.code === "UNAUTHENTICATED") throw new UnauthenticatedError();
  throw new ForbiddenError(r.error);
}
