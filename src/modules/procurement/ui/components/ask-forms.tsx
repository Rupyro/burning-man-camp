"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { askTheCamp, fixAsk } from "../../server/ask";
import { area, Form, field, Status, s, select, useAction } from "./forms";

export function AskForm() {
  const { msg, pending, run } = useAction();
  return (
    <Form
      onSubmit={(f) =>
        run(() => askTheCamp({ text: s(f, "text") }), "Done. Here's what I did, below.")
      }
    >
      <Label htmlFor="ask-text">What do you need?</Label>
      <textarea
        id="ask-text"
        name="text"
        rows={2}
        maxLength={500}
        required
        className={area}
        placeholder="need 20 kg of ice by Tuesday"
      />
      <Button type="submit" disabled={pending} className="min-h-11">
        Send
      </Button>
      <Status msg={msg} />
    </Form>
  );
}

export function AskFixes(props: {
  askId: string;
  ownerId: string | null;
  dueOn: string | null;
  team: { id: string; name: string }[];
}) {
  const { msg, pending, run } = useAction();
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        disabled={pending}
        className="min-h-11"
        onClick={() =>
          run(() => fixAsk({ askId: props.askId, action: "looks_right" }), "Thanks, noted.")
        }
      >
        Looks right
      </Button>
      <details>
        <summary className="cursor-pointer text-sm underline">Change owner</summary>
        <Form
          onSubmit={(f) =>
            run(
              () =>
                fixAsk({
                  askId: props.askId,
                  action: "change_owner",
                  ownerPersonId: s(f, "owner"),
                }),
              "Owner changed. I'll remember this for next time.",
            )
          }
        >
          <select
            name="owner"
            aria-label="New owner"
            className={select}
            defaultValue={props.ownerId ?? ""}
          >
            {props.team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" disabled={pending} className="min-h-11">
            Save owner
          </Button>
        </Form>
      </details>
      <details>
        <summary className="cursor-pointer text-sm underline">Change date</summary>
        <Form
          onSubmit={(f) =>
            run(
              () => fixAsk({ askId: props.askId, action: "change_date", dueOn: s(f, "due") }),
              "Date changed.",
            )
          }
        >
          <Input
            type="date"
            name="due"
            aria-label="New due date"
            required
            className={field}
            defaultValue={props.dueOn ?? ""}
          />
          <Button type="submit" variant="outline" disabled={pending} className="min-h-11">
            Save date
          </Button>
        </Form>
      </details>
      <Status msg={msg} />
    </div>
  );
}
