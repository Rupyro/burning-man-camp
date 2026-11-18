import { integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { newId } from "@/lib/ids";

/** UUIDv7 primary key generated in the app. */
export const idColumn = () =>
  uuid("id")
    .primaryKey()
    .$defaultFn(() => newId());

/** created_at / updated_at / deleted_at / version (DATA_MODEL.md §0). */
export const standardColumns = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
});
