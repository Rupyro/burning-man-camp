import type { ModuleSeedContext } from "@/base/api";
import { campInputToInstant } from "@/lib/dates";
import { soundNeighborLog, soundPlans } from "./schema";

/** Fake, idempotent: a sound plan and two neighbor visits. */
export async function seed({ db, edition, people }: ModuleSeedContext) {
  await db
    .insert(soundPlans)
    .values({ editionId: edition.id, speakersFace: "Toward open playa, away from the 4:30 street" })
    .onConflictDoNothing();
  const existing = await db.select({ id: soundNeighborLog.id }).from(soundNeighborLog).limit(1);
  if (existing.length) return;
  await db.insert(soundNeighborLog).values([
    {
      editionId: edition.id,
      at: campInputToInstant("2027-08-31", "02:40"),
      neighbor: "Demo neighbor camp",
      what: "Bass carrying into their sleeping area",
      action: "Turned the subs down and angled them away",
      loggedByPersonId: people.lead,
    },
    {
      editionId: edition.id,
      at: campInputToInstant("2027-09-02", "23:15"),
      neighbor: "Demo neighbor camp",
      what: "Checked in: all fine tonight",
      action: null,
      loggedByPersonId: people.member,
    },
  ]);
}
