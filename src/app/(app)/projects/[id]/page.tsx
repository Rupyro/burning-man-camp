import Link from "next/link";
import { getProject } from "@/base/engine/projects";
import { listProjectTasks } from "@/base/engine/tasks";
import { basePage } from "../../_components/base-page";
import { dueLabel, statusLabel } from "../../tasks/task-view";
import { AddTaskForm } from "../project-forms";
import { taskCounts } from "../project-view";

/** S2 Project: its tasks with status, owner and due date, and a form to add one. Plain markup. */
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project, tasks, me } = await basePage(async (ctx) => ({
    project: await getProject(ctx, id),
    tasks: await listProjectTasks(ctx, id),
    me: ctx.actor.personId ?? undefined,
  }));
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="heading text-lg">{project.name}</h1>
        <p className="text-sm text-muted-foreground">
          {project.teamName} · {taskCounts(tasks)}
        </p>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((t) => (
            <li key={t.id} className="rounded-2xl border bg-card p-3">
              <Link
                href={`/tasks/${t.id}`}
                className="font-medium underline [overflow-wrap:anywhere]"
              >
                {t.title}
              </Link>
              <p className="text-sm">
                {statusLabel(t.status)} · {t.ownerName ?? "No owner"} ·{" "}
                {dueLabel(t.dueAt, t.urgency)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {project.can.addTask ? (
        <section aria-labelledby="add" className="flex flex-col gap-2">
          <h2 id="add" className="heading text-sm">
            Add a task
          </h2>
          <AddTaskForm projectId={project.id} me={me} />
        </section>
      ) : null}
    </div>
  );
}
