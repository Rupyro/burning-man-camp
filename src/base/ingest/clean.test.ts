import { describe, expect, it } from "vitest";
import {
  cleanFile,
  extractQty,
  findDuplicates,
  normDate,
  normEmail,
  normPhone,
  normYears,
  splitList,
  splitStatus,
  tidy,
  titleCase,
} from "./clean";

describe("field cleaners", () => {
  it("tidies whitespace and capitals", () => {
    expect(tidy("  a   b \t")).toBe("a b");
    expect(tidy(undefined)).toBe("");
    expect(titleCase("  mARY-jane o'neil van der merwe ")).toBe("Mary-Jane O'Neil van der Merwe");
    expect(titleCase("")).toBe("");
  });
  it("normalises emails", () => {
    expect(normEmail(" Foo@Example.COM ")).toEqual({ value: "foo@example.com" });
    expect(normEmail("")).toEqual({ value: null, issue: "blank" });
    expect(normEmail("nope")).toEqual({ value: null, issue: "bad_email" });
  });
  it("standardises phone numbers to +country form", () => {
    expect(normPhone("082 123 4567").value).toBe("+27821234567");
    expect(normPhone("+27 (82) 123-4567").value).toBe("+27821234567");
    expect(normPhone("27821234567").value).toBe("+27821234567");
    expect(normPhone("0044 7700 900123").value).toBe("+447700900123");
    expect(normPhone("123")).toEqual({ value: null, issue: "bad_phone" });
    expect(normPhone(" ")).toEqual({ value: null, issue: "blank" });
  });
  it("standardises dates to YYYY-MM-DD", () => {
    expect(normDate("2026-04-27").value).toBe("2026-04-27");
    expect(normDate("27/04/2026").value).toBe("2026-04-27");
    expect(normDate("27.4.26").value).toBe("2026-04-27");
    expect(normDate("27 Apr 2026").value).toBe("2026-04-27");
    expect(normDate("April 3, 2025").value).toBe("2025-04-03");
    expect(normDate("03/04/2026")).toEqual({ value: "2026-04-03", issue: "ambiguous_date" });
    expect(normDate("31/02/2026")).toEqual({ value: null, issue: "bad_date" });
    expect(normDate("soon")).toEqual({ value: null, issue: "bad_date" });
    expect(normDate("")).toEqual({ value: null, issue: "blank" });
  });
  it("splits ';' lists, dropping blanks and repeats", () => {
    expect(splitList("Cloud; Ossewas ;;cloud")).toEqual(["Cloud", "Ossewas"]);
    expect(splitList("")).toEqual([]);
  });
  it("pulls quantities out of names", () => {
    expect(extractQty("Cloud feet x4")).toEqual({ name: "Cloud feet", qty: 4 });
    expect(extractQty("4x cable ties")).toEqual({ name: "cable ties", qty: 4 });
    expect(extractQty("Pegs ×12 (big)")).toEqual({ name: "Pegs (big)", qty: 12 });
    expect(extractQty("Box 2x4 timber")).toEqual({ name: "Box 2x4 timber", qty: null });
    expect(extractQty("Duct tape")).toEqual({ name: "Duct tape", qty: null });
  });
  it("separates statuses from person names", () => {
    expect(splitStatus("to be bought")).toEqual({ status: "to_buy", person: null });
    expect(splitStatus("Purchased")).toEqual({ status: "purchased", person: null });
    expect(splitStatus("Rémi")).toEqual({ status: null, person: "Rémi" });
    expect(splitStatus("")).toEqual({ status: null, person: null });
    expect(splitStatus("??? 12")).toEqual({ status: null, person: null, issue: "unknown_status" });
  });
  it("reads family years", () => {
    expect(normYears("2024, 2023;2023 and '25", 2026)).toEqual({ value: [2023, 2024, 2025] });
    expect(normYears("2019, 2024", 2026)).toEqual({ value: [2024], issue: "year_out_of_range" });
    expect(normYears("", 2026)).toEqual({ value: [], issue: "blank" });
  });
});

