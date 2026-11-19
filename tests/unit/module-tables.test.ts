// The newer modules' tables follow DATA_MODEL.md §10: each name starts with its module's prefix,
// and each row belongs to a year (a foreign key to editions that can't cascade-delete camp data).
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { exodusDepartures } from "@/modules/exodus/schema";
import { mvDrivers } from "@/modules/mv/schema";
import { registersItems } from "@/modules/registers/schema";
import { scheduleEvents } from "@/modules/schedule/schema";
import { soundNeighborLog, soundPlans } from "@/modules/sound/schema";
import { ticketsAllocations, ticketsStatus } from "@/modules/tickets/schema";
import { villageShares } from "@/modules/village/schema";

const TABLES: [string, PgTable][] = [
  ["exodus_", exodusDepartures],
  ["mv_", mvDrivers],
  ["registers_", registersItems],
  ["schedule_", scheduleEvents],
  ["sound_", soundPlans],
  ["sound_", soundNeighborLog],
  ["tickets_", ticketsStatus],
  ["tickets_", ticketsAllocations],
  ["village_", villageShares],
];

describe("module tables", () => {
  it.each(TABLES)("%s table: prefixed name and a year it belongs to", (prefix, table) => {
    const config = getTableConfig(table);
    expect(config.name.startsWith(prefix)).toBe(true);
    const toEditions = config.foreignKeys.filter(
      (fk) => getTableConfig(fk.reference().foreignTable).name === "editions",
    );
    expect(toEditions).toHaveLength(1);
    expect(toEditions[0]?.onDelete).not.toBe("cascade");
  });
});
