import type { ObligationState } from "../../rules/status";
import { STATE_LABEL } from "../../rules/status";

const TONE: Record<ObligationState, string> = {
  late: "bg-rust text-white",
  due_soon: "bg-ochre text-earth",
  no_owner: "border border-current",
  open: "bg-clay text-earth",
  done: "bg-dusk text-white",
  cancelled: "bg-muted text-muted-foreground line-through",
};

export function StateChip({ state }: { state: ObligationState }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[state]}`}
    >
      {STATE_LABEL[state]}
    </span>
  );
}

/** "TBC" dates use the typewriter accent so they read as provisional. */
export function DueText({ text, tentative }: { text: string; tentative: boolean }) {
  return <span className={tentative ? "italic" : "font-semibold"}>{text}</span>;
}
