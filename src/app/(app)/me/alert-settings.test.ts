// My profile → Alert settings (Sage, 21 Oct 2026): one compact form, one clearly-labelled Save.
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AlertSettings, readAlertSettings } from "./alert-settings";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("@/base/engine/server/actions", () => ({ saveNotificationPreference: vi.fn() }));

const prefs = [
  { type: "task.assigned", channel: "in_app" },
  { type: "task.late", channel: "email_digest" },
];

describe("AlertSettings", () => {
  it("one select per kind and a single 'Save alert settings' button", () => {
    const out = renderToStaticMarkup(h(AlertSettings, { prefs }));
    expect(out.match(/<select/g)).toHaveLength(2);
    expect(out.match(/type="submit"/g)).toHaveLength(1);
    expect(out).toContain("Save alert settings");
  });

  it("reads every row; an unknown channel is refused with a message", () => {
    const get = (m: Record<string, string>) => (k: string) => m[k] ?? "";
    expect(
      readAlertSettings(
        ["task.assigned", "task.late"],
        get({ "channel-task.assigned": "off", "channel-task.late": "in_app" }),
      ),
    ).toEqual({
      ok: true,
      inputs: [
        { type: "task.assigned", channel: "off" },
        { type: "task.late", channel: "in_app" },
      ],
    });
    expect(
      readAlertSettings(["task.late"], get({ "channel-task.late": "carrier pigeon" })).ok,
    ).toBe(false);
  });
});
