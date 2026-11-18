import { describe, expect, it } from "vitest";
import { sortMyItems } from "@/base/landing/landing";
import type { MyItem } from "@/base/registry/types";

const item = (id: string, urgency: MyItem["urgency"], due?: string): MyItem => ({
  id,
  moduleId: "logistics",
  kind: "other",
  title: id,
  urgency,
  href: "/",
  dueAt: due ? new Date(due) : undefined,
});

describe("my stuff ordering", () => {
  it("de-duplicates by id, sorts overdue → soon → by date, caps at 10", () => {
    const items = [
      item("c", "normal", "2027-03-01"),
      item("a", "overdue", "2027-02-01"),
      item("b", "soon", "2027-02-20"),
      item("a", "overdue", "2027-02-01"),
      item("d", "normal"),
      ...Array.from({ length: 12 }, (_, i) =>
        item(`x${i}`, "normal", `2027-04-${String(i + 1).padStart(2, "0")}`),
      ),
    ];
    const sorted = sortMyItems(items);
    expect(sorted).toHaveLength(10);
    expect(sorted.slice(0, 3).map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(sorted.map((i) => i.id)).not.toContain("d");
  });
});
