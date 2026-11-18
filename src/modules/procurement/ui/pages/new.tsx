import Link from "next/link";
import type { ModuleContext } from "@/base/api";
import { listItems, teamsOf } from "../../server/queries";
import { RaiseNeedForm } from "../components/need-forms";

/** Raise a need for one of your teams (phone-first). */
export async function NewNeedPage({ ctx, itemId }: { ctx: ModuleContext; itemId?: string }) {
  const [teams, items] = await Promise.all([
    teamsOf(
      ctx.db,
      ctx.actor.teams.map((t) => t.teamId),
    ),
    listItems(ctx.db),
  ]);
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 rounded-2xl border bg-card p-4">
      <Link href="/procurement" className="text-sm underline">
        ← Kit and stock
      </Link>
      <h1 className="heading text-lg">Raise a need</h1>
      {teams.length ? (
        <>
          <p className="text-sm text-muted-foreground">
            We'll check what we already own and tell your team lead what's left to buy or borrow.
          </p>
          <RaiseNeedForm
            teams={teams}
            items={items.map(({ item }) => ({ id: item.id, name: item.name, unit: item.unit }))}
            itemId={itemId}
          />
        </>
      ) : (
        <p className="text-sm">
          You need to be on a team to raise a need. Ask a team lead to add you.
        </p>
      )}
    </div>
  );
}
