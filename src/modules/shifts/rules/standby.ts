// Automatic rule 1: a dropped shift goes to the next person on standby. Pure helpers.

export interface StandbyRow {
  id: string;
  personId: string;
  status: "waiting" | "offered" | "took" | "passed" | "left";
  createdAt: Date;
}

/** The person who joined standby first and is still waiting, or null. */
export function nextOnStandby<T extends StandbyRow>(rows: readonly T[]): T | null {
  return (
    rows
      .filter((r) => r.status === "waiting")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0] ?? null
  );
}

/** Whether to offer a freed place now: the rule is on, nobody holds an offer, the shift hasn't started. */
export function shouldOffer(f: {
  ruleOn: boolean;
  startsAt: Date;
  now: Date;
  rows: readonly StandbyRow[];
}): boolean {
  return f.ruleOn && f.startsAt > f.now && !f.rows.some((r) => r.status === "offered");
}
