import type { ModuleSeedContext } from "@/base/api";
import { mvDrivers } from "./schema";

/** Fake, idempotent: the demo lead is a cleared driver; the demo member has offered. */
export async function seed({ db, edition, people }: ModuleSeedContext) {
  const existing = await db.select({ id: mvDrivers.id }).from(mvDrivers).limit(1);
  if (existing.length) return;
  await db.insert(mvDrivers).values([
    { editionId: edition.id, personId: people.lead, cleared: true, note: "Briefed (demo)" },
    { editionId: edition.id, personId: people.member },
  ]);
}
