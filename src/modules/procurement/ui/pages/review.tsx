import Link from "next/link";
import type { ModuleContext } from "@/base/api";
import { friendlyReviewDate, spendLine } from "../../rules/review";
import { dailyReview } from "../../server/review-queries";

const FIX_WORDS: Record<string, string> = {
  looks_right: "said it looks right",
  change_owner: "changed the owner",
  change_date: "changed the date",
};

/** Admin daily review of what the AI parts did yesterday. */
export async function ReviewPage({ ctx }: { ctx: ModuleContext }) {
  const r = await dailyReview(ctx);
  if (!r.allowed)
    return (
      <div className="mx-auto w-full max-w-xl rounded-2xl border bg-card p-4 text-sm">
        The daily review is for camp admins.
      </div>
    );
  const card = "flex flex-col gap-2 rounded-2xl border bg-card p-4";
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
      <Link href="/procurement" className="text-sm underline">
        ← Kit and stock
      </Link>
      <h1 className="heading text-lg">Daily review for {friendlyReviewDate(r.date)}</h1>
      <div className={card}>
        <h2 className="font-semibold">Worth a look</h2>
        {r.flags.length ? (
          <ul className="list-disc pl-5 text-sm">
            {r.flags.map((f) => (
              <li key={f.text}>{f.text}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">Nothing odd yesterday.</p>
        )}
      </div>
      <div className={card}>
        <h2 className="font-semibold">Asks ({r.asks.length})</h2>
        {r.asks.length ? (
          <ul className="list-disc pl-5 text-sm">
            {r.asks.map((a) => (
              <li key={a.id}>
                “{a.text}” went to {a.teamName ?? "a team"} ({a.router === "ai" ? "AI" : "demo"})
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">None yesterday.</p>
        )}
      </div>
      <div className={card}>
        <h2 className="font-semibold">Fixes leads made ({r.fixes.length})</h2>
        {r.fixes.length ? (
          <ul className="list-disc pl-5 text-sm">
            {r.fixes.map((f) => (
              <li key={f.id}>
                A {f.teamName ?? ""} lead {FIX_WORDS[f.action] ?? f.action}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">None yesterday.</p>
        )}
      </div>
      <div className={card}>
        <h2 className="font-semibold">Drafts ({r.drafts.length})</h2>
        {r.drafts.length ? (
          <ul className="list-disc pl-5 text-sm">
            {r.drafts.map((d) => (
              <li key={d.id}>
                {d.kind === "email" ? "Email" : "WhatsApp"} to {d.toText}: {d.status} (
                {d.writer === "ai" ? "AI" : "demo"})
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">None yesterday.</p>
        )}
      </div>
      <div className={card}>
        <h2 className="font-semibold">Running total</h2>
        <p className="text-sm">{spendLine(r.spentCents, r.capCents)}</p>
      </div>
    </div>
  );
}
