import { uuidv7 } from "uuidv7";

/** UUIDv7: time-sortable, safe to create offline later (DATA_MODEL.md §0). */
export function newId(): string {
  return uuidv7();
}
