import { Check, Circle } from "lucide-react";
import Link from "next/link";
import type { ModuleContext } from "@/base/api";
import { CAMP_NAME } from "@/lib/camp";
import { Emblem } from "@/lib/emblem";
import { proteaStage } from "@/lib/family-years";
import { familyLine } from "../../rules/family";
import { welcomeTodos } from "../../rules/welcome";
import { familyFor } from "../../server/family-queries";
import { myApplication } from "../../server/queries";
import { GuideReadButton } from "../components/forms";

/** Welcome list (automatic rule 6): a new member's first three things to do. */
export async function WelcomePage({ ctx }: { ctx: ModuleContext }) {
  const app = await myApplication(ctx.db, ctx.edition.id, ctx.actor.personId ?? "");
  const first = ctx.actor.displayName.split(" ")[0] ?? "";
  const todos = welcomeTodos({
    joinedAt: app?.joinedAt ?? null,
    paidAt: app?.paidAt ?? null,
    guideReadAt: app?.guideReadAt ?? null,
  });
  const fam = await familyFor(ctx.db, ctx.actor.personId ?? "");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="heading text-lg">You're in, {first}!</h1>
      {fam.confirmed.length ? (
        <div className="family-memento">
          <span aria-hidden className="family-memento-lamp">
            <Emblem stage={proteaStage(fam.confirmed.length)} head />
          </span>
          <div>
            <p className="text-lg font-bold">{CAMP_NAME} Family</p>
            <p className="text-sm">{familyLine(fam.confirmed, ctx.now)}</p>
          </div>
        </div>
      ) : null}
      <p className="text-sm">We're so glad you're joining us. Here are three things to do first.</p>
      <ul className="flex flex-col gap-2">
        {todos.map((t) => (
          <li key={t.key} className="flex gap-3 rounded-2xl border bg-card p-4">
            {t.done ? (
              <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
            ) : (
              <Circle aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            )}
            <div className="flex flex-col gap-1">
              {t.done || t.key === "fee" ? (
                <span
                  className={t.done ? "font-semibold line-through opacity-70" : "font-semibold"}
                >
                  {t.title}
                  {t.done ? <span className="sr-only"> (done)</span> : null}
                </span>
              ) : (
                <Link href={t.href} className="font-semibold underline">
                  {t.title}
                </Link>
              )}
              <span className="text-sm text-muted-foreground">{t.line}</span>
              {t.key === "guide" && !t.done ? <GuideReadButton /> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
