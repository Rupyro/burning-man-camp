"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { isActionFailure } from "@/base/api/action-result";
import { decideFamily } from "../../server/family-actions";

/** 🔥 Welcome them in · Ask a question · Decline kindly. */
export function FamilyDecide({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const act = (decision: "approved" | "asked" | "declined") =>
    start(async () => {
      setMsg(null);
      try {
        const r = await decideFamily({ id, decision, note });
        if (isActionFailure(r)) return setMsg(r.error);
        if (!r.ok) return setMsg(r.error);
        setMsg(decision === "asked" ? "Question noted." : null);
        router.refresh();
      } catch {
        setMsg("No signal? Please try again.");
      }
    });
  return (
    <div className="flex flex-col gap-2">
      <textarea
        aria-label="A note or question (optional)"
        className="journey-input"
        rows={2}
        maxLength={1000}
        value={note}
        placeholder="A note or question (optional)"
        onChange={(e) => setNote(e.target.value)}
      />
      <button
        type="button"
        className="journey-btn"
        disabled={pending}
        onClick={() => act("approved")}
      >
        🔥 Welcome {name.split(" ")[0]} in
      </button>
      <div className="flex gap-2">
        <button
          type="button"
          className="journey-btn is-soft flex-1"
          disabled={pending}
          onClick={() => act("asked")}
        >
          Ask a question
        </button>
        <button
          type="button"
          className="journey-btn is-soft flex-1"
          disabled={pending}
          onClick={() => act("declined")}
        >
          Decline kindly
        </button>
      </div>
      {msg ? (
        <p role="status" className="text-sm">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
