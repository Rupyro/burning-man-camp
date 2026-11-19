"use client";
import { newProject, newTask } from "@/base/engine/server/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CAMP_TZ_LABEL } from "@/lib/dates";
import { ActionForm } from "../_components/action-form";
import { readTaskForm } from "../tasks/task-view";
import { readProjectForm } from "./project-view";

const getter = (f: FormData) => (k: string) => String(f.get(k) ?? "");

export function NewProjectForm({ teams }: { teams: { id: string; name: string }[] }) {
  return (
    <ActionForm
      label="Start project"
      done="Project started."
      read={async (f) => {
        const r = readProjectForm(getter(f));
        return r.ok ? newProject(r.input) : r;
      }}
    >
      <Label htmlFor="project-team">Team</Label>
      <select id="project-team" name="teamId" className="min-h-11 rounded-md border px-2">
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <Label htmlFor="project-name">Name</Label>
      <Input id="project-name" name="name" className="min-h-11" />
    </ActionForm>
  );
}

export function AddTaskForm({ projectId, me }: { projectId: string; me?: string }) {
  return (
    <ActionForm
      label="Add task"
      done="Task added."
      read={async (f) => {
        const r = readTaskForm(projectId, getter(f), me);
        return r.ok ? newTask(r.input) : r;
      }}
    >
      <Label htmlFor="task-title">Title</Label>
      <Input id="task-title" name="title" className="min-h-11" />
      <Label htmlFor="task-due-date">Due (date, optional)</Label>
      <Input id="task-due-date" name="dueDate" type="date" className="min-h-11" />
      <Label htmlFor="task-due-time">Due (time, {CAMP_TZ_LABEL})</Label>
      <Input id="task-due-time" name="dueTime" type="time" className="min-h-11" />
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="takeIt" /> I'll own this task
      </label>
    </ActionForm>
  );
}
