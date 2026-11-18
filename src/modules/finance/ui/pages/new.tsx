import Link from "next/link";
import type { ModuleContext } from "@/base/api";
import { budgetOf, teamsOf } from "../../server/queries";
import { RequestSteps } from "../components/bits";
import { RequestForm } from "../components/forms";

export async function NewRequestPage({ ctx }: { ctx: ModuleContext }) {
  const teams = [];
  for (const t of await teamsOf(ctx.db, ctx.actor))
    if (await budgetOf(ctx.db, ctx.edition.id, t.id)) teams.push(t);
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <Link href="/finance" className="text-sm underline">
        ← Money
      </Link>
      <h1 className="heading text-xl">Request money</h1>
      <RequestSteps />
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="heading mb-3 text-sm">Step 1: what do you need?</h2>
        {teams.length ? (
          <RequestForm teams={teams} />
        ) : (
          <p className="text-sm">None of your teams has a budget yet. Ask finance to set one.</p>
        )}
      </section>
    </div>
  );
}
