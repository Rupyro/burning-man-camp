// "Ask the camp" (Oct 28 2026): a lead types a request in plain words and the app files it.
// The routing sits behind this interface so the demo version (keywords and dates, no AI) and
// the AI version can be swapped without touching the page or the database code.

export interface AskTeam {
  key: string;
  name: string;
}

export interface AskInput {
  text: string;
  /** Today's date in camp time, YYYY-MM-DD. */
  today: string;
  /** Teams the request may go to (only the ones the asker can file work for). */
  teams: readonly AskTeam[];
}

export interface AskRoute {
  teamKey: string;
  title: string;
  /** YYYY-MM-DD, or null when the request names no date. */
  dueOn: string | null;
  /** Set when the request is something to buy, so it can go on the buy list. */
  buy: { item: string; quantity: number | null; unit: string | null } | null;
  /** Which router made the call: shown to the lead so it's never a mystery. */
  router: "demo" | "ai";
  /** True when no word matched and the demo router fell back to the first team. */
  guessed: boolean;
}

export interface AskRouter {
  readonly kind: "demo" | "ai";
  route(input: AskInput): Promise<AskRoute>;
}
