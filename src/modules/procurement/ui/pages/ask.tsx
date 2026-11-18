import Link from "next/link";
import { can, type ModuleContext } from "@/base/api";
import { formatCampDay } from "@/lib/dates";
import { getEnv } from "@/lib/env";
import { myRecentAsks } from "../../server/ask-queries";
import { AskFixes, AskForm } from "../components/ask-forms";

/** "Ask the camp": a lead types a request and sees exactly what the app did with it. */
export async function AskPage({ ctx }: { ctx: ModuleContext }) {
  if (!can(ctx.actor, "procurement.ask"))
    return (
      <div className="mx-auto w-full max-w-xl rounded-2xl border bg-card p-4 text-sm">
        Ask the camp is for team leads. Ask your team lead to file it for you.
      </div>
    );
  const asks = await myRecentAsks(ctx);
  const aiReady = !!getEnv().AI_GATEWAY_API_KEY;
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
      <Link href="/procurement" className="text-sm underline">
        ← Kit and stock
      </Link>
      <div className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        <h1 className="heading text-lg">Ask the camp</h1>
        <p className="text-sm text-muted-foreground">
          {aiReady
            ? "Type what you need. AI files it as a task for the right team (simple keyword matching takes over if the monthly AI limit is used up)."
            : "Demo version: simple keyword and date matching, no AI. Type what you need and it's filed as a task for the right team."}
        </p>
        <AskForm />
      </div>
      {asks.map((a) => (
        <div key={a.id} className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">You asked: “{a.text}”</p>
          <h2 className="font-semibold">Here's what I did</h2>
          <p className="text-sm">
            I made a task for the {a.teamName ?? "team"} team
            {a.guessed ? " (a guess: no word matched, so please check)" : ""}.
          </p>
          <ul className="list-disc pl-5 text-sm">
            <li>Owner: {a.ownerName}</li>
            <li>
              Due:{" "}
              {a.dueOn ? formatCampDay(new Date(`${a.dueOn}T10:00:00Z`), "EEEE d MMMM") : "no date"}
            </li>
            <li>{a.needId ? "Added to the team's buy list" : "Not on the buy list"}</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            Sorted by: {a.router === "ai" ? "AI" : "demo (keywords)"}
            {a.taskId ? (
              <>
                {" · "}
                <Link href={`/tasks/${a.taskId}`} className="underline">
                  Open the task
                </Link>
              </>
            ) : null}
          </p>
          {a.confirmed ? (
            <p className="text-sm">You said this looks right.</p>
          ) : (
            <AskFixes askId={a.id} ownerId={a.ownerId} dueOn={a.dueOn} team={a.team} />
          )}
          {a.fixed ? (
            <p className="text-xs">Your fix is saved, so it gets it right next time.</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
