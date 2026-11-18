import { beforeEach, describe, expect, it } from "vitest";
import {
  actorFor,
  createCamp,
  createPerson,
  EDITION,
  getDb,
  truncateAll,
} from "@/base/api/testing-db";
import { ForbiddenError, ValidationError } from "../errors";
import { approveBatch, createBatch, decideRow, getBatch, listBatches } from "./batches";

const CSV = [
  "name,departments,situation,type",
  "Cloud feet x4,Cloud; Ossewas,Purchased,Tool",
  "cloud feet x4,Cloud,Jonathan,",
  "Bolts,Various,Rémi,Item",
].join("\n");

let admin: string;
let member: string;
const ctx = async (id: string) => ({ db: getDb(), actor: await actorFor(id), edition: EDITION });

beforeEach(async () => {
  await truncateAll();
  await createCamp();
  admin = await createPerson({ email: "a@x.org", name: "Admin", roles: ["admin"] });
  member = await createPerson({ email: "m@x.org", name: "Member" });
});

describe("import batches", () => {
  it("only admins can upload or read batches", async () => {
    const c = await ctx(member);
    await expect(
      createBatch(c, { kind: "tools", fileName: "t.csv", csv: CSV }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listBatches(c)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("stores the cleaner report and rows with values for review", async () => {
    const c = await ctx(admin);
    const id = await createBatch(c, { kind: "tools", fileName: "t.csv", csv: CSV });
    const b = await getBatch(c, id);
    expect(b.batch).toMatchObject({ kind: "tools", status: "review", fileName: "t.csv" });
    expect(b.rows.map((r) => [r.line, r.label, r.decision])).toEqual([
      [2, "cleaned", "accept"],
      [3, "duplicate", "pending"],
      [4, "needs_review", "pending"],
    ]);
    expect(b.rows[1]?.duplicateOfLine).toBe(2);
    expect(b.rows[2]?.cleaned).toMatchObject({ name: "Bolts", responsible: "Rémi" });
    expect(b.rows[0]?.raw).toMatchObject({ name: "Cloud feet x4" });
    expect((await listBatches(c)).map((x) => x.id)).toEqual([id]);
  });

  it("lets an admin accept, fix, skip and opt in to who's responsible", async () => {
    const c = await ctx(admin);
    const id = await createBatch(c, { kind: "tools", fileName: "t.csv", csv: CSV });
    const rows = (await getBatch(c, id)).rows;
    const [, dup, person] = rows;
    await expect(approveBatch(c, id, {})).rejects.toBeInstanceOf(ValidationError);
    await decideRow(c, { rowId: dup?.id ?? "", decision: "skip" });
    await expect(
      decideRow(c, { rowId: rows[0]?.id ?? "", decision: "accept", setResponsible: true }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(decideRow(c, { rowId: person?.id ?? "", decision: "fix" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await decideRow(c, {
      rowId: person?.id ?? "",
      decision: "fix",
      fix: { type: "Tool" },
      setResponsible: true,
    });
    const after = (await getBatch(c, id)).rows;
    expect(after[2]).toMatchObject({
      decision: "fix",
      fix: { type: "Tool" },
      setResponsible: true,
    });
    expect(after[1]?.decision).toBe("skip");
    await approveBatch(c, id, {});
    expect((await getBatch(c, id)).batch.status).toBe("approved");
    await expect(decideRow(c, { rowId: dup?.id ?? "", decision: "accept" })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("rejects an empty file", async () => {
    const c = await ctx(admin);
    await expect(
      createBatch(c, { kind: "tools", fileName: "e.csv", csv: "" }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(getBatch(c, "01900000-0000-7000-8000-000000000999")).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
