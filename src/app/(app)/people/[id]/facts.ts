import type { PersonView } from "@/base/people/directory";

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");
const words = (s: string) => s.replaceAll("_", " ");

/** The label/value lines of a person's page; fields the server withheld are simply absent. */
export function personFacts(view: PersonView): [string, string][] {
  const t = view.travel;
  const rows: [string, string | null | undefined][] = [
    ["Pronouns", view.pronouns],
    ["Country", view.countryCode],
    [
      "Teams",
      view.teams
        .map((x) => (x.role === "member" ? x.name : `${x.name} (${words(x.role)})`))
        .join(", "),
    ],
    ["Skills", view.skills.join(", ")],
    [
      "On site",
      t.arrivalAt || t.departureAt ? `${day(t.arrivalAt)} to ${day(t.departureAt)}` : null,
    ],
    ["Build / strike", `${t.buildCommitment} / ${t.strikeCommitment}`],
    ["Tent", words(t.tentChoice)],
    ["Availability", t.availabilityNote],
    ["Status", view.status],
    ["Payment (from the sheet)", view.payment ? words(view.payment.status) : null],
    ["Email", view.contact?.email],
    ["Phone", view.contact?.phone],
    [
      "Emergency contact",
      [view.contact?.emergencyContactName, view.contact?.emergencyContactPhone]
        .filter(Boolean)
        .join(" · "),
    ],
    ["Diet", view.dietary?.diet],
    ["Allergies", view.dietary?.allergies],
    ["About", view.bio],
  ];
  return rows.filter((r): r is [string, string] => Boolean(r[1]));
}
