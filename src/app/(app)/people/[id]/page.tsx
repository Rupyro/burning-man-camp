import { notFound } from "next/navigation";
import { can } from "@/base/authz/permissions";
import { getPersonView } from "@/base/people/directory";
import { listRoleHolders, listRoles } from "@/base/roles/roles";
import { listTeams } from "@/base/teams/teams";
import { basePage } from "../../_components/base-page";
import { AdminControls } from "./admin-controls";
import { personFacts } from "./facts";

export default async function PersonPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { view, roles, teams } = await basePage(async (ctx) => {
    const view = await getPersonView(ctx, id);
    const roles = can(ctx.actor, "role.assign")
      ? await Promise.all([listRoles(ctx.db), listRoleHolders(ctx)]).then(([all, held]) =>
          all.map((r) => ({
            key: r.key,
            label: r.label,
            held: held.some((h) => h.personId === id && h.roleKey === r.key),
          })),
        )
      : null;
    const teams = (await listTeams(ctx)).filter((t) =>
      can(ctx.actor, "team.manage_members", { teamId: t.id, role: "member" }),
    );
    return { view, roles, teams };
  });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="heading text-lg">
        {view.displayName}
        {view.playaName ? <span className="text-muted-foreground"> · {view.playaName}</span> : null}
      </h1>
      <section className="flex flex-col gap-1 text-sm">
        {personFacts(view).map(([k, v]) => (
          <p key={k}>
            <span className="text-muted-foreground">{k}:</span> {v}
          </p>
        ))}
      </section>
      {view.adminNotes ? (
        <section className="text-sm">
          <h2 className="font-semibold">Admin notes</h2>
          {view.adminNotes.length ? (
            <ul className="list-disc pl-5">
              {view.adminNotes.map((n) => (
                <li key={n.id}>{n.body}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">None.</p>
          )}
        </section>
      ) : null}
      {view.can.manage || view.can.notes || roles || teams.length ? (
        <AdminControls
          personId={id}
          status={view.status}
          canManage={view.can.manage}
          canNotes={view.can.notes}
          roles={roles}
          teams={teams.map((x) => ({ id: x.id, name: x.name }))}
        />
      ) : null}
    </div>
  );
}
