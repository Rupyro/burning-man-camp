import Link from "next/link";
import { listPlannableTeams, listProjects } from "@/base/engine/projects";
import { basePage } from "../_components/base-page";
import { NewProjectForm } from "./project-forms";
import { groupByTeam } from "./project-view";

/** Every project this year by team, as cards (so they read differently from task lists). */
export default async function ProjectsPage() {
  const { projects, teams } = await basePage(async (ctx) => ({
    projects: await listProjects(ctx),
    teams: await listPlannableTeams(ctx),
  }));
  const groups = groupByTeam(projects);
  return (
    <div className="flex flex-col gap-8">
      <h1 className="heading text-lg">Projects</h1>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects yet.</p>
      ) : (
        groups.map((g) => (
          <section key={g.teamName} className="flex flex-col gap-3">
            <h2 className="heading text-sm">{g.teamName}</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.projects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="flex h-full min-h-20 flex-col justify-between gap-2 rounded-2xl border bg-card p-4 hover:border-primary"
                  >
                    <span className="text-base font-semibold">{p.name}</span>
                    <span className="text-xs tracking-wide text-muted-foreground">
                      {p.depth ? "Workstream" : "Project"} · {g.teamName}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {teams.length > 0 ? (
        <section aria-labelledby="new" className="flex flex-col gap-2">
          <h2 id="new" className="heading text-sm">
            Start a project
          </h2>
          <NewProjectForm teams={teams} />
        </section>
      ) : null}
    </div>
  );
}
