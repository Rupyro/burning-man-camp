// Shared fixture for the engine DB tests: the people fixture plus team ids and a project helper.
import { and, eq } from "drizzle-orm";
import { EDITION, getDb } from "@/base/api/testing-db";
import { projects, teams } from "@/base/schema";
import { firstRow } from "@/lib/rows";
import { as, type PeopleIds, peopleFixture } from "./people-fixture";

export const NOW = new Date("2027-04-10T07:00:00Z");
export const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

export interface EngineIds extends PeopleIds {
  kitchenTeam: string;
  giftTeam: string;
  /** A Gift Projects project ("Cloud") led by the gift lead. */
  cloud: string;
}

/** Act as someone at the fixed test clock. */
export const at = async (personId: string, now = NOW) => ({ ...(await as(personId)), now });

export async function engineFixture(): Promise<EngineIds> {
  const ids = await peopleFixture();
  const team = async (key: string) =>
    firstRow(
      await getDb()
        .select()
        .from(teams)
        .where(and(eq(teams.key, key), eq(teams.editionId, EDITION.id))),
      key,
    ).id;
  const giftTeam = await team("gift_projects");
  const cloud = firstRow(
    await getDb()
      .insert(projects)
      .values({ editionId: EDITION.id, teamId: giftTeam, name: "Cloud", leadPersonId: ids.lead })
      .returning(),
  ).id;
  return { ...ids, kitchenTeam: await team("kitchen"), giftTeam, cloud };
}
