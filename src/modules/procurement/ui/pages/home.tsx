import Link from "next/link";
import { can, type ModuleContext } from "@/base/api";
import { categoryLabel } from "../../rules/csv";
import { isOpen, type NeedStatus, STATUS_LABEL } from "../../rules/status";
import { editionTeams, listItems, listNeeds, teamsOf } from "../../server/queries";
import {
  BottleneckTag,
  CriticalTag,
  dueText,
  HaveItLine,
  NeedCard,
  StatusChip,
} from "../components/bits";
import { CsvImportForm } from "../components/forms";

const STATUS_ORDER: NeedStatus[] = [
  "needed",
  "to_buy",
  "to_borrow",
  "purchase_requested",
  "ordered",
  "have_it",
];
const SORTS = { status: "Status", team: "Team", item: "Item", due: "Needed by" } as const;
export type NeedSort = keyof typeof SORTS;
export interface NeedsView {
  team?: string;
  status?: string;
  sort?: string;
  all?: boolean;
}

/** One needs table for leads, like a Notion list: filter by team and status, sort by any column. */
export function sortNeeds<
  T extends {
    status: NeedStatus;
    teamName: string;
    itemName: string;
    neededBy: string | null;
    isCritical: boolean;
  },
>(rows: T[], sort: string | undefined): T[] {
  const by = (sort && sort in SORTS ? sort : "status") as NeedSort;
  const key = (n: T): string =>
    by === "team"
      ? n.teamName
      : by === "item"
        ? n.itemName
        : by === "due"
          ? (n.neededBy ?? "9999")
          : String(STATUS_ORDER.indexOf(n.status));
  return [...rows].sort(
    (a, b) =>
      key(a).localeCompare(key(b)) ||
      Number(b.isCritical) - Number(a.isCritical) ||
      a.itemName.localeCompare(b.itemName),
  );
}

/**
 * Members: phone-first search, their team's needs and a "raise a need" button.
 * Leads: one sortable, filterable needs table for the teams they lead, the kit list and CSV import.
 */
