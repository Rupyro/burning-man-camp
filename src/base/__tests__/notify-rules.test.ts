// Pure notification rules: channel choice (spec N2) and the digest email (spec N4).
import { describe, expect, it } from "vitest";
import { channelFor } from "@/base/engine/rules/channels";
import { buildDigest } from "@/base/engine/rules/digest";

describe("channelFor", () => {
  it("uses the person's choice for the type, then their '*', then the default", () => {
    expect(channelFor("task.assigned", [])).toBe("email_immediate");
    expect(channelFor("task.overdue", [])).toBe("email_digest");
    expect(channelFor("shifts.gap", [])).toBe("email_digest");
    const prefs = [
      { type: "*", channel: "in_app" as const },
      { type: "task.overdue", channel: "email_immediate" as const },
    ];
    expect(channelFor("task.overdue", prefs)).toBe("email_immediate");
    expect(channelFor("task.assigned", prefs)).toBe("in_app");
  });
});

describe("buildDigest", () => {
  it("groups in a fixed order, unknown types last under Other, and counts", () => {
    const d = buildDigest(
      [
        { type: "shifts.gap", title: "Gap: Bar Fri", href: "/shifts/1" },
        { type: "task.comment", title: "New comment: Paint", href: "/tasks/2" },
        { type: "task.overdue", title: "Overdue: Gas", href: "/tasks/3" },
      ],
      "https://camp.test",
    );
    expect(d.subject).toBe("Oe-aa-sies: 3 updates");
    expect(d.text.indexOf("Overdue\n")).toBeLessThan(d.text.indexOf("New comments\n"));
    expect(d.text).toContain("Other\n- Gap: Bar Fri\n  https://camp.test/shifts/1");
    expect(d.text).toContain("https://camp.test/notifications");
  });

  it("says 'update' for one", () => {
    expect(buildDigest([{ type: "task.comment", title: "x", href: "/" }], "").subject).toBe(
      "Oe-aa-sies: 1 update",
    );
  });
});
