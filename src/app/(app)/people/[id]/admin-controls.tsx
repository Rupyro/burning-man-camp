"use client";
import {
  addNote,
  changeMemberStatus,
  changeRole,
  changeTeamMember,
} from "@/base/people/server/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ActionForm } from "../../_components/action-form";

const sel = "min-h-11 rounded-md border px-2";
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export function AdminControls(p: {
  personId: string;
  status: string | null;
  canManage: boolean;
  canNotes: boolean;
  roles: { key: string; label: string; held: boolean }[] | null;
  teams: { id: string; name: string }[];
}) {
  const STATUSES = ["prospect", "waitlisted", "confirmed", "withdrawn", "removed"] as const;
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-3">
      <h2 className="font-semibold">Manage</h2>
      {p.canManage ? (
        <ActionForm
          label="Set status"
          read={(f) =>
            changeMemberStatus({
              personId: p.personId,
              status: str(f, "status") as (typeof STATUSES)[number],
            })
          }
        >
          <Label htmlFor="status">Status this year</Label>
          <select id="status" name="status" defaultValue={p.status ?? "prospect"} className={sel}>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </ActionForm>
      ) : null}
      {p.teams.length ? (
        <ActionForm
          label="Update team"
          read={(f) => {
            const role = str(f, "role");
            return changeTeamMember({
              personId: p.personId,
              teamId: str(f, "team"),
              role: role === "remove" ? null : (role as "lead" | "co_lead" | "member"),
            });
          }}
        >
          <Label htmlFor="team">Team</Label>
          <select id="team" name="team" className={sel}>
            {p.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select aria-label="Team role" name="role" className={sel} defaultValue="member">
            <option value="member">member</option>
            <option value="co_lead">co-lead</option>
            <option value="lead">lead</option>
            <option value="remove">remove from team</option>
          </select>
        </ActionForm>
      ) : null}
      {p.roles ? (
        <ActionForm
          label="Grant / revoke"
          read={(f) => {
            const key = str(f, "role");
            const held = p.roles?.find((r) => r.key === key)?.held ?? false;
            return changeRole({ personId: p.personId, roleKey: key, grant: !held });
          }}
        >
          <Label htmlFor="role">Role (held roles are revoked)</Label>
          <select id="role" name="role" className={sel}>
            {p.roles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.held ? `✓ ${r.label} (revoke)` : r.label}
              </option>
            ))}
          </select>
        </ActionForm>
      ) : null}
      {p.canNotes ? (
        <ActionForm
          label="Add note"
          read={(f) => addNote({ personId: p.personId, body: str(f, "note") })}
        >
          <Label htmlFor="note">Admin-only note</Label>
          <Input id="note" name="note" maxLength={2000} className="min-h-11" />
        </ActionForm>
      ) : null}
    </div>
  );
}
