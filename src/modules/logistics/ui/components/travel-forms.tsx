"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DIRECTION_LABEL, type Direction, MODE_LABEL, type Mode } from "../../rules/rides";
import { answerRide, askRide, cancelRide, saveTravel } from "../../server/travel";
import { Form, field, Status, s, select, useAction } from "./forms";

export interface TravelValues {
  mode: Mode;
  travelDate: string | null;
  timeOfDay: "morning" | "afternoon" | "evening" | "flexible";
  areaPlaceId: string | null;
  areaDetail: string | null;
  seats: number | null;
  carriesCargo: boolean;
  notes: string | null;
}

/** Your plan for one direction. Seats mean "offering" or "need" depending on the choice. */
export function TravelForm(props: {
  direction: Direction;
  plan: TravelValues | null;
  areas: { id: string; name: string }[];
}) {
  const { msg, pending, run } = useAction();
  const [mode, setMode] = useState<Mode>(props.plan?.mode ?? "need_ride");
  const p = props.plan;
  const k = props.direction;
  return (
    <Form
      onSubmit={(f) =>
        run(
          () =>
            saveTravel({
              direction: k,
              mode,
              travelDate: s(f, "date") || null,
              timeOfDay: s(f, "time") as TravelValues["timeOfDay"],
              areaPlaceId: s(f, "area") || null,
              areaDetail: s(f, "areaDetail"),
              seats: mode === "own_arrangement" ? null : Number(s(f, "seats") || 1),
              carriesCargo: f.get("cargo") === "on",
              notes: s(f, "notes"),
            }),
          "Saved.",
        )
      }
    >
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-semibold">{DIRECTION_LABEL[k]}</legend>
        <div className="flex flex-wrap gap-2">
          {(["need_ride", "offering_ride", "own_arrangement"] as const).map((m) => (
            <label
              key={m}
              className="flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm has-[:checked]:bg-primary has-[:checked]:text-primary-foreground"
            >
              <input
                type="radio"
                name={`mode-${k}`}
                value={m}
                checked={mode === m}
                onChange={() => setMode(m)}
              />
              {MODE_LABEL[m]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`date-${k}`}>Day</Label>
          <input
            id={`date-${k}`}
            name="date"
            type="date"
            defaultValue={p?.travelDate ?? ""}
            className={`${field} rounded-md border bg-card px-2`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`time-${k}`}>Time</Label>
          <select
            id={`time-${k}`}
            name="time"
            defaultValue={p?.timeOfDay ?? "flexible"}
            className={select}
          >
            <option value="flexible">Any time</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
          </select>
        </div>
      </div>
      {mode === "own_arrangement" ? null : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`area-${k}`}>
                {mode === "offering_ride" ? "Leaving from" : "Pick me up in"}
              </Label>
              <select
                id={`area-${k}`}
                name="area"
                defaultValue={p?.areaPlaceId ?? ""}
                className={select}
              >
                <option value="">Anywhere</option>
                {props.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`seats-${k}`}>
                {mode === "offering_ride" ? "Free seats" : "Seats needed"}
              </Label>
              <input
                id={`seats-${k}`}
                name="seats"
                type="number"
                min={1}
                max={mode === "offering_ride" ? 20 : 10}
                defaultValue={p?.seats ?? 1}
                className={`${field} rounded-md border bg-card px-2`}
              />
            </div>
          </div>
          {mode === "offering_ride" ? (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" name="cargo" defaultChecked={p?.carriesCargo ?? false} />I can
              take some camp kit too
            </label>
          ) : null}
        </>
      )}
      <Label htmlFor={`notes-${k}`}>Notes (optional)</Label>
      <input
        id={`notes-${k}`}
        name="notes"
        defaultValue={p?.notes ?? ""}
        maxLength={500}
        className={`${field} rounded-md border bg-card px-2`}
        placeholder="e.g. leaving after work"
      />
      <input type="hidden" name="areaDetail" value={p?.areaDetail ?? ""} />
      <Button type="submit" disabled={pending} className="min-h-11 self-start">
        Save
      </Button>
      <Status msg={msg} />
    </Form>
  );
}

export function AskButton({
  passengerPlanId,
  driverPlanId,
}: {
  passengerPlanId: string;
  driverPlanId: string;
}) {
  const { msg, pending, run } = useAction();
  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        disabled={pending}
        className="min-h-11"
        onClick={() =>
          run(
            () => askRide({ passengerPlanId, driverPlanId }),
            "Asked. They'll see it in My stuff.",
          )
        }
      >
        Ask for a seat
      </Button>
      <Status msg={msg} />
    </div>
  );
}

export function RideActions({ matchId, canAnswer }: { matchId: string; canAnswer: boolean }) {
  const { msg, pending, run } = useAction();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {canAnswer ? (
          <>
            <Button
              type="button"
              disabled={pending}
              className="min-h-11"
              onClick={() =>
                run(() => answerRide({ matchId, answer: "accepted" }), "You said yes.")
              }
            >
              Yes, there's space
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              className="min-h-11"
              onClick={() => run(() => answerRide({ matchId, answer: "declined" }), "You said no.")}
            >
              Sorry, no
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="min-h-11"
            onClick={() => run(() => cancelRide({ matchId }), "Called off.")}
          >
            Call it off
          </Button>
        )}
      </div>
      <Status msg={msg} />
    </div>
  );
}
