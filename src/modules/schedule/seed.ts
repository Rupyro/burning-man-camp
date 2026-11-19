import type { ModuleSeedContext } from "@/base/api";
import { campInputToInstant } from "@/lib/dates";
import { scheduleEvents } from "./schema";

/** Fake, idempotent: three demo offerings in event week. */
export async function seed({ db, edition, people }: ModuleSeedContext) {
  const existing = await db.select({ id: scheduleEvents.id }).from(scheduleEvents).limit(1);
  if (existing.length) return;
  const at = (d: string, t: string) => campInputToInstant(d, t);
  await db.insert(scheduleEvents).values([
    {
      editionId: edition.id,
      title: "Sunrise yoga",
      description: "Gentle stretch before the heat. Bring water.",
      category: "care",
      startsAt: at("2027-08-31", "07:00"),
      endsAt: at("2027-08-31", "08:00"),
      hostPersonId: people.member,
    },
    {
      editionId: edition.id,
      title: "Grilled cheese happy hour",
      description: "Free grilled cheese while it lasts.",
      category: "food",
      startsAt: at("2027-09-01", "16:00"),
      endsAt: at("2027-09-01", "18:00"),
      hostPersonId: people.lead,
    },
    {
      editionId: edition.id,
      title: "Knot-tying for shade structures",
      description: "Trucker's hitch, bowline and more, with rope to practise on.",
      category: "class",
      startsAt: at("2027-09-02", "14:00"),
      endsAt: at("2027-09-02", "15:00"),
    },
  ]);
}
