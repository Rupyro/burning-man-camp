"use server";
import { z } from "zod";
import { getDb } from "../../db/client";
import { setAnchorDate, updateEdition } from "../../editions/settings";
import { ValidationError } from "../../errors";
import { sessionAction } from "../../guard/module-action";
import { grantRole, revokeRole } from "../../roles/roles";
import { removeTeamMember, setTeamMember } from "../../teams/teams";
import { applyImport, planImport } from "../import/import";
import { IMPORT_FIELDS, type ImportField } from "../import/mapping";
import { addAdminNote, setMemberStatus, updateProfile } from "../members";

// Base screens' actions. sessionAction resolves the caller on the server; every service
// function below checks its own capability against the record (Forbidden is re-thrown).

type Ctx = Parameters<Parameters<typeof sessionAction>[1]>[0];
export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(ctx: Ctx, fn: (c: Ctx & { db: ReturnType<typeof getDb> }) => Promise<T>) {
  try {
    return { ok: true as const, data: await fn({ ...ctx, db: getDb() }) };
  } catch (error) {
    if (error instanceof ValidationError) {
      const detail = error.issues.map((i) => `${i.path}: ${i.message}`).join("; ");
      return { ok: false as const, error: detail ? `${error.message} (${detail})` : error.message };
    }
    throw error;
  }
}

const id = z.string().uuid();

export const saveMyProfile = sessionAction(
  { input: z.object({ patch: z.record(z.string(), z.unknown()) }) },
  (ctx, { patch }) => run(ctx, (c) => updateProfile(c, c.actor.personId ?? "", patch)),
);

export const changeMemberStatus = sessionAction(
  {
    input: z.object({
      personId: id,
      status: z.enum(["prospect", "waitlisted", "confirmed", "withdrawn", "removed"]),
    }),
    capability: "member.manage",
  },
  (ctx, i) => run(ctx, (c) => setMemberStatus(c, i.personId, i.status)),
);

export const addNote = sessionAction(
  {
    input: z.object({ personId: id, body: z.string().max(2000) }),
    capability: "member.admin_notes",
  },
  (ctx, i) => run(ctx, async (c) => (await addAdminNote(c, i.personId, i.body)).id),
);

export const changeTeamMember = sessionAction(
  {
    input: z.object({
      teamId: id,
      personId: id,
      role: z.enum(["lead", "co_lead", "member"]).nullable(),
    }),
  },
  (ctx, i) =>
    run(ctx, (c) =>
      i.role === null
        ? removeTeamMember(c, i)
        : setTeamMember(c, { teamId: i.teamId, personId: i.personId, role: i.role }),
    ),
);

export const changeRole = sessionAction(
  {
    input: z.object({ personId: id, roleKey: z.string().max(40), grant: z.boolean() }),
    capability: "role.assign",
  },
  (ctx, i) => run(ctx, (c) => (i.grant ? grantRole(c, i) : revokeRole(c, i))),
);

export const saveEdition = sessionAction(
  {
    input: z.object({ memberCapacity: z.number().int().optional(), title: z.string().optional() }),
    capability: "edition.manage",
  },
  (ctx, i) => run(ctx, (c) => updateEdition(c, i)),
);

export const saveAnchorDate = sessionAction(
  {
    input: z.object({
      key: z.string(),
      label: z.string(),
      startsAt: z.string(),
      endsAt: z.string().nullable().optional(),
      isConfirmed: z.boolean(),
      sourceNote: z.string().nullable().optional(),
    }),
    capability: "edition.manage",
  },
  (ctx, i) => run(ctx, (c) => setAnchorDate(c, i)),
);

const importInput = z.object({
  csv: z.string().max(2_000_000),
  fileName: z.string().max(200),
  mapping: z
    .array(z.enum(Object.keys(IMPORT_FIELDS) as [ImportField, ...ImportField[]]).nullable())
    .optional(),
  resolutions: z
    .record(z.string(), z.union([z.enum(["create", "skip"]), z.object({ link: id })]))
    .optional(),
});
type ImportArgs = Parameters<typeof planImport>[1];
const toImport = (i: z.output<typeof importInput>): ImportArgs => ({
  ...i,
  resolutions: i.resolutions
    ? Object.fromEntries(Object.entries(i.resolutions).map(([k, v]) => [Number(k), v]))
    : undefined,
});

export const importDryRun = sessionAction(
  { input: importInput, capability: "member.import" },
  (ctx, i) => run(ctx, (c) => planImport(c, toImport(i))),
);

export const importApply = sessionAction(
  { input: importInput, capability: "member.import" },
  (ctx, i) => run(ctx, (c) => applyImport(c, toImport(i))),
);
