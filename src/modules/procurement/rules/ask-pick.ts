// Which "Ask the camp" router runs: the AI one only when a gateway key exists AND this month's
// AI spend is under the camp's monthly limit. Otherwise the free demo router, always.

/** A cautious per-request estimate in cents (a small model costs well under this). */
export const AI_COST_CENTS_PER_ASK = 2;

export function aiRouterAllowed(opts: { hasKey: boolean; capCents: number; spentCents: number }) {
  return (
    opts.hasKey && opts.capCents > 0 && opts.spentCents + AI_COST_CENTS_PER_ASK <= opts.capCents
  );
}
