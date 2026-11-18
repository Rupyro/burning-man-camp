// docs/specs/procurement.md §3: have-it check, need statuses, CSV import, shopping list.
import { describe, expect, it } from "vitest";
import { parseImport } from "../rules/csv";
import { haveIt } from "../rules/have-it";
import { shoppingList } from "../rules/shopping";
import { afterSpendDecision, canMove, isOpen, NEED_STATUSES, STATUS_LABEL } from "../rules/status";

describe("have-it check", () => {
  it("the plan's example: need 4, own 2 in Container A (1 broken) -> buy 3", () => {
    const r = haveIt(4, [
      { locationName: "Container A", condition: "good", quantity: 1 },
      { locationName: "Container A", condition: "broken", quantity: 1 },
    ]);
    expect(r).toMatchObject({ usable: 1, unusable: 1, gap: 3, suggestion: "buy" });
    expect(r.text).toBe("We own 2 (1 broken or missing) in Container A. Buy 3.");
  });
  it("enough good stock across places means have it", () => {
    const r = haveIt(3, [
      { locationName: "Container A", condition: "good", quantity: 2 },
      { locationName: "Cape Town storage", condition: "good", quantity: 2 },
    ]);
    expect(r.suggestion).toBe("have_it");
    expect(r.gap).toBe(0);
    expect(r.text).toBe("We own 4 in Container A, Cape Town storage. We have enough.");
  });
  it("needs-repair is shown but not counted", () => {
    const r = haveIt(2, [{ locationName: "Tools", condition: "needs_repair", quantity: 2 }]);
    expect(r).toMatchObject({ usable: 0, repairable: 2, gap: 2 });
    expect(r.text).toContain("2 needs repair");
  });
  it("nothing owned; borrowed or rented items suggest borrowing; decimals read well", () => {
    expect(haveIt(1.5, []).text).toBe("We don't own any. Buy 1.5.");
    expect(haveIt(2, [], "rented").suggestion).toBe("borrow");
    expect(haveIt(2, [], "borrowed").text).toBe("We don't own any. Borrow 2.");
  });
  it("zero-quantity rows don't name a place", () => {
    const r = haveIt(1, [
      { locationName: "Empty", condition: "good", quantity: 0 },
      { locationName: "Kitchen", condition: "missing", quantity: 1 },
    ]);
    expect(r.text).toBe("We own 1 (1 broken or missing) in Kitchen. Buy 1.");
  });
});

describe("need statuses", () => {
  it("allows the planned moves and nothing out of a final state", () => {
    expect(canMove("needed", "to_buy")).toBe(true);
    expect(canMove("to_buy", "purchase_requested")).toBe(true);
    expect(canMove("ordered", "received")).toBe(true);
    expect(canMove("needed", "received")).toBe(false);
    for (const s of NEED_STATUSES) {
      expect(canMove("received", s)).toBe(false);
      expect(canMove("cancelled", s)).toBe(false);
      expect(STATUS_LABEL[s]).toBeTruthy();
    }
    expect(isOpen("ordered")).toBe(true);
    expect(isOpen("received")).toBe(false);
    expect(isOpen("cancelled")).toBe(false);
  });
  it("finance's decision moves only a need that asked for money", () => {
    expect(afterSpendDecision("purchase_requested", "approved")).toBe("to_buy");
    expect(afterSpendDecision("purchase_requested", "rejected")).toBe("needed");
    expect(afterSpendDecision("to_buy", "approved")).toBeNull();
    expect(afterSpendDecision("cancelled", "rejected")).toBeNull();
  });
});

describe("CSV import", () => {
  const H = "name,category,unit,quantity,location,condition";
  it("reads rows, defaults unit and condition, maps unknown categories to other", () => {
    const r = parseImport(
      `${H}\nStaple gun,tool,pcs,2,Container A,good\n"Rope, 10 m",Rigging,,3,Container B,\nGas bottle,camping,pcs,1,Kitchen,needs repair\n\n`,
    );
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      {
        name: "Staple gun",
        category: "tool",
        unit: "pcs",
        quantity: 2,
        location: "Container A",
        condition: "good",
      },
      {
        name: "Rope, 10 m",
        category: "other",
        unit: "pcs",
        quantity: 3,
        location: "Container B",
        condition: "good",
      },
      {
        name: "Gas bottle",
        category: "camping",
        unit: "pcs",
        quantity: 1,
        location: "Kitchen",
        condition: "needs_repair",
      },
    ]);
  });
  it("reports bad rows by line instead of guessing", () => {
    const r = parseImport(
      `${H}\r\n,tool,pcs,1,A,good\nSaw,tool,pcs,lots,A,good\nSaw,tool,pcs,1,,good\nSaw,tool,pcs,1,A,shiny\nSaw,tool,pcs,-1,A,good\n"Say ""hi""",tool,pcs,1,A,good`,
    );
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 4, 5, 6]);
    expect(r.errors[1]?.message).toContain('"lots"');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.name).toBe('Say "hi"');
  });
  it("rejects a file with the wrong header", () => {
    expect(parseImport("item,qty\nSaw,1").errors[0]?.line).toBe(1);
    expect(parseImport("").errors).toHaveLength(1);
  });
});

describe("shopping list", () => {
  const base = {
    unit: "pcs",
    quantityNeeded: 2,
    gap: 2,
    neededBy: null,
    supplierName: null,
  } as const;
  it("lists open buys with a gap, grouped by category, soonest first", () => {
    const list = shoppingList([
      {
        ...base,
        itemName: "Screws",
        category: "building_material",
        status: "to_buy",
        neededBy: "2027-04-02",
      },
      {
        ...base,
        itemName: "Bolts",
        category: "building_material",
        status: "ordered",
        neededBy: "2027-04-01",
      },
      { ...base, itemName: "Anchors", category: "building_material", status: "to_buy" },
      { ...base, itemName: "Ash bags", category: "building_material", status: "to_buy" },
      { ...base, itemName: "Gloves", category: "safety", status: "purchase_requested" },
      { ...base, itemName: "Hammer", category: "tool", status: "have_it" },
      { ...base, itemName: "Saw", category: "tool", status: "to_buy", gap: 0 },
    ]);
    expect(list.map((g) => g.category)).toEqual(["building_material", "safety"]);
    expect(list[0]?.lines.map((l) => l.itemName)).toEqual([
      "Bolts",
      "Screws",
      "Anchors",
      "Ash bags",
    ]);
  });
});
