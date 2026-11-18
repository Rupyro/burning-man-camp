import "server-only";
import { redirect } from "next/navigation";
import { can } from "@/base/authz/permissions";
import { getDb } from "@/base/db/client";
import { listMyTasks } from "@/base/engine/tasks";
import { getRequestContext } from "@/base/guard/request";
import { applicantRedirectTarget } from "@/base/landing/applicant";
import { getCountdown, getTeamPulse, listHelpRequests } from "@/base/landing/home";
import { buildQueue, profileRow, rankQueue } from "@/base/landing/home-queue";
import { getLandingData } from "@/base/landing/landing";
import { burnStateOf } from "@/base/people/burn-mode";
import { getPersonView } from "@/base/people/directory";
import { ensureRegistry } from "../../../boot";

/** Everything the home and See all screens show, each list filtered on the server. */
export async function loadHome() {
  const registry = ensureRegistry();
  const rc = await getRequestContext();
  if (!rc) redirect("/login");
  const applicant = applicantRedirectTarget(rc.actor);
  if (applicant) redirect(applicant);
  const now = new Date();
  const ctx = { db: getDb(), actor: rc.actor, edition: rc.edition, now };
  const [landing, mine, help, count, teams, me, burn] = await Promise.all([
    getLandingData(ctx.db, registry, rc.actor, rc.edition, now, 50),
    can(rc.actor, "task.view") ? listMyTasks(ctx) : Promise.resolve([]),
    listHelpRequests(ctx),
    getCountdown(ctx),
    getTeamPulse(ctx),
    rc.actor.personId ? getPersonView(ctx, rc.actor.personId) : Promise.resolve(null),
    rc.actor.personId ? burnStateOf(ctx.db, rc.edition.id, rc.actor.personId) : null,
  ]);
  const details = me
    ? profileRow({
        phone: me.contact?.phone ?? "",
        emergencyName: me.contact?.emergencyContactName ?? "",
        emergencyPhone: me.contact?.emergencyContactPhone ?? "",
        arrival: me.travel.arrivalAt,
      })
    : null;
  const names = new Map(landing.tiles.map((t) => [t.id, t.name]));
  const queue = rankQueue([
    ...(details ? [details] : []),
    ...buildQueue({
      now,
      mine,
      moduleItems: landing.myItems,
      moduleName: (id) => names.get(id) ?? id,
      help,
      teams,
    }),
  ]);
  return { rc, ctx, now, landing, count, teams, queue, burn, lead: teams !== null };
}
