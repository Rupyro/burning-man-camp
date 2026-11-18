"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CAMP_NAME } from "@/lib/camp";
import { whatsappLink } from "../../rules/draft-writer";
import {
  discardDraft,
  editDraft,
  makeDraft,
  markWhatsappOpened,
  sendDraft,
} from "../../server/drafts";
import { area, Form, field, Status, s, select, useAction } from "./forms";

export function DraftForm() {
  const { msg, pending, run } = useAction();
  return (
    <Form
      onSubmit={(f) =>
        run(
          () =>
            makeDraft({
              kind: s(f, "kind") === "whatsapp" ? "whatsapp" : "email",
              to: s(f, "to"),
              ask: s(f, "ask"),
            }),
          "Draft ready below. Nothing is sent yet.",
        )
      }
    >
      <Label htmlFor="draft-kind">What kind?</Label>
      <select id="draft-kind" name="kind" className={select} defaultValue="email">
        <option value="email">Vendor email</option>
        <option value="whatsapp">WhatsApp update</option>
      </select>
      <Label htmlFor="draft-to">To</Label>
      <Input
        id="draft-to"
        name="to"
        required
        maxLength={200}
        className={field}
        placeholder="Email or group name"
        aria-describedby="draft-to-hint"
      />
      <p id="draft-to-hint" className="text-xs text-muted-foreground">
        For example <span className="whitespace-nowrap">orders@tankwa-ice.example</span> or{" "}
        <span className="whitespace-nowrap">{CAMP_NAME} Camp group</span>
      </p>
      <Label htmlFor="draft-ask">What should it say?</Label>
      <textarea
        id="draft-ask"
        name="ask"
        rows={2}
        maxLength={1000}
        required
        className={area}
        placeholder="a quote for 200 kg of ice delivered on 27 April"
      />
      <Button type="submit" disabled={pending} className="min-h-11">
        Write a draft
      </Button>
      <Status msg={msg} />
    </Form>
  );
}

export function DraftActions(props: {
  id: string;
  kind: string;
  to: string;
  subject: string | null;
  body: string;
}) {
  const { msg, pending, run } = useAction();
  const email = props.kind === "email";
  return (
    <div className="flex flex-col gap-2">
      {email ? (
        <Button
          type="button"
          disabled={pending}
          className="min-h-11"
          onClick={() => run(() => sendDraft({ id: props.id }), "Sent.")}
        >
          Send email
        </Button>
      ) : (
        <a
          href={whatsappLink(props.body)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          onClick={() =>
            run(
              () => markWhatsappOpened({ id: props.id }),
              "WhatsApp is open with the message. Press Send there.",
            )
          }
        >
          Open in WhatsApp
        </a>
      )}
      <details>
        <summary className="cursor-pointer text-sm underline">Edit</summary>
        <Form
          onSubmit={(f) =>
            run(
              () =>
                editDraft({
                  id: props.id,
                  to: s(f, "to"),
                  subject: email ? s(f, "subject") : undefined,
                  body: s(f, "body"),
                }),
              "Saved.",
            )
          }
        >
          <Input name="to" aria-label="To" defaultValue={props.to} className={field} required />
          {email ? (
            <Input
              name="subject"
              aria-label="Subject"
              defaultValue={props.subject ?? ""}
              className={field}
            />
          ) : null}
          <textarea
            name="body"
            aria-label="Message"
            rows={8}
            defaultValue={props.body}
            className={area}
            required
          />
          <Button type="submit" variant="outline" disabled={pending} className="min-h-11">
            Save changes
          </Button>
        </Form>
      </details>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        className="min-h-11"
        onClick={() => run(() => discardDraft({ id: props.id }), "Discarded.")}
      >
        Discard
      </Button>
      <Status msg={msg} />
    </div>
  );
}
