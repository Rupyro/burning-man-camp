// Camp type packs (plan PR 2): the format, and how a camp's chosen packs combine.
// A pack is a plain data file at camp-packs/<pack>/pack.ts. Nothing in the app reads packs yet;
// later PRs move today's teams, materials, packing and task templates into them.

/** Something a pack brings, keyed so packs can share it and camps can drop it. */
export interface PackItem {
  key: string;
  label: string;
}

export const PACK_LISTS = [
  "teams",
  "roles",
  "materialCategories",
  "packingItems",
  "taskTemplates",
  "shiftTemplates",
  "obligations",
  "sections",
] as const;
export type PackListName = (typeof PACK_LISTS)[number];

/** Roles also say what kind they are (matches the roles table's kind). */
export interface PackRole extends PackItem {
  kind: "system" | "capability" | "officer";
}

export type PackLists = { [K in PackListName]: K extends "roles" ? PackRole[] : PackItem[] };

export interface CampPack extends Partial<PackLists> {
  key: string;
  label: string;
  /** Other packs this one pulls in (sound and mutant-vehicle pull in power). */
  includes?: readonly string[];
}

export interface CampCustom extends Partial<PackLists> {
  /** Item keys to drop, per list. */
  remove?: Partial<Record<PackListName, readonly string[]>>;
}

export function definePack<const T extends CampPack>(pack: T): T {
  return pack;
}

/**
 * Order the packs to load: core first, then each chosen pack after the packs it includes,
 * each pack once. Unknown keys throw so a typo in camp.config.ts fails loudly.
 */
export function resolvePackOrder(
  chosen: readonly string[],
  registry: Readonly<Record<string, CampPack>>,
): string[] {
  const out: string[] = [];
  const visiting = new Set<string>();
  const visit = (key: string) => {
    if (out.includes(key)) return;
    const pack = registry[key];
    if (!pack) throw new Error(`Unknown camp pack "${key}"`);
    if (visiting.has(key)) throw new Error(`Camp pack "${key}" includes itself`);
    visiting.add(key);
    for (const inc of pack.includes ?? []) visit(inc);
    visiting.delete(key);
    out.push(key);
  };
  visit("core");
  for (const k of chosen) visit(k);
  return out;
}

/**
 * Combine packs in load order: items merge by key (one entry per key, the later pack's label
 * wins, first position kept), then the camp's custom items, then the camp's removals.
 */
export function mergePacks(
  chosen: readonly string[],
  registry: Readonly<Record<string, CampPack>>,
  custom: CampCustom = {},
): { packs: string[] } & PackLists {
  const packs = resolvePackOrder(chosen, registry);
  const layers = [...packs.map((k) => registry[k] as CampPack), custom];
  const lists = {} as Record<PackListName, PackItem[]>;
  for (const name of PACK_LISTS) {
    const byKey = new Map<string, PackItem>();
    for (const layer of layers)
      for (const item of (layer[name] ?? []) as PackItem[]) byKey.set(item.key, item);
    const drop = new Set(custom.remove?.[name] ?? []);
    lists[name] = [...byKey.values()].filter((i) => !drop.has(i.key));
  }
  return { packs, ...(lists as PackLists) };
}
