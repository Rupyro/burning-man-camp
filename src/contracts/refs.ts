/** Soft-reference type names (`<name>_ref_type` columns). See MODULE_RULEBOOK.md §5. */
export const REF_TYPES = [] as const satisfies readonly string[];
export type RefType = (typeof REF_TYPES)[number];
