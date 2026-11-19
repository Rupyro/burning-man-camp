import type { ModuleSeedContext } from "@/base/api";
import { campInputToInstant } from "@/lib/dates";
import { exodusDepartures } from "./schema";

/** Fake, idempotent: the demo lead stays for the sweep; the demo member leaves on Monday. */
export async function seed({ db, edition, people }: ModuleSeedContext) {
  const existing = await db.select({ id: exodusDepartures.id }).from(exodusDepartures).limit(1);
  if (existing.length) return;
  await db.insert(exodusDepartures).values([
    {
      editionId: edition.id,
      personId: people.lead,
      departsAt: campInputToInstant("2027-09-07", "10:00"),
      staysForSweep: true,
      travel: "Truck with the container load (demo)",
    },
    {
      editionId: edition.id,
      personId: people.member,
      departsAt: campInputToInstant("2027-09-06", "06:00"),
      travel: "Own car, early start (demo)",
    },
  ]);
}
