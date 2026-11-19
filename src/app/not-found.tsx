import Link from "next/link";
import { CAMP_NAME } from "@/lib/camp";

/** Branded 404 (Ruchir picked option A, Oct 25): one card on the backdrop, one way back. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center p-6">
      <section className="w-full rounded-2xl border bg-card p-6 text-center">
        <p className="heading text-3xl">{CAMP_NAME}</p>
        <h1 className="heading mt-3 text-lg">This page wandered off into the dust</h1>
        <p className="mt-1 text-sm">Let's get you back to camp.</p>
        <Link
          href="/"
          className="mt-4 inline-flex min-h-11 items-center rounded-full bg-primary px-5 font-semibold text-primary-foreground"
        >
          Back home
        </Link>
      </section>
    </main>
  );
}
