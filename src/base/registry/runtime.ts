import { eventContracts } from "@/contracts/events";
import { globalSingleton } from "@/lib/global-singleton";
import { isCapabilityDefined } from "../authz/permissions";
import { ManifestError } from "../errors";
import type { ModuleId, ModuleManifest } from "./types";
import { validateManifests } from "./validate";

export interface Registry {
  readonly modules: readonly ModuleManifest[];
  get(id: string): ModuleManifest | undefined;
  /** Modules that handle a given event name. */
  handlersOf(eventName: string): ModuleManifest[];
}

type Holder = { registry?: Registry; ids?: string };
const holder: Holder = globalSingleton<Holder>("__campRegistry", () => ({}));

export function buildRegistry(manifests: readonly ModuleManifest[]): Registry {
  const problems = validateManifests({
    manifests,
    eventNames: new Set(Object.keys(eventContracts)),
    isCapabilityDefined,
  });
  if (problems.length) throw new ManifestError(problems);
  const sorted = [...manifests].sort((a, b) => (a.tile?.order ?? 999) - (b.tile?.order ?? 999));
  const byId = new Map<string, ModuleManifest>(sorted.map((m) => [m.id, m]));
  return {
    modules: sorted,
    get: (id) => byId.get(id),
    handlersOf: (name) => sorted.filter((m) => m.events?.handles?.[name]),
  };
}

/**
 * The base never imports modules: the composition root (src/modules/index.ts) is
 * handed in here by src/instrumentation.ts at boot, by the app layout, and by tests.
 * Idempotent for the same module list.
 */
export function registerModules(manifests: readonly ModuleManifest[]): Registry {
  const ids = manifests.map((m) => m.id).join(",");
  if (holder.registry && holder.ids === ids) return holder.registry;
  holder.registry = buildRegistry(manifests);
  holder.ids = ids;
  return holder.registry;
}

export function getRegistry(): Registry {
  if (!holder.registry) {
    throw new Error("Module registry not initialised: call registerModules(modules) at boot");
  }
  return holder.registry;
}

export function getManifest(id: ModuleId | string): ModuleManifest | undefined {
  return getRegistry().get(id);
}

/** Tests only. */
export function resetRegistryForTests() {
  holder.registry = undefined;
  holder.ids = undefined;
}
