import type { ModuleSeedContext } from "@/base/api";
import { villageShares } from "./schema";

/** Fake, idempotent: one thing borrowed from and one lent to a made-up partner camp. */
export async function seed({ db, edition }: ModuleSeedContext) {
  const existing = await db.select({ id: villageShares.id }).from(villageShares).limit(1);
  if (existing.length) return;
  await db.insert(villageShares).values([
    {
      editionId: edition.id,
      partner: "Camp Neighborly (demo)",
      direction: "borrow",
      resource: "power",
      item: "Shared generator hookup",
      notes: "Their generator, our extension run",
    },
    {
      editionId: edition.id,
      partner: "Camp Neighborly (demo)",
      direction: "lend",
      resource: "tools",
      item: "Impact driver",
      returned: true,
    },
  ]);
}
