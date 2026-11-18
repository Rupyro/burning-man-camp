import Link from "next/link";
import { hasSection } from "@/lib/active-packs";

const TILES = [
  {
    section: "tile:rides",
    href: "/logistics/rides",
    title: "Rides to camp",
    note: "Offer or find a lift",
  },
  {
    section: "tile:lnt-quiz",
    href: "/obligations/quiz",
    title: "Leave no trace quiz",
    note: "Quick safety check",
  },
];

/** Home tiles for the carpool board and the leave-no-trace quiz. */
export function CampLifeTiles() {
  const tiles = TILES.filter((t) => hasSection(t.section));
  if (!tiles.length) return null;
  return (
    <section aria-labelledby="camp-life" className="flex flex-col gap-2">
      <h2 id="camp-life" className="heading text-sm">
        Camp life
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="rounded-2xl border bg-card p-3 no-underline">
            <p className="text-sm font-bold">{t.title}</p>
            <p className="text-xs text-muted-foreground">{t.note}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
