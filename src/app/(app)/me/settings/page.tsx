import Link from "next/link";
import { DustGustToggle } from "../../../_components/dust-gust";
import { FunToggle } from "../../../_components/fun-extras";
import { ThemeControls } from "../../../_components/theme-controls";

/** Calm home for the look-and-feel switches. Saved on this device. */
export default function SettingsPage() {
  const card = "flex flex-col gap-2 rounded-2xl border bg-card p-4";
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <Link href="/me" className="text-sm underline">
        ← My profile
      </Link>
      <h1 className="heading text-lg">Settings</h1>
      <section aria-labelledby="set-theme" className={card}>
        <h2 id="set-theme" className="heading text-sm">
          Day / night
        </h2>
        <ThemeControls />
        <p className="text-xs text-muted-foreground">
          Auto switches at sunrise and sunset in Tankwa (camp time).
        </p>
      </section>
      <section aria-labelledby="set-dust" className={card}>
        <h2 id="set-dust" className="heading text-sm">
          Dust gusts
        </h2>
        <div>
          <DustGustToggle />
        </div>
        <p className="text-xs text-muted-foreground">
          A soft gust blows across the screen every few minutes. Never if your device asks for
          reduced motion.
        </p>
      </section>
      <section aria-labelledby="set-fun" className={card}>
        <h2 id="set-fun" className="heading text-sm">
          Fun extras
        </h2>
        <div>
          <FunToggle />
        </div>
        <p className="text-xs text-muted-foreground">
          The badges, the campfire every 10 tasks and a few little surprises. They stay off in Burn
          Mode.
        </p>
      </section>
      <p className="text-xs text-muted-foreground">These are saved on this device.</p>
    </div>
  );
}
