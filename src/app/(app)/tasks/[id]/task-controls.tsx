"use client";
import {
  addChecklist,
  addTaskHelper,
  comment,
  decideTaskClaim,
  editTask,
  leaveTask,
  linkTasks,
  openForHelpers,
  removeChecklist,
  removeComment,
  setOwner,
  tickChecklist,
  watch,
} from "@/base/engine/server/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ActionForm } from "../../_components/action-form";
import {
  MODE_CHOICES,
  readClaimModeForm,
  readDueForm,
  readStatusForm,
  STATUS_CHOICES,
} from "./task-page-view";

type Result = { ok: true } | { ok: false; error: string };
type Option = { value: string; label: string };
const getter = (f: FormData) => (k: string) => String(f.get(k) ?? "");

/** A one-button form. */
export function Act(p: { label: string; run: () => Promise<Result> }) {
  return (
    <ActionForm label={p.label} read={p.run}>
      {null}
    </ActionForm>
  );
}

function Select(p: { name: string; label: string; options: readonly Option[]; value?: string }) {
  const id = `f-${p.name}`;
  return (
    <>
      <Label htmlFor={id}>{p.label}</Label>
      <select
        id={id}
        name={p.name}
        defaultValue={p.value}
        className="min-h-11 rounded-md border px-2"
      >
        {p.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </>
  );
}

function Text(p: { name: string; label: string; type?: string; value?: string }) {
  return (
    <>
      <Label htmlFor={`f-${p.name}`}>{p.label}</Label>
      <Input
        id={`f-${p.name}`}
        name={p.name}
        type={p.type}
        defaultValue={p.value}
        className="min-h-11"
      />
    </>
  );
}

export function StatusForm(p: { taskId: string; status: string; reason: string }) {
  return (
    <ActionForm
      label="Save status"
      read={async (f) => {
        const r = readStatusForm(getter(f));
        return r.ok ? editTask({ taskId: p.taskId, patch: r.input }) : r;
      }}
    >
      <Select name="status" label="Status" options={STATUS_CHOICES} value={p.status} />
      <Text name="blockedReason" label="If blocked, why?" value={p.reason} />
    </ActionForm>
  );
}

export function DueForm(p: { taskId: string; date: string; time: string }) {
  return (
    <ActionForm
      label="Save due date"
      read={(f) => editTask({ taskId: p.taskId, patch: readDueForm(getter(f)) })}
    >
      <Text name="dueDate" label="Due (date; empty = none)" type="date" value={p.date} />
      <Text name="dueTime" label="Due (time, SAST)" type="time" value={p.time} />
    </ActionForm>
  );
}

export function OwnerForm(p: { taskId: string; owner: string; people: readonly Option[] }) {
  return (
    <ActionForm
      label="Save owner"
      read={(f) => setOwner({ taskId: p.taskId, ownerPersonId: getter(f)("owner") || null })}
    >
      <Select
        name="owner"
        label="Owner"
        options={[{ value: "", label: "No owner" }, ...p.people]}
        value={p.owner}
      />
    </ActionForm>
  );
}

export function ClaimModeForm(p: { taskId: string; mode: string; capacity: string }) {
  return (
    <ActionForm
      label="Save"
      read={async (f) => {
        const r = readClaimModeForm(getter(f));
        return r.ok ? openForHelpers({ taskId: p.taskId, ...r.input }) : r;
      }}
    >
      <Select name="claimMode" label="Who can help" options={MODE_CHOICES} value={p.mode} />
      <Text
        name="claimCapacity"
        label="Helpers needed (optional)"
        type="number"
        value={p.capacity}
      />
    </ActionForm>
  );
}

export function HelperControls(p: {
  assignmentId: string;
  decide: boolean;
  leave: boolean;
  remove: boolean;
}) {
  const a = { assignmentId: p.assignmentId };
  return (
    <div className="flex flex-wrap gap-2">
      {p.decide ? (
        <Act label="Approve" run={() => decideTaskClaim({ ...a, approve: true })} />
      ) : null}
      {p.decide ? (
        <Act label="Decline" run={() => decideTaskClaim({ ...a, approve: false })} />
      ) : null}
      {p.leave ? <Act label="Leave" run={() => leaveTask(a)} /> : null}
      {p.remove ? <Act label="Remove" run={() => leaveTask(a)} /> : null}
    </div>
  );
}

export function AddHelperForm(p: { taskId: string; people: readonly Option[] }) {
  return (
    <ActionForm
      label="Add helper"
      read={(f) => addTaskHelper({ taskId: p.taskId, personId: getter(f)("helper") })}
    >
      <Select name="helper" label="Add someone" options={p.people} />
    </ActionForm>
  );
}

export function LinkForm(p: { taskId: string; tasks: readonly Option[] }) {
  return (
    <ActionForm
      label="Add"
      read={(f) =>
        linkTasks({ taskId: p.taskId, dependsOnTaskId: getter(f)("prereq"), remove: false })
      }
    >
      <Select name="prereq" label="Waits on (same project)" options={p.tasks} />
    </ActionForm>
  );
}

export function UnlinkButton(p: { taskId: string; dependsOnTaskId: string }) {
  return <Act label="Remove link" run={() => linkTasks({ ...p, remove: true })} />;
}

export function ChecklistControls(p: {
  itemId: string;
  done: boolean;
  tick: boolean;
  remove: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {p.tick ? (
        <Act
          label={p.done ? "Untick" : "Tick"}
          run={() => tickChecklist({ itemId: p.itemId, done: !p.done })}
        />
      ) : null}
      {p.remove ? <Act label="Remove" run={() => removeChecklist({ itemId: p.itemId })} /> : null}
    </div>
  );
}

export function ChecklistAddForm({ taskId }: { taskId: string }) {
  return (
    <ActionForm label="Add item" read={(f) => addChecklist({ taskId, label: getter(f)("label") })}>
      <Text name="label" label="New checklist item" />
    </ActionForm>
  );
}

export function CommentForm({ taskId }: { taskId: string }) {
  return (
    <ActionForm
      label="Comment"
      done="Posted."
      read={(f) => comment({ taskId, body: getter(f)("body") })}
    >
      <Label htmlFor="f-body">Comment</Label>
      <textarea id="f-body" name="body" rows={3} className="rounded-md border p-2" />
    </ActionForm>
  );
}

export function RemoveCommentButton({ commentId }: { commentId: string }) {
  return <Act label="Remove" run={() => removeComment({ commentId })} />;
}

export function WatchButton(p: { taskId: string; watching: boolean }) {
  return (
    <Act
      label={p.watching ? "Stop watching" : "Watch"}
      run={() => watch({ taskId: p.taskId, on: !p.watching })}
    />
  );
}
