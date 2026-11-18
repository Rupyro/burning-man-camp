import { timingSafeEqual } from "node:crypto";

/**
 * Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". No secret configured = nobody gets in
 * (the tick never runs from an open URL).
 */
export function cronAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const want = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Route guard for the jobs tick: a 401 response for anyone without the cron secret, else null. */
export function requireJobsSecret(request: Request, secret: string | undefined): Response | null {
  return cronAuthorized(request.headers.get("authorization"), secret)
    ? null
    : new Response("Unauthorized", { status: 401 });
}
