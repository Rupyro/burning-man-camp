import Link from "next/link";
import type { ModuleContext } from "@/base/api";
import { BOARD_STATUS_LABEL, type BoardStatus, boardRows } from "../../rules/rides";
import { allMatches, allPlans } from "../../server/rides";
import { dayText, TIME_LABEL } from "../components/bits";

const PILL: Record<BoardStatus, string> = {
  space: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  looking: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  sorted: "bg-muted text-muted-foreground",
};

/**
 * Rides to camp (replaces the 2026 carpool sheet): everyone's offers and requests, one direction
 * at a time. Names only here; phones are shared once a ride is agreed (L3), on the travel page.
 */
export async function RidesBoardPage({ ctx, back }: { ctx: ModuleContext; back: boolean }) {
  const plans = await allPlans(ctx.db, ctx.edition.id);
  const matches = await allMatches(
    ctx.db,
    plans.map((p) => p.id),
  );
  const rows = boardRows(plans, matches, back ? "from_burn" : "to_burn");
  const tab = (on: boolean) =>
    `flex-1 rounded-lg py-2 text-center text-sm font-bold no-underline ${on ? "bg-card shadow" : "text-muted-foreground"}`;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="heading text-lg">Rides to camp</h1>
        <p className="text-sm text-muted-foreground">
          Offer a seat or find one. Once you agree a ride, you'll see each other's number.
        </p>
      </div>
      <nav className="flex rounded-xl bg-muted p-1" aria-label="Direction">
        <Link href="/logistics/rides" className={tab(!back)}>
          Going
        </Link>
        <Link href="/logistics/rides?back=1" className={tab(back)}>
          Coming back
        </Link>
      </nav>
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/logistics#travel"
          className="rounded-xl bg-primary py-3 text-center font-bold text-primary-foreground no-underline"
        >
          Offer a ride
        </Link>
        <Link
          href="/logistics#travel"
          className="rounded-xl border bg-card py-3 text-center font-bold text-primary no-underline"
        >
          Find a ride
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border bg-card p-4 text-sm">
          No rides on the board yet. Be the first: offer a seat or say you need one.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map(({ plan: r, status, seatsLeft }) => {
            const offering = r.mode === "offering_ride";
            const from = [r.areaName, r.areaDetail].filter(Boolean).join(", ") || "Not said yet";
            const seats = offering
              ? `${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} free`
              : `${r.seatsNeeded ?? 1} ${(r.seatsNeeded ?? 1) === 1 ? "person" : "people"}`;
            return (
              <li key={r.id} className="rounded-2xl border bg-card p-4 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <b>
                    {r.personName}
                    {r.personId === ctx.actor.personId ? " (you)" : ""}
                  </b>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${PILL[status]}`}>
                    {BOARD_STATUS_LABEL[status]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {offering ? "Offering a ride" : "Looking for a ride"} ·{" "}
                  {back ? "Home from the burn" : "To AfrikaBurn"}
                </p>
                <p className="mt-1">
                  <b>{back ? "To" : "From"}</b> {from}
                  <br />
                  <b>Leaving</b> {r.travelDate ? dayText(r.travelDate) : "Date not set"},{" "}
                  {TIME_LABEL[r.timeOfDay]}
                  <br />
                  <b>Seats</b> {seats}
                </p>
                {r.notes || r.carriesCargo ? (
                  <p className="mt-2 rounded-lg bg-muted px-2 py-1 text-xs">
                    Gear space: {r.notes ?? "can carry camp gear"}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-center text-xs text-muted-foreground">
        <a href="https://quaggapedia.afrikaburn.com/index.php?title=GETTING_THERE_%26_DIRECTIONS">
          Directions on Quaggapedia
        </a>
      </p>
    </div>
  );
}
