// Camp settings for the automatic rules (Oct 28 2026). Each rule reads its number here, so an
// admin can change it on the Settings page without a code change. Defaults live in code.

import { stableUuid } from "@/lib/crypto";
import { recordAudit } from "../audit/audit";
import { can } from "../authz/permissions";
import type { DbOrTx } from "../db/client";
import { type EngineCtx, nowOf } from "../engine/shared";
import { ForbiddenError, ValidationError } from "../errors";
import { automationSettings } from "../schema";

export type SettingKind = "onoff" | "days" | "money";

export interface SettingDef {
  key: string;
  kind: SettingKind;
  label: string;
  help: string;
  defaultValue: number;
  min: number;
  max: number;
}

const onoff = (key: string, label: string, help: string): SettingDef => ({
  key,
  kind: "onoff",
  label,
  help,
  defaultValue: 1,
  min: 0,
  max: 1,
});

export const AUTOMATION_SETTINGS: readonly SettingDef[] = [
  onoff(
    "shift_standby_offer",
    "Offer dropped shifts to standby",
    "When someone drops a shift, offer it to the first person on standby and tell the team lead who took it.",
  ),
  {
    key: "buy_alert_days",
    kind: "days",
    label: "Buy-list warning",
    help: "Tell the team lead when an item is still not bought this many days before it's needed.",
    defaultValue: 5,
    min: 1,
    max: 30,
  },
  {
    key: "auto_approve_limit_cents",
    kind: "money",
    label: "Small requests approve themselves",
    help: "Money requests under this amount are approved straight away. The treasurer still sees each one in a weekly list. Set to 0 to turn this off.",
    defaultValue: 50_000,
    min: 0,
    max: 500_000,
  },
  {
    key: "task_quiet_days",
    kind: "days",
    label: "Quiet tasks go back to the lead",
    help: "If nobody has touched a task for this many days, send it back to the team lead to give to someone else.",
    defaultValue: 7,
    min: 2,
    max: 60,
  },
  {
    key: "fee_reminder_days",
    kind: "days",
    label: "First fee reminder",
    help: "Send the member a friendly reminder this many days after their camp fee is due.",
    defaultValue: 1,
    min: 1,
    max: 30,
  },
  {
    key: "fee_lead_days",
    kind: "days",
    label: "Tell the team lead about an unpaid fee",
    help: "If the fee is still unpaid this many days after the first reminder, tell the member's team lead.",
    defaultValue: 7,
    min: 1,
    max: 60,
  },
  {
    key: "ai_monthly_cap_cents",
    kind: "money",
    label: "Monthly AI limit",
    help: "The most the AI parts may spend in a month. When it's used up, Ask the camp goes back to the simple keyword version until next month. Set to 0 to keep AI off.",
    defaultValue: 15_000,
    min: 0,
    max: 200_000,
  },
  onoff(
    "welcome_todos",
    "Welcome list for new members",
    "When an application is accepted, give the new member their first three to-dos: pay the fee, pick shifts and read the camp guide.",
  ),
];

export type AutomationSettings = Record<string, number>;

const defOf = (key: string) => AUTOMATION_SETTINGS.find((d) => d.key === key);

/** Every setting with its current value (the default when nobody has changed it). */
export async function getAutomationSettings(db: DbOrTx): Promise<AutomationSettings> {
  const rows = await db.select().from(automationSettings);
  const out: AutomationSettings = {};
  for (const d of AUTOMATION_SETTINGS)
    out[d.key] = rows.find((r) => r.key === d.key)?.value ?? d.defaultValue;
  return out;
}

/** Admin-only. Checks the limits and records the change in the audit log. */
export async function setAutomationSetting(ctx: EngineCtx, key: string, value: number) {
  if (!ctx.actor.isSystem && !can(ctx.actor, "admin.settings")) throw new ForbiddenError();
  const def = defOf(key);
  if (!def) throw new ValidationError("There's no setting with that name");
  if (!Number.isInteger(value) || value < def.min || value > def.max)
    throw new ValidationError(`${def.label}: pick a value from ${def.min} to ${def.max}`);
  const before = (await getAutomationSettings(ctx.db))[key];
  const now = nowOf(ctx);
  await ctx.db
    .insert(automationSettings)
    .values({ key, value, updatedByPersonId: ctx.actor.personId, updatedAt: now })
    .onConflictDoUpdate({
      target: automationSettings.key,
      set: { value, updatedByPersonId: ctx.actor.personId, updatedAt: now },
    });
  await recordAudit(
    ctx.db,
    { actor: ctx.actor, editionId: ctx.edition.id },
    {
      action: "camp.automation_setting_changed",
      entity: { type: "base.automation_setting", id: stableUuid(`automation_setting:${key}`) },
      changes: { key: [key, key], value: [before ?? null, value] },
      significance: "significant",
    },
  );
  return { key, value };
}
