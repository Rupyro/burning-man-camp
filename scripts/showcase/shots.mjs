// Screenshots + axe for a module: node shots.mjs <base> <outdir> <spec.json>

import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const [base, out, specFile] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specFile, "utf8"));
const browser = await chromium.launch();
const problems = [];
for (const v of spec.views) {
  for (const mode of ["day", "night"]) {
    const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height ?? 900 } });
    await ctx.addInitScript((m) => localStorage.setItem("oe-theme", m), mode);
    const page = await ctx.newPage();
    await page.goto(`${base}/login`);
    await page.click(`[data-persona=${v.persona}]`);
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    for (const s of v.shots) {
      await page.goto(`${base}${s.path}`);
      if (s.click) {
        await page
          .getByRole("link", { name: s.click, exact: s.exact ?? false })
          .first()
          .click();
        await page.waitForLoadState("networkidle");
      }
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (overflow > 1)
        problems.push(`${s.name} ${v.width} ${mode}: scrolls sideways by ${overflow}px`);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      for (const x of axe.violations.filter(
        (x) => x.impact === "serious" || x.impact === "critical",
      ))
        problems.push(
          `${s.name} ${v.width} ${mode}: ${x.id} ${x.nodes
            .slice(0, 3)
            .map((n) => n.target.join(" "))
            .join(", ")}`,
        );
      const file = `${out}/${s.name}-${v.width}-${mode}.png`;
      await page.screenshot({ path: file, fullPage: s.full ?? true });
      console.log("shot", file, page.url());
    }
    await ctx.close();
  }
}
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join("\n")}` : "no axe/overflow problems");
