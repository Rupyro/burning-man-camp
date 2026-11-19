// The camp's Placement history, one line per year: placed or not, the standing Placement gave,
// and the MOOP Map grade. A camp lead edits this file once a year (after the Post-playa Report).
// Shown on the year page for camps that go through Placement. Leave it empty for a new camp.

export type Standing = "new" | "good" | "probation" | "not-placed";
export type MoopGrade = "green" | "yellow" | "red";

export interface StandingYear {
  year: number;
  standing: Standing;
  /** The MOOP Map grade for the camp's spot, when published. */
  moop?: MoopGrade;
  /** What Placement said, or what we promised to fix. */
  note?: string;
}

export const STANDING_LABEL: Record<Standing, string> = {
  new: "New camp",
  good: "Good standing",
  probation: "Probation",
  "not-placed": "Not placed",
};

export const MOOP_LABEL: Record<MoopGrade, string> = {
  green: "Green (clean)",
  yellow: "Yellow (some MOOP)",
  red: "Red (lots of MOOP)",
};

/** Newest first. Example: { year: 2026, standing: "good", moop: "green" }. */
export const STANDING_HISTORY: readonly StandingYear[] = [];
