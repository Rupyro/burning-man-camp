import type { ModuleSeedContext } from "@/base/api";
import { registersItems } from "./schema";

/** Fake, idempotent: one line of each kind. */
export async function seed({ db, edition, people }: ModuleSeedContext) {
  const existing = await db.select({ id: registersItems.id }).from(registersItems).limit(1);
  if (existing.length) return;
  await db.insert(registersItems).values([
    {
      editionId: edition.id,
      kind: "fuel",
      label: "Generator fuel cans (demo)",
      quantity: 40,
      location: "Fuel corner, in the spill tub",
      ownerPersonId: people.lead,
    },
    {
      editionId: edition.id,
      kind: "flame",
      label: "Burn barrel (demo)",
      quantity: 1,
      location: "Front of camp",
      notes: "Raised off the ground, extinguisher on the post",
    },
    {
      editionId: edition.id,
      kind: "stake",
      label: "Shade structure rebar (demo)",
      quantity: 48,
      location: "Main shade",
      ownerPersonId: people.member,
    },
  ]);
}
