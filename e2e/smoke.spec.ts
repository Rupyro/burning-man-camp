// Smoke test of the real login and permission path, against the built app and seeded database
// (`pnpm seed`: admin@ / lead@ / member@example.test are invited; nobody@ is not).
import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { SERVER_LOG } from "../playwright.config";

const LOGIN_REPLY = "If that email is invited, a login link is on its way.";

/** Magic links the console email adapter has printed for this address so far. */
function linksFor(email: string): string[] {
  const log = readFileSync(SERVER_LOG, "utf8");
  const re = /\[dev email\] to: (\S+)\n\s+subject: .*\n\s+link: (\S+)/g;
  return [...log.matchAll(re)].filter((m) => m[1] === email).map((m) => m[2] ?? "");
}

async function requestLink(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a login link" }).click();
  await expect(page.getByRole("status")).toHaveText(LOGIN_REPLY);
}

async function logIn(page: Page, email: string) {
  const before = linksFor(email).length;
  await requestLink(page, email);
  await expect.poll(() => linksFor(email).length, { timeout: 10_000 }).toBeGreaterThan(before);
  await page.goto(linksFor(email).at(-1) ?? "");
  await expect(page).toHaveURL(/\/$/);
}

test("an invited member logs in with the emailed link and sees the module tile", async ({
  page,
}) => {
  await logIn(page, "member@example.test");
  await expect(page.getByRole("heading", { name: "Modules" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Travel and loads/ }).first()).toBeVisible();
});

test("an uninvited email gets the same reply but no link", async ({ page }) => {
  await requestLink(page, "nobody@example.test");
  // Give the server time to (not) send anything, then confirm nothing went out.
  await page.waitForTimeout(1500);
  expect(linksFor("nobody@example.test")).toEqual([]);
});

test("signed-out visitors are sent to the login page", async ({ page }) => {
  await page.goto("/logistics");
  await expect(page).toHaveURL(/\/login/);
});

test("a member is blocked from the admin page; an admin can open it", async ({ browser }) => {
  const member = await browser.newPage();
  await logIn(member, "member@example.test");
  const denied = await member.goto("/apply/review");
  expect(denied?.status()).toBe(404);
  await member.close();

  const admin = await browser.newPage();
  await logIn(admin, "admin@example.test");
  const allowed = await admin.goto("/apply/review");
  expect(allowed?.status()).toBe(200);
  await expect(admin.getByRole("navigation", { name: /Applications navigation/ })).toBeVisible();
  await admin.close();
});

test("demo mode is off by default: the usual email login, no role picker", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByText("Demo: pick who you want to be")).toHaveCount(0);
  await expect(page.locator("[data-persona]")).toHaveCount(0);
});
