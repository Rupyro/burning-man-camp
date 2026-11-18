// CSV import, pure part: parsing, header mapping and value normalising (spec I1, I2).
import { describe, expect, it } from "vitest";
import { parseCsv } from "@/base/people/import/csv";
import { guessMapping, normaliseRow } from "@/base/people/import/mapping";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas, CRLF, a BOM and blank lines", () => {
    const text = '\uFEFFName,Notes\r\n"Doe, Jo","said ""hi"""\r\n\r\nSam,"two\nlines"\n';
    expect(parseCsv(text)).toEqual([
      ["Name", "Notes"],
      ["Doe, Jo", 'said "hi"'],
      ["Sam", "two\nlines"],
    ]);
  });

  it("keeps empty cells and a missing final newline", () => {
    expect(parseCsv("a,,c\n1,2,")).toEqual([
      ["a", "", "c"],
      ["1", "2", ""],
    ]);
  });

  it("refuses an unterminated quote", () => {
    expect(() => parseCsv('a,"b\n1,2')).toThrow(/quote/);
  });
});

describe("guessMapping", () => {
  it("I1: maps common header spellings and leaves unknown columns unmapped", () => {
    expect(
      guessMapping([
        "E-mail",
        "First name",
        "Surname",
        "Playa Name",
        "Cell",
        "Country",
        "Deposit / payment",
        "Status",
        "Arrival date",
        "Departure",
        "Build week?",
        "Strike",
        "Tent",
        "Dietary requirements",
        "Allergies",
        "Shoe size",
      ]),
    ).toEqual([
      "email",
      "firstName",
      "lastName",
      "playaName",
      "phone",
      "countryCode",
      "paymentStatus",
      "status",
      "arrivalAt",
      "departureAt",
      "buildCommitment",
      "strikeCommitment",
      "tentChoice",
      "diet",
      "allergies",
      null,
    ]);
  });

  it("maps each field once (the first matching column wins)", () => {
    expect(guessMapping(["Email", "Email address"])).toEqual(["email", null]);
  });
});

describe("normaliseRow", () => {
  it("I2: normalises the values a sheet usually has", () => {
    const r = normaliseRow({
      email: "  Jo.Example@Example.TEST ",
      firstName: "Jo",
      lastName: "Example",
      status: "Confirmed",
      paymentStatus: "Deposit paid",
      buildCommitment: "yes",
      strikeCommitment: "Partial",
      tentChoice: "Bring my own tent",
      diet: "Veg",
      countryCode: "za",
      arrivalAt: "2027-04-21",
      departureAt: "2027-05-04 10:00",
    });
    expect(r.issues).toEqual([]);
    expect(r.values).toMatchObject({
      email: "jo.example@example.test",
      displayName: "Jo Example",
      status: "confirmed",
      paymentStatus: "deposit_paid",
      buildCommitment: "full",
      strikeCommitment: "partial",
      tentChoice: "byo_tent",
      diet: "vegetarian",
      countryCode: "ZA",
    });
    expect(r.values.arrivalAt?.toISOString()).toBe("2027-04-21T00:00:00.000Z");
  });

  it("I2: explains what's wrong instead of guessing", () => {
    const r = normaliseRow({
      email: "not-an-email",
      status: "maybe",
      paymentStatus: "kind of",
      arrivalAt: "next week",
      tentChoice: "hammock",
    });
    expect(r.issues).toEqual([
      "invalid email",
      'unknown status "maybe"',
      'unknown payment status "kind of"',
      'unreadable arrival date "next week"',
      'unknown tent choice "hammock"',
    ]);
  });

  it("refuses a departure before arrival and a missing email", () => {
    expect(normaliseRow({ arrivalAt: "2027-04-21", departureAt: "2027-04-20" }).issues).toEqual([
      "missing email",
      "departure is before arrival",
    ]);
  });

  it("empty cells mean 'no change', and the display name falls back sensibly", () => {
    const r = normaliseRow({ email: "x@example.test", status: "", playaName: "Dusty" });
    expect(r.values.status).toBeUndefined();
    expect(r.values.displayName).toBe("Dusty");
    expect(normaliseRow({ email: "y@example.test" }).values.displayName).toBe("y");
  });
});
