import Link from "next/link";
import { redirect } from "next/navigation";
import { countdownLine } from "@/base/landing/home-queue";
import { burnWelcome } from "@/base/people/burn-rules";
import { burnClockLine } from "@/lib/fun-extras";
import { OxWagon, Wordmark } from "../_components/brand";
import { GettingToCamp, ModuleTiles } from "./_components/home/blocks";
import { BurnWelcome } from "./_components/home/burn-banner";
import { CampLifeTiles } from "./_components/home/camp-life";
import { homeCards } from "./_components/home/cards";
import { loadHome } from "./_components/home/load-home";
import { ReadinessDialog } from "./_components/home/readiness-dialog";
import { CategoryGrid, ReadinessList, UpNext } from "./_components/home/up-next";

/** Home (spec B3.1, B3.2): "My to-do" first (next 5 actions), then everything else; leads add readiness. */
export default async function HomePage() {
  const { rc, now, landing, count, teams, queue, burn, lead } = await loadHome();
  // Burn Mode on: home is the Burn pack (saved for no signal by the pack's service worker).
  const pack = landing.tiles.some((t) => t.id === "shifts");
  if (burn?.onAt && pack) redirect("/shifts/pack");
  const { cards, others } = homeCards(landing.tiles, lead);
  const first = rc.actor.displayName.split(" ")[0] ?? "";
  // C: on arrival day (or the first open after it) a big welcome asks once about Burn Mode.
  if (burn && pack && burnWelcome(burn, now)) return <BurnWelcome first={first} />;
  const line =
    count.gates && count.gates.days <= 0
      ? burnClockLine(count.gates.days)
      : countdownLine(count.build, count.gates);
  // The tile says it differently so the header line isn't repeated on the page.
  const tileLine =
    count.build && count.build.days > 0
      ? `${count.build.days} ${count.build.days === 1 ? "day" : "days"} until build week`
      : null;
  const readiness = teams?.length ? <ReadinessList teams={teams} /> : null;

  const upNext = (
    <UpNext
      items={queue.shown}
      total={queue.total}
      now={now}
      title={lead ? "My to-do · waiting on you" : "My to-do"}
      tools={readiness ? <ReadinessDialog>{readiness}</ReadinessDialog> : null}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="bg-sunset relative -mx-4 -mt-4 overflow-hidden px-5 pt-5 pb-4 lg:hidden">
        <Wordmark className="text-4xl" />
        <p className="mt-2 pr-14 text-sm font-semibold">Welcome home, {first}</p>
        {line ? <p className="mt-1 text-xs font-semibold">{line}</p> : null}
        <OxWagon className="absolute right-3 bottom-2 h-10 text-earth/60" />
        <Link
          href="/me"
          aria-label="My profile"
          className="absolute top-4 right-4 flex flex-col items-center gap-0.5 text-[10px] font-bold"
        >
          <span className="grid size-11 place-items-center rounded-full border-2 border-white/80 bg-earth text-base text-ochre">
            {first.charAt(0).toUpperCase()}
          </span>
          My profile
        </Link>
      </header>
      {readiness ? (
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3 lg:items-start">
          <div className="lg:col-span-2">{upNext}</div>
          <section aria-labelledby="readiness" className="hidden flex-col gap-2 lg:flex">
            <h2 id="readiness" className="heading text-sm">
              Team readiness
            </h2>
            <div className="rounded-2xl border bg-card p-4">{readiness}</div>
          </section>
        </div>
      ) : (
        upNext
      )}
      <GettingToCamp line={tileLine} />
      {landing.failures.length ? (
        <p className="text-sm text-destructive">{landing.failures.join(", ")} couldn't load.</p>
      ) : null}
      <CategoryGrid cards={cards} lead={lead} />
      <CampLifeTiles />
      {others.length ? <ModuleTiles tiles={others} /> : null}
    </div>
  );
}
