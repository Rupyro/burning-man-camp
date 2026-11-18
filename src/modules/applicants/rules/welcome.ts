// Welcome list (automatic rule 6, Oct 28 2026). Pure: a new member's facts in, their to-dos out.
// The fee is part of joining, so by the time someone is a member it's already ticked. Shifts live
// in the Shifts module, which tracks them itself, so here they're a link only.

/** The welcome list shows for this many days after joining, then quietly goes away. */
export const WELCOME_DAYS = 30;

export interface WelcomeFact {
  joinedAt: Date | null;
  paidAt: Date | null;
  guideReadAt: Date | null;
}

export interface WelcomeTodo {
  key: "fee" | "shifts" | "guide";
  title: string;
  line: string;
  /** null: tracked elsewhere (shifts). */
  done: boolean | null;
  href: string;
}

/** The home row shows until the guide is read (or the welcome days pass, or it's switched off). */
export function welcomeOpen(f: WelcomeFact, now: Date, on: boolean): boolean {
  if (!on || !f.joinedAt || f.guideReadAt) return false;
  return now.getTime() - f.joinedAt.getTime() <= WELCOME_DAYS * 86_400_000;
}

export function welcomeTodos(f: WelcomeFact): WelcomeTodo[] {
  return [
    {
      key: "fee",
      title: "Pay your camp fee",
      line: f.paidAt ? "Done, thank you." : "You'll find the amount on your application page.",
      done: f.paidAt !== null,
      href: "/apply",
    },
    {
      key: "shifts",
      title: "Pick your shifts",
      line: "Everyone does a few shifts. The Shifts page shows how many you still need.",
      done: null,
      href: "/shifts",
    },
    {
      key: "guide",
      title: "Read the camp guide",
      line: "It takes about ten minutes.",
      done: f.guideReadAt !== null,
      href: "/camp#guide",
    },
  ];
}
