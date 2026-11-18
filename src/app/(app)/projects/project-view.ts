// Pure helpers for the project screens (spec S2).

type Get = (key: string) => string;
interface ProjectRow {
  id: string;
  name: string;
  teamName: string;
  parentProjectId: string | null;
}

/** Projects grouped by team (input order kept), each workstream right after its parent. */
export function groupByTeam<T extends ProjectRow>(rows: readonly T[]) {
  const groups: { teamName: string; projects: (T & { depth: number })[] }[] = [];
  const ids = new Set(rows.map((r) => r.id));
  for (const top of rows.filter((r) => !r.parentProjectId || !ids.has(r.parentProjectId))) {
    let g = groups.find((x) => x.teamName === top.teamName);
    if (!g) {
      g = { teamName: top.teamName, projects: [] };
      groups.push(g);
    }
    g.projects.push({ ...top, depth: 0 });
    for (const child of rows.filter((r) => r.parentProjectId === top.id))
      g.projects.push({ ...child, depth: 1 });
  }
  return groups;
}

export function taskCounts(rows: readonly { status: string | null; urgency: string }[]) {
  const open = rows.filter((r) => r.status !== "done" && r.status !== "cancelled").length;
  const overdue = rows.filter((r) => r.urgency === "overdue").length;
  const done = rows.filter((r) => r.status === "done").length;
  return `${open} open · ${overdue} overdue · ${done} done`;
}

export function readProjectForm(get: Get) {
  const teamId = get("teamId");
  const name = get("name").trim();
  if (!teamId) return { ok: false as const, error: "Pick a team." };
  if (!name) return { ok: false as const, error: "Give the project a name." };
  return { ok: true as const, input: { teamId, name } };
}
