// The daily jobs tick (alerts, automations, digest, outbox), called by the Vercel cron in
// vercel.json. Every job is idempotent, so a retry or a second call the same day is harmless.
import { ensureRegistry } from "@/app/boot";
import { getDb } from "@/base/db/client";
import { runTick } from "@/base/engine/tick";
import { requireJobsSecret } from "@/lib/cron-auth";
import { getEnv } from "@/lib/env";

export async function GET(request: Request) {
  const denied = requireJobsSecret(request, getEnv().CRON_SECRET);
  if (denied) return denied;
  ensureRegistry();
  const results = await runTick(getDb(), new Date());
  const failed = Object.entries(results).filter(([, stats]) => stats === null);
  return Response.json({ ok: failed.length === 0, results }, { status: failed.length ? 500 : 200 });
}
