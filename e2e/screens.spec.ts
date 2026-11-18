// Screens + accessibility in demo mode (CI runs it after `pnpm seed:demo` with DEMO_MODE=true):
// the role picker, the home page and every module home, on a phone (390) as a member and on a
// laptop (1280) as a team lead, in day and night. Each page must load, show its main content, not
// scroll sideways, and have no serious or critical axe (WCAG 2 A/AA) violations.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

// Only collected with DEMO_MODE=true (see testIgnore in playwright.config.ts).

const PAGES = [
  "/",
  "/up-next",
  "/camp",
  "/shifts",
  "/obligations",
  "/finance",
  "/procurement",
  "/logistics",
] as const;
const VIEWS = [
  { width: 390, height: 844, persona: "member" },
  { width: 1280, height: 900, persona: "kitchen_lead" },
] as const;
const MODES = ["day", "night"] as const;

async function check(page: Page, name: string) {
  await expect(page.getByRole("main")).toBeVisible();
  // Let colour transitions (day → night after a reload) settle so axe reads final colours.
  await page.evaluate(() => Promise.allSettled(document.getAnimations().map((a) => a.finished)));
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect.soft(overflow, `${name} scrolls sideways`).toBeLessThanOrEqual(1);
  await expectBackdropPhoto(page, name);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const bad = axe.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect.soft(bad, `${name} accessibility`).toEqual([]);
  await test.info().attach(`${name}.png`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

// Brand-book backdrop (PR #99, #104): every page shows today's photo behind the content. It must
// be a known photo (rock or road; no stale "fence"), resolve to a real image for the current day or
// night mode, fill the viewport behind everything, and not be painted over by an opaque page surface.
async function expectBackdropPhoto(page: Page, name: string) {
  const bd = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".backdrop");
    const root = document.documentElement;
    if (!el) return null;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    // Opaque surfaces between the backdrop and the viewer at the four edges' midpoints and centre.
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pts: [number, number][] = [
      [w / 2, 2],
      [2, h / 2],
      [w - 3, h / 2],
      [w / 2, h - 3],
      [w / 2, h / 2],
    ];
    const opaque = pts.filter(([x, y]) =>
      document.elementsFromPoint(x, y).some((e) => {
        if (e === root || e === document.body) return false;
        const m = getComputedStyle(e).backgroundColor.match(/[\d.]+/g);
        return (
          !!m &&
          (m.length === 3 || Number(m[3]) >= 0.99) &&
          e.getBoundingClientRect().width >= w - 1 &&
          e.getBoundingClientRect().height >= h - 1
        );
      }),
    ).length;
    return {
      photo: root.dataset.photo ?? "",
      night: root.classList.contains("theme-night"),
      image: s.backgroundImage,
      z: s.zIndex,
      covers: r.left <= 0 && r.top <= 0 && r.right >= w - 1 && r.bottom >= h - 1,
      opaque,
    };
  });
  expect(bd, `${name}: backdrop element`).not.toBeNull();
  if (!bd) return;
  expect.soft(["rock", "road"], `${name}: html[data-photo]`).toContain(bd.photo);
  expect
    .soft(bd.image, `${name}: backdrop image`)
    .toContain(`/backdrop/${bd.photo}-${bd.night ? "night" : "day"}-`);
  expect.soft(bd.z, `${name}: backdrop z-index`).toBe("-1");
  expect.soft(bd.covers, `${name}: backdrop fills the viewport`).toBe(true);
  expect.soft(bd.opaque, `${name}: full-screen opaque surface over the backdrop`).toBe(0);
}

