// The import screen's server actions (spec I1, I5, I8).
import { beforeEach, describe, expect, it } from "vitest";
import { ok } from "@/base/api/testing";
import { actAs } from "@/base/api/testing-db";
import { ForbiddenError } from "@/base/errors";
import { importApply, importDryRun } from "@/base/people/server/actions";
import { type PeopleIds, peopleFixture } from "./people-fixture";

let ids: PeopleIds;

describe("import server actions", () => {
  beforeEach(async () => {
    ids = await peopleFixture();
  });

  it("(deny) members and team leads can't dry-run or apply an import", async () => {
    await actAs(ids.kitchen);
    await expect(
      ok(importDryRun({ csv: "Email\na@example.test", fileName: "x.csv" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await actAs(ids.lead);
    await expect(
      ok(importApply({ csv: "Email\na@example.test", fileName: "x.csv" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("admins dry-run and apply an import with a mapping and resolutions", async () => {
    await actAs(ids.admin);
    const csv = "Contact,Who\nnew@example.test,Cook";
    const dry = await ok(importDryRun({ csv, fileName: "x.csv", mapping: ["email", "fullName"] }));
    expect(dry.ok && dry.data.rows[0]?.action).toBe("duplicate");
    const applied = await ok(
      importApply({
        csv,
        fileName: "x.csv",
        mapping: ["email", "fullName"],
        resolutions: { "2": "create" },
      }),
    );
    expect(applied.ok && applied.data.applied.created).toBe(1);
    const broken = await ok(importDryRun({ csv: 'a,"b', fileName: "x.csv" }));
    expect(broken.ok).toBe(false);
  });
});