export async function HomePage({
  ctx,
  q = "",
  view = {},
}: {
  ctx: ModuleContext;
  q?: string;
  view?: NeedsView;
}) {
  const a = ctx.actor;
  const campWide = a.hasRole("camp_lead") || a.isAdmin;
  const myTeamIds = a.teams.map((t) => t.teamId);
  const ledIds = a.teams.filter((t) => a.isLeadOf(t.teamId)).map((t) => t.teamId);
  const [myTeams, allTeams, catalogue, mine, board] = await Promise.all([
    teamsOf(ctx.db, myTeamIds),
    campWide ? editionTeams(ctx.db, ctx.edition.id) : teamsOf(ctx.db, ledIds),
    listItems(ctx.db, q),
    listNeeds(ctx.db, ctx.edition.id, {
      teamIds: campWide ? [] : myTeamIds.filter((t) => !ledIds.includes(t)),
    }),
    campWide || ledIds.length
      ? listNeeds(ctx.db, ctx.edition.id, campWide ? {} : { teamIds: ledIds })
      : Promise.resolve([]),
  ]);
  const lead = board.length > 0 || ledIds.length > 0 || campWide;
  const manage = can(a, "procurement.catalogue.manage");
  const scarce = catalogue.filter((x) => x.item.isBottleneck);
  const openMine = mine.filter((n) => isOpen(n.status));
  const open = board.filter((n) => isOpen(n.status));
  const closed = board.length - open.length;
  const teamFilter = allTeams.some((t) => t.id === view.team) ? view.team : undefined;
  const statusFilter = STATUS_ORDER.includes(view.status as NeedStatus)
    ? (view.status as NeedStatus)
    : undefined;
  const rows = sortNeeds(
    open.filter(
      (n) =>
        (!teamFilter || n.teamId === teamFilter) && (!statusFilter || n.status === statusFilter),
    ),
    view.sort,
  );
  const toBuy = open.filter((n) => n.check.gap > 0 && n.status !== "have_it").length;
  const critical = open.filter((n) => n.isCritical).length;
  const kit = q || view.all ? catalogue : scarce;
  return (
    <div className="flex flex-col gap-5">
      <header className="rounded-2xl bg-sunset p-4 text-white lg:bg-none lg:p-0 lg:text-foreground">
        <h1 className="heading text-lg">Kit and stock</h1>
        <p className="text-sm opacity-90">
          {lead
            ? `What we own, where it is, and what teams need for ${ctx.edition.year}.`
            : "Find kit, update a count on site, and tell your team what you need."}
        </p>
        <form action="/procurement" className="mt-3 flex gap-2" aria-label="Search the kit">
          <label htmlFor="q" className="sr-only">
            Search the kit
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Search: staple gun, gazebo…"
            className="min-h-11 w-full rounded-full border bg-card px-4 text-foreground lg:max-w-sm"
          />
          <button
            type="submit"
            className="min-h-11 rounded-full bg-white px-4 font-semibold text-earth lg:bg-primary lg:text-primary-foreground"
          >
            Search
          </button>
        </form>
        {myTeams.length ? (
          <Link
            href="/procurement/new"
            className="mt-3 inline-flex min-h-11 items-center rounded-full bg-white px-4 font-semibold text-earth lg:bg-primary lg:text-primary-foreground"
          >
            Raise a need
          </Link>
        ) : null}
      </header>

      {lead && !q ? (
        <p className="text-sm text-muted-foreground" data-testid="kit-totals">
          {open.length} open needs · {toBuy} to buy or borrow · {critical} critical ·{" "}
          {scarce.length} scarce tools
        </p>
      ) : null}

      {q || (lead && openMine.length === 0) ? null : (
        <section aria-labelledby="mine" className="flex flex-col gap-2">
          <h2 id="mine" className="heading text-sm">
            Your team’s needs ({openMine.length})
          </h2>
          {openMine.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {myTeams.length
                ? "Nothing open. Raise a need when your team is short of something."
                : "You're not on a team yet, so there's nothing to raise. You can still search and update counts."}
            </p>
          ) : null}
          <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2">
            {openMine.map((n) => (
              <NeedCard key={n.id} n={n} showTeam={myTeams.length > 1} />
            ))}
          </ul>
        </section>
      )}

      {lead && !q ? (
        <section aria-labelledby="board" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="board" className="heading text-sm">
              {campWide ? "Needs: every team" : "Needs: your teams"} ({rows.length})
            </h2>
            <p className="text-xs">
              Shopping lists:{" "}
              {allTeams.map((t, i) => (
                <span key={t.id}>
                  {i ? " · " : ""}
                  <Link href={`/procurement/list/${t.id}`} className="underline">
                    {t.name}
                  </Link>
                </span>
              ))}
            </p>
          </div>
          <form
            action="/procurement"
            aria-label="Filter and sort needs"
            className="flex flex-wrap items-end gap-2 text-sm"
          >
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Team</span>
              <select
                name="team"
                defaultValue={teamFilter ?? ""}
                className="min-h-11 rounded-md border bg-card px-2"
              >
                <option value="">All teams</option>
                {allTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Status</span>
              <select
                name="status"
                defaultValue={statusFilter ?? ""}
                className="min-h-11 rounded-md border bg-card px-2"
              >
                <option value="">Any status</option>
                {STATUS_ORDER.map((st) => (
                  <option key={st} value={st}>
                    {STATUS_LABEL[st]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Sort by</span>
              <select
                name="sort"
                defaultValue={view.sort ?? "status"}
                className="min-h-11 rounded-md border bg-card px-2"
              >
                {Object.entries(SORTS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="min-h-11 rounded-full bg-primary px-4 font-semibold text-primary-foreground"
            >
              Apply
            </button>
          </form>
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  {["Item", "Team", "Status", "Needed by", "Have it?"].map((h) => (
                    <th key={h} scope="col" className="border-b p-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((n) => (
                  <tr key={n.id} className="border-b align-top last:border-0">
                    <td className="p-3">
                      <Link
                        href={`/procurement/n/${n.id}`}
                        className="font-medium underline [overflow-wrap:anywhere]"
                      >
                        {n.quantityNeeded} {n.unit === "pcs" ? "×" : n.unit} {n.itemName}
                      </Link>
                      {n.isCritical ? (
                        <span className="ml-2">
                          <CriticalTag />
                        </span>
                      ) : null}
                    </td>
                    <td className="p-3">{n.teamName}</td>
                    <td className="p-3">
                      <StatusChip status={n.status} />
                    </td>
                    <td className="whitespace-nowrap p-3">{dueText(n.neededBy)}</td>
                    <td className="p-3">
                      {n.status === "needed" ||
                      n.status === "to_buy" ||
                      n.status === "to_borrow" ? (
                        <HaveItLine check={n.check} />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No open needs match.</p>
            ) : null}
          </div>
          {closed ? (
            <p className="text-xs text-muted-foreground">
              {closed} received or cancelled (not shown).
            </p>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="kit" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="kit" className="heading text-sm">
            {q
              ? `Kit matching “${q}” (${catalogue.length})`
              : view.all
                ? `All kit (${catalogue.length})`
                : `Scarce tools (${scarce.length})`}
          </h2>
          {q ? null : view.all ? (
            <Link href="/procurement" className="text-sm underline">
              Show only scarce tools
            </Link>
          ) : (
            <Link href="/procurement?all=1" className="text-sm underline">
              Show all {catalogue.length} things we own
            </Link>
          )}
        </div>
        {q || view.all ? null : (
          <p className="text-xs text-muted-foreground">
            Search above to find any of the {catalogue.length} things we own.
          </p>
        )}
        {catalogue.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing found. Try a shorter word{manage ? ", or import last year's list below" : ""}.
          </p>
        ) : null}
        {kit.length ? (
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  {["Item", "Type", "Good", "Needs repair", "Broken or missing", "Where"].map(
                    (h) => (
                      <th key={h} scope="col" className="border-b p-3">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {kit.map(({ item, check, lines }) => (
                  <tr key={item.id} className="border-b align-top last:border-0">
                    <td className="p-3">
                      <Link
                        href={`/procurement/i/${item.id}`}
                        className="font-medium underline [overflow-wrap:anywhere]"
                      >
                        {item.name}
                      </Link>
                      {item.isBottleneck ? (
                        <span className="ml-2">
                          <BottleneckTag />
                        </span>
                      ) : null}
                    </td>
                    <td className="p-3">{categoryLabel(item.category)}</td>
                    <td className="p-3 text-right font-semibold">
                      {check.usable} {item.unit}
                    </td>
                    <td className="p-3 text-right">{check.repairable || ""}</td>
                    <td className="p-3 text-right">{check.unusable || ""}</td>
                    <td className="p-3 text-xs">
                      {[
                        ...new Set(lines.filter((l) => l.quantity > 0).map((l) => l.locationName)),
                      ].join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {manage ? (
        <section className="rounded-2xl border bg-card p-4">
          <CsvImportForm />
        </section>
      ) : null}
    </div>
  );
}
