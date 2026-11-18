/** The clear marker on everything that stands in for Ruchir's real form (spec §1). */
export function PlaceholderNote({ what }: { what: string }) {
  return (
    <p
      role="note"
      className="rounded-xl border-2 border-dashed border-rust bg-card p-3 text-sm font-semibold"
    >
      PLACEHOLDER: {what} The camp's real application form is on its way and will replace this.
    </p>
  );
}
