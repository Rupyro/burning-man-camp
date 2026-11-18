import "server-only";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { evaluateAccess } from "../authz/access";
import { getDb } from "../db/client";
import { getRegistry } from "../registry/runtime";
import type { ModuleContext, ModuleId } from "../registry/types";
import { gateModule } from "./module-access";
import { moduleNavLinks } from "./module-nav";
import { getNow, getRequestContext } from "./request";

async function resolveOrNotFound(moduleId: ModuleId) {
  const rc = await getRequestContext();
  if (!rc) redirect("/login");
  const registry = getRegistry();
  const gate = await gateModule(getDb(), registry, rc.actor, moduleId);
  // A hidden module looks exactly like a missing page: no hint that it exists.
  if (!gate.open) notFound();
  return { rc, manifest: gate.manifest };
}

/**
 * Default export of src/app/(app)/<route>/layout.tsx. Checks session, flag,
 * audience and access on the server, then renders the module nav from the manifest.
 */
export function guardModuleLayout(moduleId: ModuleId) {
  return async function GuardedModuleLayout({ children }: { children: ReactNode }) {
    const { rc, manifest } = await resolveOrNotFound(moduleId);
    const nav = moduleNavLinks(
      manifest.route,
      manifest.nav.filter((n) => evaluateAccess(rc.actor, n.access ?? manifest.access)),
    );
    return (
      <div className="flex flex-col gap-4">
        {nav.length ? (
          <nav
            aria-label={`${manifest.name} navigation`}
            className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 pb-2 whitespace-nowrap [scrollbar-width:none]"
          >
            <span className="mr-2 inline-flex shrink-0 items-center font-semibold">
              {manifest.name}
            </span>
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm underline-offset-4 hover:underline"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        ) : null}
        {children}
      </div>
    );
  };
}

export interface ModulePageProps {
  ctx: ModuleContext;
  slug: string[];
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * Wraps a module's ui/router. Layouts aren't re-rendered on every client
 * navigation, so the page checks the gate again (defence in depth).
 */
export function guardModulePage(
  moduleId: ModuleId,
  Page: (props: ModulePageProps) => Promise<ReactNode> | ReactNode,
) {
  return async function GuardedModulePage(props: {
    params: Promise<{ slug?: string[] }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  }) {
    const { rc } = await resolveOrNotFound(moduleId);
    const [{ slug = [] }, searchParams] = await Promise.all([props.params, props.searchParams]);
    const ctx: ModuleContext = { actor: rc.actor, edition: rc.edition, now: getNow(), db: getDb() };
    return Page({ ctx, slug, searchParams });
  };
}
