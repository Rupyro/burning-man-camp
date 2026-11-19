"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      className="min-h-11 rounded-lg border px-3 font-semibold print:hidden"
      onClick={() => window.print()}
    >
      Print the binder
    </button>
  );
}
