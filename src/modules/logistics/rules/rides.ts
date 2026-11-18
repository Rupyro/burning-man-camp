// Ride board matching and phone visibility (docs/specs/logistics.md §3, L3, L4). Pure.
export type Direction = "to_burn" | "from_burn";
export type Mode = "offering_ride" | "need_ride" | "own_arrangement";
export type MatchStatus = "proposed" | "accepted" | "declined" | "cancelled";

export interface Plan {
  id: string;
  personId: string;
  direction: Direction;
  mode: Mode;
  /** Camp-day date, YYYY-MM-DD. */
  travelDate: string | null;
  areaPlaceId: string | null;
  seatsOffered: number | null;
  seatsNeeded: number | null;
}

export interface Match {
  driverPlanId: string;
  passengerPlanId: string;
  seats: number;
  status: MatchStatus;
}

const day = (d: string) =>
  Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000;

/** Days between two YYYY-MM-DD dates, or null if either is missing. */
export function daysApart(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  return Math.abs(day(a) - day(b));
}

/** Seats still free on an offer: offered minus accepted passengers' seats. */
export function seatsLeft(offer: Plan, matches: Match[]): number {
  const taken = matches
    .filter((m) => m.driverPlanId === offer.id && m.status === "accepted")
    .reduce((t, m) => t + m.seats, 0);
  return Math.max(0, (offer.seatsOffered ?? 0) - taken);
}

/** Offers that fit someone who needs a ride: same direction, ±1 day, same area or none, seats left. */
export function offersFor(
  need: Plan,
  plans: Plan[],
  matches: Match[],
): { plan: Plan; seatsLeft: number; daysApart: number }[] {
  const want = Math.max(1, need.seatsNeeded ?? 1);
  return plans
    .filter(
      (p) =>
        p.mode === "offering_ride" &&
        p.personId !== need.personId &&
        p.direction === need.direction &&
        (!p.areaPlaceId || !need.areaPlaceId || p.areaPlaceId === need.areaPlaceId),
    )
    .map((plan) => ({
      plan,
      seatsLeft: seatsLeft(plan, matches),
      daysApart: daysApart(plan.travelDate, need.travelDate),
    }))
    .filter(
      (x): x is { plan: Plan; seatsLeft: number; daysApart: number } =>
        x.daysApart !== null && x.daysApart <= 1 && x.seatsLeft >= want,
    )
    .sort(
      (a, b) =>
        a.daysApart - b.daysApart ||
        (a.plan.travelDate ?? "").localeCompare(b.plan.travelDate ?? ""),
    );
}

/** Only the driver and passenger of an accepted match see each other's phone (L3). */
export function canSeePhone(
  viewerPersonId: string,
  otherPersonId: string,
  match: { status: MatchStatus; driverPersonId: string; passengerPersonId: string },
): boolean {
  if (match.status !== "accepted" || viewerPersonId === otherPersonId) return false;
  const pair = [match.driverPersonId, match.passengerPersonId];
  return pair.includes(viewerPersonId) && pair.includes(otherPersonId);
}

export const MODE_LABEL: Record<Mode, string> = {
  offering_ride: "Offering a ride",
  need_ride: "Need a ride",
  own_arrangement: "Sorted myself",
};
export const DIRECTION_LABEL: Record<Direction, string> = {
  to_burn: "To the burn",
  from_burn: "Home from the burn",
};

/** "Rides to camp" board status, as on the 2026 carpool sheet. */
export type BoardStatus = "space" | "looking" | "sorted";
export const BOARD_STATUS_LABEL: Record<BoardStatus, string> = {
  space: "Space available",
  looking: "Still looking",
  sorted: "Sorted / full",
};

export function boardStatus(plan: Plan, matches: Match[]): BoardStatus {
  if (plan.mode === "offering_ride") return seatsLeft(plan, matches) > 0 ? "space" : "sorted";
  const agreed = matches.some((m) => m.passengerPlanId === plan.id && m.status === "accepted");
  return agreed ? "sorted" : "looking";
}

/** One direction of the board: offers and requests (not "sorted myself"), open ones first, by date. */
export function boardRows<P extends Plan>(plans: P[], matches: Match[], direction: Direction) {
  return plans
    .filter((p) => p.direction === direction && p.mode !== "own_arrangement")
    .map((plan) => ({
      plan,
      status: boardStatus(plan, matches),
      seatsLeft: plan.mode === "offering_ride" ? seatsLeft(plan, matches) : 0,
    }))
    .sort(
      (a, b) =>
        Number(a.status === "sorted") - Number(b.status === "sorted") ||
        (a.plan.travelDate ?? "9999").localeCompare(b.plan.travelDate ?? "9999"),
    );
}
