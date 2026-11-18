import Link from "next/link";
import { GUIDE_ENTRIES, GUIDE_EXAMPLES } from "@/base/landing/guide-content";
import { keywordSearch } from "@/lib/keyword-search";
import { basePage } from "../../_components/base-page";

/** Ask the guide: keyword search over the camp guide content (src/base/landing/guide-content.ts). */
export default async function AskGuidePage(props: { searchParams: Promise<{ q?: string }> }) {
  await basePage(async () => null);
  const q = ((await props.searchParams).q ?? "").slice(0, 200);
  const results = q ? keywordSearch(GUIDE_ENTRIES, q).slice(0, 8) : [];
  return (
    <div className="flex flex-col gap-4">
      <h1 className="heading text-lg">Ask the guide</h1>
      <form action="/camp/ask" method="get" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Your question
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="e.g. what to bring"
          className="flex-1 rounded-xl border bg-card px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-xl bg-earth px-4 py-2 text-sm font-bold text-ochre"
        >
          Ask
        </button>
      </form>
      <p className="flex flex-wrap gap-2 text-xs">
        Try:
        {GUIDE_EXAMPLES.map((e) => (
          <Link key={e} href={`/camp/ask?q=${encodeURIComponent(e)}`} className="underline">
            {e}
          </Link>
        ))}
      </p>
      {q && !results.length ? (
        <p className="text-sm">Nothing in the guide matches that yet. Ask your team lead.</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {results.map((r) => (
          <li key={r.id} className="rounded-2xl border bg-card p-3 text-sm">
            <p className="text-xs font-bold text-muted-foreground">{r.topic}</p>
            <p>{r.text}</p>
          </li>
        ))}
      </ul>
      <Link href="/camp" className="text-sm underline">
        Full camp info
      </Link>
    </div>
  );
}
