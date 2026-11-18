import Link from "next/link";
import { can } from "@/base/authz/permissions";
import { listDirectory } from "@/base/people/directory";
import { capacityStatus } from "@/base/people/members";
import { basePage } from "../_components/base-page";

export default async function PeoplePage(props: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await props.searchParams;
  const { list, capacity, manage } = await basePage(async (ctx) => ({
    list: await listDirectory(ctx, { allStatuses: all === "1" }),
    capacity: await capacityStatus(ctx.db, ctx.edition.id),
    manage: can(ctx.actor, "member.manage"),
  }));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="heading text-lg">People</h1>
      <p className="text-sm text-muted-foreground">
        {capacity.confirmed} confirmed of {capacity.capacity ?? "no"} places.
        {manage ? (
          <Link className="ml-2 underline" href={all === "1" ? "/people" : "/people?all=1"}>
            {all === "1" ? "Confirmed only" : "Show every status"}
          </Link>
        ) : null}
      </p>
      <ul className="flex flex-col gap-2">
        {list.map((p) => (
          <li key={p.personId} className="rounded-2xl border bg-card p-3">
            <Link
              href={`/people/${p.personId}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {p.displayName}
            </Link>
            {p.playaName ? <span className="text-muted-foreground"> · {p.playaName}</span> : null}
            {p.status ? (
              <span className="ml-2 text-xs text-muted-foreground">{p.status}</span>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {[
                p.teams
                  .map((t) =>
                    t.role === "member" ? t.name : `${t.name} (${t.role.replace("_", "-")})`,
                  )
                  .join(", "),
                p.skills.join(", "),
                p.countryCode,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {p.contact ? (
              <p className="text-sm">
                {p.contact.email}
                {p.contact.phone ? ` · ${p.contact.phone}` : ""}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
