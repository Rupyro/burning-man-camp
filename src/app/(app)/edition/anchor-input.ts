import { campInputToInstant, instantToCampInput } from "@/lib/dates";

type Get = (key: string) => string;
type Result =
  | {
      ok: true;
      input: {
        key: string;
        label: string;
        startsAt: string;
        endsAt: string | null;
        isConfirmed: boolean;
        sourceNote: string | null;
      };
    }
  | { ok: false; error: string };

const iso = (date: string, time: string) => campInputToInstant(date, time).toISOString();

/** The key-date form (camp time) → saveAnchorDate's input. `fixedKey` = editing that date. */
export function readAnchorForm(get: Get, fixedKey?: string): Result {
  const v = (k: string) => get(k).trim();
  try {
    return {
      ok: true,
      input: {
        key: fixedKey ?? v("key"),
        label: v("label"),
        startsAt: iso(v("startDate"), v("startTime")),
        endsAt: v("endDate") ? iso(v("endDate"), v("endTime")) : null,
        isConfirmed: v("isConfirmed") === "on",
        sourceNote: v("sourceNote") || null,
      },
    };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export function readEditionForm(get: Get) {
  return { title: get("title").trim(), memberCapacity: Number(get("capacity").trim()) };
}

export function capacityLine(confirmed: number, capacity: number | null): string {
  if (capacity === null) return `${confirmed} confirmed (no capacity set).`;
  return `${confirmed} confirmed of ${capacity}${confirmed > capacity ? ": over capacity" : ""}.`;
}

export type AnchorInitial = ReturnType<typeof anchorFormInitial>;

/** Prefill an edit form: the stored instants shown back in camp time. */
export function anchorFormInitial(a: {
  key: string;
  label: string;
  startsAt: Date;
  endsAt: Date | null;
  isConfirmed: boolean;
  sourceNote: string | null;
}) {
  return {
    key: a.key,
    label: a.label,
    start: instantToCampInput(a.startsAt),
    end: a.endsAt ? instantToCampInput(a.endsAt) : null,
    isConfirmed: a.isConfirmed,
    sourceNote: a.sourceNote ?? "",
  };
}
