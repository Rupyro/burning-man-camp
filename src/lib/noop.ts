/** Intentionally does nothing (e.g. to silence Postgres NOTICE output). Prefer this over `() => {}`. */
export function noop(): void {
  // intentional
}

/** Async variant of {@link noop}. */
export async function noopAsync(): Promise<void> {
  // intentional
}
