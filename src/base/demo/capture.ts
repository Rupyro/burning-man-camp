import { globalSingleton } from "@/lib/global-singleton";

// Demo mode only: the persona picker asks Better Auth for a normal magic link, and instead of
// emailing it we hand it straight back so the browser follows it. Armed per email, used once.
type Holder = { armed: Map<string, string | null> };
const holder = globalSingleton<Holder>("__campDemoCapture", () => ({ armed: new Map() }));

export function armCapture(email: string) {
  holder.armed.set(email, null);
}

/** Called by the magic-link sender: true if this link was captured instead of emailed. */
export function captureLink(email: string, url: string): boolean {
  if (!holder.armed.has(email)) return false;
  holder.armed.set(email, url);
  return true;
}

export function takeCaptured(email: string): string | null {
  const url = holder.armed.get(email) ?? null;
  holder.armed.delete(email);
  return url;
}