describe("duplicates", () => {
  it("finds exact and near duplicates", () => {
    const d = findDuplicates(["Duct tape grey", "duct  tape GREY", "Duct tapes grey", "Rebar", ""]);
    expect(d.get(1)).toEqual({ kind: "exact", of: 0 });
    expect(d.get(2)).toEqual({ kind: "near", of: 0 });
    expect(d.has(3)).toBe(false);
    expect(d.has(4)).toBe(false);
  });
});

describe("cleanFile", () => {
  it("reports tools without values", () => {
    const csv = [
      "name,departments,situation,type",
      "Cloud feet x4,Cloud; Ossewas,Purchased,Tool",
      "cloud feet x4,Cloud,Jonathan,",
      "Bolts,,weird 9,Item",
    ].join("\n");
    const r = cleanFile("tools", csv);
    expect(r.counts).toEqual({ rows: 3, ok: 0, cleaned: 1, needs_review: 1, duplicate: 1 });
    expect(r.rows[0]).toMatchObject({ line: 2, label: "cleaned" });
    expect(r.rows[0]?.changes).toEqual(expect.arrayContaining(["name", "qty", "departments"]));
    expect(r.rows[1]?.label).toBe("duplicate");
    expect(r.rows[1]?.issues).toEqual(
      expect.arrayContaining(["exact_duplicate", "person_in_status", "blank_type"]),
    );
    expect(r.rows[2]?.issues).toEqual(
      expect.arrayContaining(["unknown_status", "blank_departments"]),
    );
    expect(r.issues.blank_type).toBe(1);
    expect(JSON.stringify(r)).not.toMatch(/Jonathan|Cloud feet/);
  });
  it("cleans members and flags near-duplicate people", () => {
    const csv = [
      "Full name,Email,Phone,Arrival",
      "  ann smith ,Ann@x.org,082 123 4567,27/04/2026",
      "Ann Smith,ann@x.org,,",
      "Bob Jones,bob@x.org,+27821234567,2026-04-27",
      "Bobb Jones,bad,12,whenever",
    ].join("\n");
    const r = cleanFile("members", csv);
    expect(r.rows.map((x) => x.label)).toEqual(["cleaned", "duplicate", "ok", "duplicate"]);
    expect(r.rows[3]?.issues).toEqual(
      expect.arrayContaining(["near_duplicate", "bad_email", "bad_phone", "bad_date"]),
    );
    expect(JSON.stringify(r)).not.toMatch(/0821234567|ann@x|Smith/);
  });
  it("cleans family years", () => {
    const csv = ["Name,Email,Years", "ann,ann@x.org,2023;2024", "Bo,,1999"].join("\n");
    const r = cleanFile("family", csv, { now: new Date("2026-11-02") });
    expect(r.rows[0]).toMatchObject({ label: "cleaned" });
    expect(r.rows[1]?.issues).toEqual(expect.arrayContaining(["blank_email", "year_out_of_range"]));
    expect(r.headers).toEqual(["Name", "Email", "Years"]);
  });
  it("handles an empty file and unknown columns", () => {
    expect(cleanFile("tools", "").counts.rows).toBe(0);
    const r = cleanFile("members", "foo\nbar");
    expect(r.warnings).toContain("no name or email column found");
  });
});

describe("analyseFile (values for the admin screen)", () => {
  it("returns raw and cleaned values alongside the shareable report", async () => {
    const { analyseFile } = await import("./clean");
    const { report, details } = analyseFile(
      "tools",
      "name,situation\nPegs x3,Tristan\npegs x3,to be bought",
    );
    expect(report.counts.rows).toBe(2);
    expect(details[0]).toMatchObject({
      raw: { name: "Pegs x3", situation: "Tristan" },
      cleaned: { name: "Pegs", qty: 3, responsible: "Tristan" },
      duplicateOfLine: null,
    });
    expect(details[1]).toMatchObject({ cleaned: { status: "to_buy" }, duplicateOfLine: 2 });
  });
});
