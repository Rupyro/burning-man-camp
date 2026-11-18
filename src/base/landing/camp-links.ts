import type { Actor } from "../authz/actor";
import { can } from "../authz/permissions";

const human = (key: string) => {
  const s = key.replaceAll("_", " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** The base's own links on the landing page, and a "you are" line, from the caller's real roles. */
export function campSection(actor: Actor) {
  const links = [{ href: "/me", label: "My profile" }];
  if (can(actor, "member.view_directory")) {
    links.push({ href: "/people", label: "People" }, { href: "/teams", label: "Teams" });
  }
  if (can(actor, "member.import")) links.push({ href: "/people/import", label: "Import members" });

  const youAre = [
    ...[...actor.roles].sort().map(human),
    ...actor.teams
      .filter((t) => t.role !== "member")
      .map((t) => `${human(t.teamKey)} ${t.role === "lead" ? "lead" : "co-lead"}`),
  ];
  if (!youAre.length)
    youAre.push(
      actor.memberStatus
        ? human(actor.memberStatus === "confirmed" ? "member" : actor.memberStatus)
        : "Alumni",
    );
  return { links, youAre };
}

/** Admin-side settings screens on the landing page (spec b1-12 E6). */
export function settingsLinks(actor: Actor) {
  const links: { href: string; label: string }[] = [];
  if (can(actor, "edition.manage")) links.push({ href: "/edition", label: "Edition settings" });
  return links;
}

/** The Camp settings screen for the automatic rules (Oct 28 2026). Admins only. */
export function campSettingsLinks(actor: Actor) {
  return can(actor, "admin.settings") ? [{ href: "/settings", label: "Camp settings" }] : [];
}

/** Links to the task screens (spec S1–S4). Notifications are personal, so everyone with a person. */
export function workLinks(actor: Actor) {
  const links: { href: string; label: string }[] = [];
  if (can(actor, "task.view"))
    links.push({ href: "/tasks", label: "My tasks" }, { href: "/projects", label: "Projects" });
  if (actor.personId) links.push({ href: "/notifications", label: "Alerts" });
  return links;
}
