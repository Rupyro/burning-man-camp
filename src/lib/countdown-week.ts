// Countdown: "What to do this week", picked by how far away build is. Plain rules, no db.

export type WeekTodo = { key: string; title: string; note: string; href: string };
const T: Record<string, WeekTodo> = {
  fee: {
    key: "fee",
    title: "Pay your camp fee",
    note: "You'll find the amount on your application",
    href: "/apply",
  },
  ride: {
    key: "ride",
    title: "Offer or find a ride",
    note: "Sort out how you're getting to camp",
    href: "/logistics/rides",
  },
  bring: {
    key: "bring",
    title: "Start your packing list",
    note: "Tick things off as you pack",
    href: "/bring",
  },
  shifts: {
    key: "shifts",
    title: "Pick your shifts",
    note: "Everyone does a few",
    href: "/shifts",
  },
  water: {
    key: "water",
    title: "Buy your drinking water",
    note: "5 L for every day you're there",
    href: "/bring",
  },
  arrive: {
    key: "arrive",
    title: "Travel safe, see you at camp",
    note: "Print your ticket: there's no reception",
    href: "/bring",
  },
};

export function thisWeek(daysToBuild: number | null): WeekTodo[] {
  const pick = (...k: string[]) => k.map((x) => T[x] as WeekTodo);
  if (daysToBuild === null || daysToBuild > 42) return pick("fee", "ride", "bring");
  if (daysToBuild > 7) return pick("bring", "ride", "shifts");
  if (daysToBuild >= 0) return pick("bring", "water", "arrive");
  return pick("arrive");
}

/** Shown while the camp's dates aren't confirmed yet. */
export function countdownNote(confirmed: boolean, year: number): string | null {
  return confirmed ? null : `Dates to confirm for ${year}`;
}
