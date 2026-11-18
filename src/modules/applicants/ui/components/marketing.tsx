import { hasPack } from "@/lib/active-packs";
import { CAMP_NAME } from "@/lib/camp";
import { ABOUT_BANNER, ABOUT_BLOCKS } from "@/lib/camp-content";
import { ArtCarSun } from "./art";

/** Camp marketing on the applicant home (spec §3): text and drawings only, no photos of people. */
export function AboutCamp() {
  return (
    <section aria-labelledby="about-h" className="flex flex-col gap-3">
      <h2 id="about-h" className="heading text-sm">
        About {CAMP_NAME}
      </h2>
      <div className="bg-sunset flex items-end justify-between gap-3 rounded-2xl p-4">
        <p className="text-sm font-semibold">{ABOUT_BANNER}</p>
        {hasPack("mutant-vehicle") && <ArtCarSun className="h-14 w-32 shrink-0 text-earth" />}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {ABOUT_BLOCKS.filter((b) => !("pack" in b) || hasPack(b.pack)).map((b) => (
          <article key={b.title} className="rounded-2xl border bg-card p-4">
            <h3 className="font-semibold">{b.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{b.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
