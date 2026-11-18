import Link from "next/link";
import { formatCampDay } from "@/lib/dates";
import type { HaveIt } from "../../rules/have-it";
import { type NeedStatus, STATUS_LABEL } from "../../rules/status";

const TONE: Record<NeedStatus, string> = {
  needed: "border border-current",
  have_it: "bg-clay text-earth",
  to_buy: "bg-ochre text-earth",
  to_borrow: "bg-ochre text-earth",
  purchase_requested: "bg-dusk text-white",
  ordered: "bg-dusk text-white",
  received: "bg-clay text-earth",
  cancelled: "bg-muted text-muted-foreground line-through",
  built: "bg-clay text-earth",
  not_needed: "bg-muted text-muted-foreground",
};

export function StatusChip({ status }: { status: NeedStatus }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function CriticalTag() {
  return (
    <span className="whitespace-nowrap rounded-full bg-rust px-2 py-0.5 text-xs font-semibold text-white">
      Critical
    </span>
  );
}

export function BottleneckTag() {
  return (
    <span className="whitespace-nowrap rounded-full border border-current px-2 py-0.5 text-xs font-semibold">
      Scarce tool
    </span>
  );
}

/** "Buy 3", "Borrow 2" or "We have enough", as text (colour is never the only signal). */
export function HaveItLine({ check }: { check: HaveIt }) {
  return (
    <p className="text-sm">
      <span className="font-semibold">
        {check.suggestion === "have_it"
          ? "✓ We have enough"
          : `${check.suggestion === "buy" ? "Buy" : "Borrow"} ${check.gap}`}
      </span>
      <span className="text-muted-foreground"> · {check.text}</span>
    </p>
  );
}

export const dueText = (d: string | null) =>
  d ? `by ${formatCampDay(new Date(`${d}T10:00:00Z`))}` : "no date";

export interface NeedCardRow {
  id: string;
  itemName: string;
  teamName: string;
  quantityNeeded: number;
  unit: string;
  status: NeedStatus;
  isCritical: boolean;
  neededBy: string | null;
  check: HaveIt;
}

/** Phone-first card: what, how many, the have-it result and the status. */
export function NeedCard({ n, showTeam = true }: { n: NeedCardRow; showTeam?: boolean }) {
  return (
    <li className="rounded-2xl border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/procurement/n/${n.id}`}
          className="font-medium underline [overflow-wrap:anywhere]"
        >
          {n.quantityNeeded} {n.unit === "pcs" ? "×" : n.unit} {n.itemName}
        </Link>
        <span className="flex flex-wrap justify-end gap-1">
          {n.isCritical ? <CriticalTag /> : null}
          <StatusChip status={n.status} />
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {showTeam ? `${n.teamName} · ` : ""}
        {dueText(n.neededBy)}
      </p>
      {n.status === "needed" || n.status === "to_buy" || n.status === "to_borrow" ? (
        <HaveItLine check={n.check} />
      ) : null}
    </li>
  );
}
