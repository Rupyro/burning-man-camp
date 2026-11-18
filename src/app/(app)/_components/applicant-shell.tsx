import { Settings } from "lucide-react";
import Link from "next/link";
import { Wordmark } from "../../_components/brand";
import { DustGustToggle } from "../../_components/dust-gust";
import { SignOutButton } from "../../_components/sign-out-button";
import { ThemeControls } from "../../_components/theme-controls";

/** The applicant shell (spec applicants §1): wordmark, a small settings gear (day/night, dust gusts), sign out. No member navigation. */
export function ApplicantShell(p: { name: string; demo: boolean; children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col text-foreground">
      {p.demo ? (
        <p className="flex items-center justify-center gap-2 bg-banner px-3 py-1 text-center text-xs font-semibold text-banner-foreground">
          Demo: viewing as {p.name}
          <Link href="/login" className="underline">
            switch role
          </Link>
        </p>
      ) : null}
      <header className="bg-sunset relative z-40 flex items-center justify-between gap-3 px-4 py-2 lg:py-3">
        <Link href="/apply" aria-label="My application">
          <Wordmark className="text-2xl" />
        </Link>
        <div className="flex items-center gap-2">
          <details className="relative">
            <summary
              aria-label="Settings"
              className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full [&::-webkit-details-marker]:hidden"
            >
              <Settings aria-hidden className="size-5" />
            </summary>
            <div className="absolute right-0 z-50 mt-2 flex w-64 flex-col gap-3 rounded-2xl border border-menu-border bg-menu p-4 text-menu-foreground shadow-lg">
              <p className="heading text-sm">Day / night</p>
              <ThemeControls />
              <div>
                <DustGustToggle />
              </div>
              <p className="text-xs text-muted-foreground">Saved on this device.</p>
            </div>
          </details>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 pb-6">{p.children}</main>
    </div>
  );
}
