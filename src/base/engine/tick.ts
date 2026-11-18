// The jobs tick: base jobs one at a time, each recorded in job_runs (spec J1). Every job is
// idempotent (alert dedupe, digest and outbox keys), so running the tick twice is safe.
// The Vercel daily cron calls it through /api/jobs/tick (vercel.json, CRON_SECRET).
import { eq } from "drizzle-orm";
import type { DbOrTx } from "../db/client";
import { getCurrentEdition } from "../editions/current";
import { jobRuns } from "../schema";
import { runAlerts } from "./alerts";
import { runAutomations } from "./automations";
import { runDigest } from "./digest";
import { sendPendingEmails } from "./outbox";

export interface Job {
  key: string;
  run: (db: DbOrTx, now: Date) => Promise<Record<string, unknown>>;
}

/** Alerts and module automations first (they create notifications), then the digest, then sending. */
export const BASE_JOBS: readonly Job[] = [
  {
    key: "alerts",
    run: async (db, now) => {
      const edition = await getCurrentEdition(db);
      return edition ? runAlerts(db, edition, now) : { skipped: "no current edition" };
    },
  },
  {
    key: "automations",
    run: async (db, now) => {
      const edition = await getCurrentEdition(db);
      return edition ? runAutomations(db, edition, now) : { skipped: "no current edition" };
    },
  },
  { key: "digest", run: runDigest },
  { key: "outbox", run: (db, now) => sendPendingEmails(db, now) },
];

export async function runTick(
  db: DbOrTx,
  now: Date,
  opts: { jobs?: readonly Job[] } = {},
): Promise<Record<string, Record<string, unknown> | null>> {
  const results: Record<string, Record<string, unknown> | null> = {};
  for (const job of opts.jobs ?? BASE_JOBS) {
    const started = Date.now();
    const [run] = await db
      .insert(jobRuns)
      .values({ job: job.key, startedAt: now })
      .returning({ id: jobRuns.id });
    const finish = (set: Partial<typeof jobRuns.$inferInsert>) =>
      run
        ? db
            .update(jobRuns)
            .set({ finishedAt: new Date(now.getTime() + (Date.now() - started)), ...set })
            .where(eq(jobRuns.id, run.id))
        : Promise.resolve();
    try {
      const stats = await job.run(db, now);
      await finish({ status: "succeeded", stats });
      results[job.key] = stats;
    } catch (error) {
      await finish({
        status: "failed",
        error: (error instanceof Error ? error.message : String(error)).slice(0, 500),
      });
      results[job.key] = null;
    }
  }
  return results;
}
