// Camp settings for the automatic rules: defaults until an admin changes them, admin-only
// changes with limits, and every change audited.
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { EDITION, getDb } from "@/base/api/testing-db";
import { ForbiddenError, ValidationError } from "@/base/errors";
import { auditEvents } from "@/base/schema";
import {
  AUTOMATION_SETTINGS,
  getAutomationSettings,
  setAutomationSetting,
} from "@/base/settings/automation";
import { as, type PeopleIds, peopleFixture } from "./people-fixture";

let ids: PeopleIds;
const ctx = async (id: string) => ({ ...(await as(id)), edition: EDITION, now: new Date() });

describe("automation settings", () => {
  beforeEach(async () => {
    ids = await peopleFixture();
  });

  it("starts with the defaults", async () => {
    const s = await getAutomationSettings(getDb());
    expect(s.buy_alert_days).toBe(5);
    expect(s.auto_approve_limit_cents).toBe(50_000);
    expect(s.task_quiet_days).toBe(7);
    expect(s.shift_standby_offer).toBe(1);
    expect(s.welcome_todos).toBe(1);
    expect(Object.keys(s).sort()).toEqual(AUTOMATION_SETTINGS.map((d) => d.key).sort());
  });

  it("an admin changes one and it is audited", async () => {
    await setAutomationSetting(await ctx(ids.admin), "buy_alert_days", 10);
    expect((await getAutomationSettings(getDb())).buy_alert_days).toBe(10);
    await setAutomationSetting(await ctx(ids.admin), "buy_alert_days", 3);
    expect((await getAutomationSettings(getDb())).buy_alert_days).toBe(3);
    const audit = await getDb()
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "camp.automation_setting_changed"));
    expect(audit).toHaveLength(2);
  });

  it("team leads and members can't change settings", async () => {
    await expect(
      setAutomationSetting(await ctx(ids.lead), "buy_alert_days", 9),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      setAutomationSetting(await ctx(ids.gift), "auto_approve_limit_cents", 0),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses values outside the limits and unknown settings", async () => {
    const admin = await ctx(ids.admin);
    await expect(setAutomationSetting(admin, "buy_alert_days", 0)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(setAutomationSetting(admin, "welcome_todos", 2)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(setAutomationSetting(admin, "nope", 1)).rejects.toBeInstanceOf(ValidationError);
  });
});