// Home redesign (docs/specs/b3-home-up-next.md, B3.2 My to-do): queue, cards, team rows and readiness panel.
// Run inside the signed-in tests below: magic-link sign-ins are rate limited per minute.
async function memberHome(page: Page) {
  await page.goto("/");
  const queue = page.getByRole("region", { name: "My to-do" });
  await expect(queue).toBeVisible();
  const rows = await queue.getByRole("listitem").count();
  expect(rows).toBeGreaterThan(0);
  expect(rows).toBeLessThanOrEqual(5);
  await expect(queue.getByText(/shift/i)).toHaveCount(0);
  await expect(page.getByText(/^\d+ days to build · \d+ to gates$/)).toBeVisible();
  const cards = page.getByRole("region", { name: "Everything else" });
  await expect(cards.getByRole("link", { name: /Shifts/ })).toContainText("New");
  await expect(cards.getByRole("link", { name: /Camp info/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Team readiness" })).toHaveCount(0);
  await queue.getByRole("link", { name: /See all/ }).click();
  await expect(page).toHaveURL(/\/up-next$/);
  await page.goto("/");
  await cards.getByRole("link", { name: /Shifts/ }).click();
  await expect(page.getByRole("heading", { name: "Shifts" })).toBeVisible();
}

async function leadHome(page: Page, tag: string) {
  await page.goto("/");
  const lead = page.getByRole("region", { name: "My to-do · waiting on you" });
  const row = lead.getByText(/^Kitchen: \d+ late$/);
  await expect(row).toHaveCount(1);
  const task = lead.getByRole("link", { name: /Buy shade-net clips/ });
  await expect(task).toBeHidden();
  await row.click();
  await expect(task).toBeVisible();
  const panel = page.getByRole("region", { name: "Team readiness" });
  const icon = page.getByRole("button", { name: "Team readiness" });
  await expect(panel).toBeVisible();
  await expect(icon).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel).toBeHidden();
  await icon.click();
  const dialog = page.getByRole("dialog", { name: "Team readiness" });
  await expect(dialog.getByRole("progressbar", { name: /Kitchen/ })).toBeVisible();
  await check(page, `lead-readiness-dialog-390-${tag}`);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
}

for (const view of VIEWS) {
  for (const mode of MODES) {
    test(`${view.width} ${mode}: role picker, home and module homes as ${view.persona}`, async ({
      browser,
    }) => {
      test.setTimeout(120_000);
      const ctx = await browser.newContext({
        viewport: { width: view.width, height: view.height },
      });
      await ctx.addInitScript((m) => localStorage.setItem("oe-theme", m), mode);
      const page = await ctx.newPage();
      const tag = `${view.width}-${mode}`;

      await page.goto("/login");
      await expect(page.getByText("Demo: pick who you want to be")).toBeVisible();
      await expect(page.locator("[data-persona]")).toHaveCount(7);
      await check(page, `login-${tag}`);

      await page.click(`[data-persona=${view.persona}]`);
      await page.waitForURL((u) => !u.pathname.startsWith("/login"));
      for (const path of PAGES) {
        const res = await page.goto(path);
        expect(res?.status(), path).toBe(200);
        await page.waitForLoadState("networkidle");
        await check(page, `${path === "/" ? "home" : path.slice(1)}-${tag}`);
      }
      if (view.persona === "member") await memberHome(page);
      else await leadHome(page, mode);
      await ctx.close();
    });
  }
}

// Applicants (docs/specs/applicants.md): the applicant persona lands on /apply, sees only applicant
// screens (no member, money or lead pages), and leads get the Open applications list.
// One sign-in per test: Better Auth's magic-link plugin allows 5 sign-ins a minute, and this spec
// signs in 6 times, so back off a full window and retry if verify answers "Too many requests".
async function signInAs(page: Page, persona: string, landing: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto("/login");
    await page.click(`[data-persona=${persona}]`);
    await page.waitForURL((u) => u.pathname === landing || u.pathname.startsWith("/api/auth"));
    await page.waitForLoadState("domcontentloaded");
    if (new URL(page.url()).pathname === landing) return;
    if (!(await page.getByText("Too many requests").count())) {
      await page.waitForURL((u) => u.pathname === landing);
      return;
    }
    await page.waitForTimeout(61_000);
  }
  throw new Error(`could not sign in as ${persona}`);
}

async function setMode(page: Page, mode: (typeof MODES)[number]) {
  await page.evaluate((m) => localStorage.setItem("oe-theme", m), mode);
  await page.reload();
}

test("applicant: lands on My application, only applicant screens, 390/1280 day/night", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    if (!localStorage.getItem("oe-theme")) localStorage.setItem("oe-theme", "day");
  });
  const page = await ctx.newPage();
  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
  await signInAs(page, "applicant", "/apply");
  await expect(page.getByRole("list", { name: "Application status" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Required documents and forms" })).toBeVisible();
  await check(page, "apply-home-390-day");
  await setMode(page, "night");
  await check(page, "apply-home-390-night");
  await page.setViewportSize({ width: 1280, height: 900 });
  await setMode(page, "day");
  await check(page, "apply-home-1280-day");

  await page.goto("/apply/form");
  await expect(page.getByRole("heading", { name: "Application form" })).toBeVisible();
  await expect(page.getByText(/PLACEHOLDER/).first()).toBeVisible();
  await check(page, "apply-form-1280-day");

  // Member, money and lead pages are not found; member-only base pages send them home to /apply.
  for (const path of ["/finance", "/finance/fees", "/procurement", "/shifts", "/apply/review"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
  }
  for (const path of ["/", "/camp", "/up-next"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/apply$/);
  }
  await ctx.close();
});

test("lead: Open applications at 1280 and 390, then one application", async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await signInAs(page, "kitchen_lead", "/");
  const res = await page.goto("/apply");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveURL(/\/apply\/review$/);
  await expect(page.getByRole("heading", { name: "Open applications" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Filter by stage" })).toBeVisible();
  await check(page, "apply-review-1280-day");
  await page.setViewportSize({ width: 390, height: 844 });
  await check(page, "apply-review-390-day");
  await page.locator("a[href^='/apply/review/']").first().click();
  await expect(page).toHaveURL(/\/apply\/review\/[0-9a-f-]{36}$/);
  await check(page, "apply-detail-390-day");
  await ctx.close();
});
