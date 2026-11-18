import "server-only";
import { globalSingleton } from "@/lib/global-singleton";
import type { Actor } from "../authz/actor";
import type { EditionRef } from "../editions/current";

export interface RequestContext {
  actor: Actor;
  edition: EditionRef;
  requestId?: string;
}

type Provider = () => Promise<RequestContext | null>;
type Holder = { provider?: Provider; clock?: () => Date };
const holder: Holder = globalSingleton<Holder>("__campRequest", () => ({}));

/** Default: read the Better Auth session cookie and resolve the actor on the server. */
async function sessionProvider(): Promise<RequestContext | null> {
  const [{ headers }, { getAuth }, { getDb }, { loadActorForUser }] = await Promise.all([
    import("next/headers"),
    import("../auth/auth"),
    import("../db/client"),
    import("../people/actor-loader"),
  ]);
  const h = await headers();
  const session = await getAuth().api.getSession({ headers: h });
  if (!session) return null;
  const resolved = await loadActorForUser(getDb(), session.user.id);
  return resolved ? { ...resolved, requestId: h.get("x-vercel-id") ?? undefined } : null;
}

export async function getRequestContext(): Promise<RequestContext | null> {
  return (holder.provider ?? sessionProvider)();
}

export function getNow(): Date {
  return holder.clock ? holder.clock() : new Date();
}

/** Tests only: act as a given actor without a cookie / move the clock. */
export function setRequestContextProvider(provider: Provider | undefined) {
  holder.provider = provider;
}
export function setClock(clock: (() => Date) | undefined) {
  holder.clock = clock;
}
