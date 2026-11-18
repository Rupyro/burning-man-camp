import type { Actor } from "../authz/actor";
import type { Db } from "../db/client";
import type { EditionRef } from "../editions/current";
import { getModuleFlags } from "../flags/flags";
import { gateFromFlag } from "../guard/module-access";
import type { Registry } from "../registry/runtime";
import type { ModuleContext, MyItem } from "../registry/types";

/** Only these fields reach the browser; manifests stay on the server. */
export interface Tile {
  id: string;
  name: string;
  description: string;
  icon: string;
  route: string;
  badge: number | null;
  failed: boolean;
}

export interface LandingData {
  tiles: Tile[];
  myItems: MyItem[];
  /** Module names whose provider failed or timed out ("Finance couldn't load"). */
  failures: string[];
}

export const PROVIDER_TIMEOUT_MS = 1500;
const URGENCY_ORDER = { overdue: 0, soon: 1, normal: 2 } as const;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export function sortMyItems(items: MyItem[], cap = 10): MyItem[] {
  const unique = [...new Map(items.map((i) => [i.id, i])).values()];
  unique.sort(
    (a, b) =>
      URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] ||
      (a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY) -
        (b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY),
  );
  return unique.slice(0, cap);
}

/**
 * Tiles the actor may see (flag on, audience, manifest access, all on the server)
 * plus the "my stuff" feed from each visible module's provider, each with a
 * 1.5 s budget. Base tasks and alerts join the feed in B2.
 */
export async function getLandingData(
  db: Db,
  registry: Registry,
  actor: Actor,
  edition: EditionRef,
  now = new Date(),
  itemCap = 10,
): Promise<LandingData> {
  const flags = await getModuleFlags(db, registry);
  const visible = registry.modules.filter((m) => gateFromFlag(actor, m, flags.get(m.id)).open);
  const ctx: ModuleContext = { actor, edition, now, db };
  const failures = new Set<string>();

  const tiles = await Promise.all(
    visible.map(async (m): Promise<Tile> => {
      let badge: number | null = null;
      let failed = false;
      if (m.tile?.badge) {
        try {
          badge = await withTimeout(m.tile.badge(ctx), PROVIDER_TIMEOUT_MS);
        } catch {
          failed = true;
          failures.add(m.name);
        }
      }
      return {
        id: m.id,
        name: m.name,
        description: m.description,
        icon: m.icon,
        route: m.route,
        badge,
        failed,
      };
    }),
  );

  const lists = await Promise.all(
    visible.map(async (m) => {
      if (!m.myItems) return [];
      try {
        return await withTimeout(m.myItems(ctx), PROVIDER_TIMEOUT_MS);
      } catch {
        failures.add(m.name);
        return [];
      }
    }),
  );

  return {
    tiles: tiles.map((t) => (failures.has(t.name) ? { ...t, failed: true } : t)),
    myItems: sortMyItems(lists.flat(), itemCap),
    failures: [...failures],
  };
}
