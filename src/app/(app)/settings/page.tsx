import Link from "next/link";
import { can } from "@/base/authz/permissions";
import { ForbiddenError } from "@/base/errors";
import { AUTOMATION_SETTINGS, getAutomationSettings } from "@/base/settings/automation";
import { basePage } from "../_components/base-page";
import { SettingForm, type SettingRow } from "./setting-form";

/** Camp settings for the automatic rules. Admins only; everyone else gets a 404. */
export default async function SettingsPage() {
  const values = await basePage(async (ctx) => {
    if (!can(ctx.actor, "admin.settings")) throw new ForbiddenError();
    return getAutomationSettings(ctx.db);
  });
  const rows: SettingRow[] = AUTOMATION_SETTINGS.map((d) => ({
    key: d.key,
    kind: d.kind,
    label: d.label,
    help: d.help,
    value: values[d.key] ?? d.defaultValue,
    defaultValue: d.defaultValue,
  }));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="heading text-lg">Camp settings</h1>
      <p className="text-sm text-muted-foreground">
        These control the things the app does on its own. Change any of them at any time. Each
        change is saved with your name.
      </p>
      <Link href="/settings/imports" className="text-sm underline">
        Imports to review
      </Link>
      {rows.map((s) => (
        <section key={s.key} className="rounded-2xl border bg-card p-4">
          <SettingForm s={s} />
        </section>
      ))}
    </div>
  );
}
