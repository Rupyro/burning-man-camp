import { Check, Circle, CircleDot, X } from "lucide-react";
import { formatCampDay } from "@/lib/dates";
import type { StepState, TrackerStep } from "../../rules/journey";

const ICON: Record<StepState, typeof Check> = {
  done: Check,
  current: CircleDot,
  todo: Circle,
  stopped: X,
};
const STATE_TEXT: Record<StepState, string> = {
  done: "done",
  current: "you are here",
  todo: "to come",
  stopped: "stopped",
};

/** Not applied → Applied → Interview → Accepted → Joined. State is text and icon, not colour only. */
export function Tracker({ steps }: { steps: TrackerStep[] }) {
  return (
    <ol aria-label="Application status" className="grid grid-cols-5 gap-1">
      {steps.map((s) => {
        const Icon = ICON[s.state];
        return (
          <li
            key={s.key}
            aria-current={s.state === "current" ? "step" : undefined}
            className="flex flex-col items-center gap-1 text-center"
          >
            <span
              className={`grid size-9 place-items-center rounded-full border-2 ${
                s.state === "done"
                  ? "border-earth bg-earth text-ochre"
                  : s.state === "current"
                    ? "border-earth bg-ochre text-earth"
                    : s.state === "stopped"
                      ? "border-destructive text-destructive"
                      : "border-muted-foreground/50 text-muted-foreground"
              }`}
            >
              <Icon aria-hidden className="size-4" />
            </span>
            <span className="text-[11px] leading-tight font-semibold sm:text-xs">{s.label}</span>
            <span className="sr-only">({STATE_TEXT[s.state]})</span>
            {s.key === "interview" && s.at ? (
              <span className="text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
                {formatCampDay(s.at, "d MMM, HH:mm")}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
