"use client";
import { claim, readAllNotifications, readNotification } from "@/base/engine/server/actions";
import { ActionForm } from "../_components/action-form";

/** One-button forms for the task and notification lists. */
export function ClaimButton(p: { taskId: string; label: string }) {
  return (
    <ActionForm
      label={p.label}
      done="Thanks! It's in your list."
      read={() => claim({ taskId: p.taskId })}
    >
      {null}
    </ActionForm>
  );
}

export function MarkReadButton({ id }: { id: string }) {
  return (
    <ActionForm label="Mark done" done="Done." read={() => readNotification({ id })}>
      {null}
    </ActionForm>
  );
}

export function MarkAllReadButton() {
  return (
    <ActionForm label="Mark all done" done="Done." read={() => readAllNotifications({})}>
      {null}
    </ActionForm>
  );
}
