// Writes the placeholder approval policies and their steps (seed and tests share this).
import { inArray } from "drizzle-orm";
import type { ModuleSeedContext } from "@/base/api";
import { roles } from "@/base/api/schema";
import { PLACEHOLDER_POLICIES } from "../rules/policy";
import { financeApprovalPolicies, financePolicySteps } from "../schema";

/** Inserts PLACEHOLDER_POLICIES for an edition. A "role:<key>" step needs that base role. */
export async function insertPlaceholderPolicies(db: ModuleSeedContext["db"], editionId: string) {
  const keys = PLACEHOLDER_POLICIES.flatMap((p) =>
    p.requiredSteps.flatMap((s) => (s.approver.startsWith("role:") ? [s.approver.slice(5)] : [])),
  );
  const roleRows = await db
    .select({ id: roles.id, key: roles.key })
    .from(roles)
    .where(inArray(roles.key, keys));
  const roleId = (approver: string) => {
    const id = roleRows.find((r) => `role:${r.key}` === approver)?.id;
    if (!id) throw new Error(`No base role for approval step ${approver}`);
    return id;
  };
  const policies = await db
    .insert(financeApprovalPolicies)
    .values(PLACEHOLDER_POLICIES.map(({ requiredSteps: _, ...p }) => ({ ...p, editionId })))
    .returning({ id: financeApprovalPolicies.id, name: financeApprovalPolicies.name });
  await db.insert(financePolicySteps).values(
    PLACEHOLDER_POLICIES.flatMap((p) => {
      const policyId = policies.find((x) => x.name === p.name)?.id ?? "";
      return p.requiredSteps.map((s, position) =>
        s.approver === "team_lead"
          ? { policyId, position, approverKind: "team_lead" as const, roleId: null }
          : { policyId, position, approverKind: "role" as const, roleId: roleId(s.approver) },
      );
    }),
  );
  return policies;
}
