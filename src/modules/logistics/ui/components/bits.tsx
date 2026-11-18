import { formatCampDay, formatCampTime } from "@/lib/dates";
import { LOAD_STATUS_LABEL, type LoadStatus } from "../../rules/loads";

const TONE: Record<LoadStatus, string> = {
  planned: "border border-current",
  packing: "bg-ochre text-earth",
  in_transit: "bg-dusk text-white",
  delivered: "bg-clay text-earth",
  cancelled: "bg-muted text-muted-foreground line-through",
};

export function LoadChip({ status }: { status: LoadStatus }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[status]}`}
    >
      {LOAD_STATUS_LABEL[status]}
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

/** A YYYY-MM-DD camp day as "Wed 21 Apr". */
export const dayText = (d: string | null) =>
  d ? formatCampDay(new Date(`${d}T10:00:00Z`), "EEE d MMM") : "date not set";

export const departsText = (at: Date | null) =>
  at ? formatCampTime(at, "EEE d MMM, HH:mm") : "no departure time yet";

export const TIME_LABEL = {
  morning: "morning",
  afternoon: "afternoon",
  evening: "evening",
  flexible: "any time",
} as const;
