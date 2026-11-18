import { BurnWelcomeButtons } from "../burn-switch";

/** C: the big welcome screen on the person's arrival day. Asked once; then it's in My profile. */
export function BurnWelcome({ first }: { first: string }) {
  return (
    <section
      aria-labelledby="burn-h"
      className="bg-sunset flex min-h-[60vh] flex-col items-center justify-center gap-3 rounded-2xl p-6 text-center"
    >
      <span aria-hidden className="text-5xl">
        🔥
      </span>
      <h1 id="burn-h" className="heading text-2xl">
        Welcome home, {first}
      </h1>
      <p className="max-w-sm text-sm">
        You've arrived. Want the app in Burn Mode? Just your shifts, the help sheet, packing and
        camp info. Everything else waits until you're back.
      </p>
      <BurnWelcomeButtons />
    </section>
  );
}
