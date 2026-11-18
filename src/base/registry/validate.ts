import { BASE_CAPABILITIES } from "../authz/permissions";
import type { AccessRule, ModuleManifest } from "./types";

export interface ValidationInput {
  manifests: readonly ModuleManifest[];
  eventNames: ReadonlySet<string>;
  isCapabilityDefined: (cap: string) => boolean;
}

const ID_RE = /^[a-z][a-z0-9]*$/;
const ROUTE_RE = /^\/[a-z][a-z0-9-]*$/;
const PREFIX_RE = /^[a-z][a-z0-9]*_$/;
const RESERVED_ROUTES = new Set([
  "/login",
  "/invite",
  "/api",
  "/me",
  "/settings",
  "/people",
  "/teams",
  "/projects",
  "/tasks",
  "/available",
  "/guide",
]);

/** Boot-time manifest validation (MODULE_RULEBOOK.md §3). Returns a list of problems. */
export function validateManifests({
  manifests,
  eventNames,
  isCapabilityDefined,
}: ValidationInput): string[] {
  const problems: string[] = [];
  const seen = {
    id: new Map<string, string>(),
    route: new Map<string, string>(),
    prefix: new Map<string, string>(),
  };

  for (const m of manifests) {
    const where = `module "${m.id}"`;
    if (!ID_RE.test(m.id)) problems.push(`${where}: id must be lower-case letters/digits`);
    if (!ROUTE_RE.test(m.route))
      problems.push(`${where}: route "${m.route}" must look like "/name"`);
    if (RESERVED_ROUTES.has(m.route))
      problems.push(`${where}: route "${m.route}" is reserved for the base`);
    if (!PREFIX_RE.test(m.tablePrefix))
      problems.push(`${where}: tablePrefix "${m.tablePrefix}" must look like "name_"`);

    for (const [field, value] of [
      ["id", m.id],
      ["route", m.route],
      ["prefix", m.tablePrefix],
    ] as const) {
      const other = seen[field].get(value);
      if (other) problems.push(`${where}: ${field} "${value}" is already used by "${other}"`);
      seen[field].set(value, m.id);
    }
    for (const prefix of seen.prefix.keys()) {
      if (
        prefix !== m.tablePrefix &&
        (prefix.startsWith(m.tablePrefix) || m.tablePrefix.startsWith(prefix))
      ) {
        problems.push(`${where}: tablePrefix "${m.tablePrefix}" overlaps "${prefix}"`);
      }
    }

    const declared = new Set<string>(m.permissions);
    for (const cap of m.permissions) {
      if (!cap.startsWith(`${m.id}.`))
        problems.push(`${where}: capability "${cap}" must start with "${m.id}."`);
      if (!isCapabilityDefined(cap))
        problems.push(`${where}: capability "${cap}" has no check (definePermissions)`);
    }
    const checkRules = (rules: readonly AccessRule[] | undefined, label: string) => {
      for (const rule of rules ?? []) {
        if ("capability" in rule) {
          const ok =
            declared.has(rule.capability) ||
            (BASE_CAPABILITIES as readonly string[]).includes(rule.capability);
          if (!ok)
            problems.push(`${where}: ${label} uses undeclared capability "${rule.capability}"`);
        }
      }
    };
    if (m.access.length === 0) problems.push(`${where}: access must list at least one rule`);
    checkRules(m.access, "access");
    for (const nav of m.nav) {
      checkRules(nav.access, `nav "${nav.label}"`);
      if (nav.path.startsWith("/"))
        problems.push(`${where}: nav path "${nav.path}" must be relative`);
    }

    for (const name of m.events?.emits ?? []) {
      if (!name.startsWith(`${m.id}.`))
        problems.push(`${where}: emits "${name}" but events are named "<emitter>.<entity>.<verb>"`);
      if (!eventNames.has(name))
        problems.push(`${where}: emits "${name}" which has no contract in src/contracts/events`);
    }
    for (const name of Object.keys(m.events?.handles ?? {})) {
      if (!eventNames.has(name))
        problems.push(`${where}: handles "${name}" which has no contract in src/contracts/events`);
    }
    for (const list of [m.taskKinds, m.notificationTypes, m.jobs, m.binderSections] as const) {
      for (const item of list ?? []) {
        const key = "key" in item ? item.key : item.id;
        if (!key.startsWith(`${m.id}.`))
          problems.push(`${where}: "${key}" must start with "${m.id}."`);
      }
    }
    for (const table of m.exports?.tables ?? []) {
      if (!table.name.startsWith(m.tablePrefix))
        problems.push(`${where}: export table "${table.name}" must start with "${m.tablePrefix}"`);
    }
  }
  return problems;
}
