/**
 * One instance per Node process, even when Next.js loads the same file in more
 * than one server bundle (instrumentation, routes) or reloads it in dev.
 */
export function globalSingleton<T>(key: string, init: () => T): T {
  const store = globalThis as unknown as Record<string, T | undefined>;
  const existing = store[key];
  if (existing !== undefined) return existing;
  const created = init();
  store[key] = created;
  return created;
}
