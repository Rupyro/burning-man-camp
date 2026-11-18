// Copies the camp's art (camp-art/) into public/ so Next.js serves it at the same URLs
// (e.g. camp-art/backdrop/rock-day-1200.avif -> /backdrop/rock-day-1200.avif).
// public/backdrop is generated and gitignored; edit camp-art/ instead. Runs before dev and build.
import { cpSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const src = "camp-art";
// fonts/ is bundled by next/font from camp-art/fonts.ts, so it is not copied.
const SKIP = new Set(["fonts"]);
for (const name of readdirSync(src)) {
  const from = join(src, name);
  if (SKIP.has(name) || !statSync(from).isDirectory()) continue;
  const to = join("public", name);
  if (existsSync(to)) rmSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}
