// Pure: no db, no next. The engine runs this inside the insert transaction over the edition's
// dependency edges (DATA_MODEL.md §3 task_dependencies).

export interface Edge {
  /** The dependent task. */
  taskId: string;
  /** The prerequisite. */
  dependsOnTaskId: string;
}

/**
 * The loop that adding `edge` would close, as task ids from edge.taskId back to itself
 * (e.g. A → C → B → A), or null. Follows "depends on" links from the new prerequisite.
 */
export function findCycle(edges: readonly Edge[], edge: Edge): string[] | null {
  if (edge.taskId === edge.dependsOnTaskId) return [edge.taskId, edge.taskId];
  const next = new Map<string, string[]>();
  for (const e of edges) next.set(e.taskId, [...(next.get(e.taskId) ?? []), e.dependsOnTaskId]);
  const seen = new Set<string>();
  const walk = (node: string, path: string[]): string[] | null => {
    if (node === edge.taskId) return [...path, node];
    if (seen.has(node)) return null;
    seen.add(node);
    for (const n of next.get(node) ?? []) {
      const found = walk(n, [...path, node]);
      if (found) return found;
    }
    return null;
  };
  return walk(edge.dependsOnTaskId, [edge.taskId]);
}

export function wouldCreateCycle(edges: readonly Edge[], edge: Edge): boolean {
  return findCycle(edges, edge) !== null;
}
