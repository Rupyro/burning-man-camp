import "server-only";
import type { ZodType } from "zod";
import { BASE_CAPABILITIES, can } from "../authz/permissions";
import { getDb } from "../db/client";
import { ForbiddenError, UnauthenticatedError, ValidationError } from "../errors";
import { dispatchEvents } from "../events/dispatch";
import { getRegistry } from "../registry/runtime";
import type { Capability, ModuleContext, ModuleId } from "../registry/types";
import type { ActionFailure } from "./action-result";
import { type ActionContext, buildActionContext } from "./context";
import { gateModule } from "./module-access";
import { getNow, getRequestContext } from "./request";

export interface ModuleActionOptions<I> {
  input: ZodType<I>;
  capability: Capability;
  /** Load the record the capability is checked against (e.g. the spend request). */
  resource?: (input: I, ctx: ModuleContext) => Promise<unknown>;
}

const NOT_ALLOWED = "You're not allowed to do that.";

/**
 * The refusals a person can act on come back as an {@link ActionFailure} instead of being thrown
 * (Next.js hides thrown messages in production). Anything else is a bug and still throws, as do
 * Next's own redirect/notFound signals.
 */
async function returnRefusals<O>(run: () => Promise<O>): Promise<O | ActionFailure> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof ValidationError) {
      const detail = e.issues.map((i) => `${i.path}: ${i.message}`).join("; ");
      return {
        ok: false,
        code: "VALIDATION",
        error: detail ? `${e.message} (${detail})` : e.message,
      };
    }
    if (e instanceof UnauthenticatedError) {
      return { ok: false, code: "UNAUTHENTICATED", error: "Please sign in again." };
    }
    if (e instanceof ForbiddenError) return { ok: false, code: "FORBIDDEN", error: NOT_ALLOWED };
    throw e;
  }
}

function parseInput<I>(schema: ZodType<I>, raw: unknown): I {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError(
      "Invalid input",
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  return parsed.data;
}

/**
 * The only way a module mutates data (MODULE_RULEBOOK.md §4.2). On the server it:
 * resolves the session → checks the module flag, audience and access → validates
 * input → checks the capability against the resource → opens a transaction with
 * the base APIs bound to it → after commit, dispatches the events it emitted.
 * Refusals (validation, forbidden, signed out) are returned as an ActionFailure, never thrown.
 */
export function moduleAction<I, O>(
  moduleId: ModuleId,
  opts: ModuleActionOptions<I>,
  fn: (ctx: ActionContext, input: I) => Promise<O>,
): (input: I) => Promise<O | ActionFailure> {
  return (raw: I) => returnRefusals(() => runModuleAction(moduleId, opts, fn, raw));
}

async function runModuleAction<I, O>(
  moduleId: ModuleId,
  opts: ModuleActionOptions<I>,
  fn: (ctx: ActionContext, input: I) => Promise<O>,
  raw: I,
): Promise<O> {
  {
    const rc = await getRequestContext();
    if (!rc) throw new UnauthenticatedError();
    const db = getDb();
    const registry = getRegistry();
    const now = getNow();
    const gate = await gateModule(db, registry, rc.actor, moduleId);
    if (!gate.open) throw new ForbiddenError(`Module "${moduleId}" is not available`);
    const declared =
      gate.manifest.permissions.includes(opts.capability) ||
      (BASE_CAPABILITIES as readonly string[]).includes(opts.capability);
    if (!declared)
      throw new Error(`"${opts.capability}" is not declared in the ${moduleId} manifest`);

    const input = parseInput(opts.input, raw);
    const mctx: ModuleContext = { actor: rc.actor, edition: rc.edition, now, db };
    const resource = opts.resource ? await opts.resource(input, mctx) : undefined;
    if (!can(rc.actor, opts.capability, resource)) throw new ForbiddenError();

    const emitted: string[] = [];
    const result = await db.transaction((tx) =>
      fn(
        buildActionContext(tx, {
          db,
          registry,
          moduleId,
          actor: rc.actor,
          edition: rc.edition,
          now,
          emitted,
          requestId: rc.requestId,
        }),
        input,
      ),
    );
    if (emitted.length) {
      await dispatchEvents(db, registry, { eventIds: emitted, now }).catch((error) => {
        console.error("[events] dispatch after commit failed; the jobs tick will retry", error);
      });
    }
    return result;
  }
}

/** Base equivalent for actions that need a signed-in actor but no module (e.g. sign out). */
export function sessionAction<I, O>(
  opts: { input: ZodType<I>; capability?: Capability },
  fn: (
    ctx: { actor: ActionContext["actor"]; edition: ActionContext["edition"]; now: Date },
    input: I,
  ) => Promise<O>,
): (input: I) => Promise<O | ActionFailure> {
  return (raw: I) =>
    returnRefusals(async () => {
      const rc = await getRequestContext();
      if (!rc) throw new UnauthenticatedError();
      if (opts.capability && !can(rc.actor, opts.capability)) throw new ForbiddenError();
      return fn(
        { actor: rc.actor, edition: rc.edition, now: getNow() },
        parseInput(opts.input, raw),
      );
    });
}

/** Base equivalent for the few public actions (request a login link, accept an invite). */
export function publicAction<I, O>(
  opts: { input: ZodType<I> },
  fn: (input: I) => Promise<O>,
): (input: I) => Promise<O | ActionFailure> {
  return (raw: I) => returnRefusals(() => fn(parseInput(opts.input, raw)));
}

/** For pages and queries: throws ForbiddenError unless the actor holds the capability. */
export async function requireCapability(
  ctx: ModuleContext,
  cap: Capability,
  resource?: unknown,
): Promise<void> {
  if (!can(ctx.actor, cap, resource)) throw new ForbiddenError();
}
