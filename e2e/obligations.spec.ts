// Obligations smoke: the tile, the members' list, and the manager-only edit form.
import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { SERVER_LOG } from "../playwright.config";

function linksFor(email: string): string[] {
  const log = readFileSync(SERVER_LOG, "utf8");
  const re = /\[dev email\] to: (\S+)\n\s+subject: .*\n\s+link: (\S+)/g;
  return [...log.matchAll(re)].filter((m) => m[1] === email).map((m) => m[2] ?? "");
}

async function logIn(page: Page, email: string) {
  const before = linksFor(email).length;
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a login link" }).click();
  await expect.poll(() => linksFor(email).length, { timeout: 10_000 }).toBeGreaterThan(before);
  await page.goto(linksFor(email).at(-1) ?? "");
  await expect(page).toHaveURL(/\/$/);
}

test("a member sees the deadlines tile and the list, but no edit form; unknown ids are 404", async ({
  page,
}) => {
  await logIn(page, "member@example.test");
  await page
    .getByRole("link", { name: /AfrikaBurn deadlines/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/obligations$/);
  await expect(page.getByRole("heading", { name: "AfrikaBurn deadlines" })).toBeVisible();
  await page.getByRole("link", { name: "Mutant vehicle registration" }).first().click();
  await expect(page.getByText("TBC (2026: 5 Apr)").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Edit" })).toHaveCount(0);
  const res = await page.goto("/obligations/01900000-0000-7000-8000-00000000dead");
  expect(res?.status()).toBe(404);
});

test("an admin gets the edit form on an obligation", async ({ page }) => {
  await logIn(page, "admin@example.test");
  await page.goto("/obligations");
  await page.getByRole("link", { name: "Mutant vehicle registration" }).first().click();
  await expect(page.getByRole("heading", { name: "Edit" })).toBeVisible();
  await expect(page.getByLabel("Owner")).toBeVisible();
});
