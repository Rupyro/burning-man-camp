/**
 * The first row of a query result, or throw. Use after `insert … returning()` or a lookup that
 * must succeed, so `noUncheckedIndexedAccess` stays on without non-null assertions.
 */
export function firstRow<T>(rows: readonly T[], what = "row"): T {
  const row = rows[0];
  if (row === undefined) throw new Error(`Expected a ${what}, got none`);
  return row;
}
