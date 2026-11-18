// People, read side: the directory and a person's page, filtered per record on the server.
// docs/specs/b1-people-teams-roles.md §4 P1–P5, M3.
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/base/api/testing-db";
import { ForbiddenError } from "@/base/errors";
import { getPersonView, listDirectory } from "@/base/people/directory";
import { editionMembers, memberAdminNotes, people } from "@/base/schema";
import { as, type PeopleIds, peopleFixture } from "./people-fixture";

let ids: PeopleIds;

describe("people: directory and person view", () => {
  beforeEach(async () => {
    ids = await peopleFixture();
  });

  it("P1: members see confirmed members without contacts; hidden people stay hidden", async () => {
    const list = await listDirectory(await as(ids.kitchen));
    const names = list.map((p) => p.displayName);
    expect(names).toContain("Gift Member");
    expect(names).not.toContain("Waiting");
    expect(names).not.toContain("Hidden");
    const gift = list.find((p) => p.personId === ids.gift);
    expect(gift?.teams.map((t) => t.key)).toEqual(["gift_projects"]);
    expect(gift?.skills).toEqual(["Carpentry"]);
    expect(gift?.contact).toBeNull();
  });

  it("P1: a person who shares their contact shows it to members", async () => {
    await getDb()
      .update(people)
      .set({ directoryVisibility: "members_with_contact" })
      .where(eq(people.id, ids.gift));
    const gift = (await listDirectory(await as(ids.kitchen))).find((p) => p.personId === ids.gift);
    expect(gift?.contact).toEqual({ email: "gift@example.test", phone: "+27820000001" });
  });

  it("P2 (deny): a member reading another member by id gets no private fields", async () => {
    const view = await getPersonView(await as(ids.kitchen), ids.gift);
    expect(view.displayName).toBe("Gift Member");
    expect(view.contact).toBeNull();
    expect(view.dietary).toBeNull();
    expect(view.payment).toBeNull();
    expect(view.adminNotes).toBeNull();
    expect(view.status).toBeNull();
    expect(JSON.stringify(view)).not.toMatch(/27820000001|peanuts|gift@example/);
  });

  it("P2: you see all of your own fields", async () => {
    const view = await getPersonView(await as(ids.gift), ids.gift);
    expect(view.contact?.phone).toBe("+27820000001");
    expect(view.dietary).toEqual({ diet: "vegan", allergies: "peanuts" });
    expect(view.payment?.status).toBe("unknown");
    expect(view.status).toBe("confirmed");
    expect(view.adminNotes).toBeNull();
    expect(view.can.edit).toBe(true);
  });

  it("P3: a team lead sees their team member's contact, not another team's", async () => {
    expect((await getPersonView(await as(ids.lead), ids.gift)).contact?.phone).toBe("+27820000001");
    expect((await getPersonView(await as(ids.lead), ids.kitchen)).contact).toBeNull();
  });

  it("P4: the diet viewer sees diets by name; other leads don't", async () => {
    expect((await getPersonView(await as(ids.cook), ids.gift)).dietary?.allergies).toBe("peanuts");
    expect((await getPersonView(await as(ids.lead), ids.gift)).dietary).toBeNull();
  });

  it("P5 (deny): waitlisted people can't open the directory or a profile", async () => {
    await expect(listDirectory(await as(ids.wait))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getPersonView(await as(ids.wait), ids.gift)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(getPersonView(await as(ids.kitchen), ids.hidden)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("admins see everyone, any status, with notes", async () => {
    const [member] = await getDb()
      .select({ id: editionMembers.id })
      .from(editionMembers)
      .where(eq(editionMembers.personId, ids.gift));
    await getDb()
      .insert(memberAdminNotes)
      .values({ editionMemberId: member?.id ?? "", body: "Owes a tent peg" });
    const list = await listDirectory(await as(ids.admin), { allStatuses: true });
    expect(list.map((p) => p.displayName)).toEqual(expect.arrayContaining(["Waiting", "Hidden"]));
    const view = await getPersonView(await as(ids.admin), ids.gift);
    expect(view.adminNotes?.map((n) => n.body)).toEqual(["Owes a tent peg"]);
    expect(view.status).toBe("confirmed");
  });

  it("refuses a person who doesn't exist", async () => {
    const ghost = "01900000-0000-7000-8000-0000000fffff";
    await expect(getPersonView(await as(ids.admin), ghost)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
