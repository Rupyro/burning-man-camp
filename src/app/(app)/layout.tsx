import Link from "next/link";
import { redirect } from "next/navigation";
import { can } from "@/base/authz/permissions";
import { getDb } from "@/base/db/client";
import { isDemoOn } from "@/base/demo/mode";
import { getModuleFlags } from "@/base/flags/flags";
import { gateFromFlag } from "@/base/guard/module-access";
import { getNow, getRequestContext } from "@/base/guard/request";
import {
  campSection,
  campSettingsLinks,
  settingsLinks,
  workLinks,
} from "@/base/landing/camp-links";
import { countMyFinished, getCountdown, listUnread } from "@/base/landing/home";
import { burnStateOf } from "@/base/people/burn-mode";
import { activeNoticesFor } from "@/base/teams/notices";
import { formatCampDay } from "@/lib/dates";
import { earnedBadges } from "@/lib/fun-extras";
import { Wordmark } from "../_components/brand";
import { DustGust } from "../_components/dust-gust";
import { FunExtras, LogoTaps } from "../_components/fun-extras";
import { SignOutButton } from "../_components/sign-out-button";
import { ensureRegistry } from "../boot";
import { Sidebar, TabBar } from "./_components/app-nav";
import { ApplicantShell } from "./_components/applicant-shell";
import { BurnTag } from "./_components/burn-switch";
import { myFunYears } from "./_components/fun-years";
import { NoticeBanner } from "./_components/team-notice";
import { TopBar } from "./_components/top-bar";

/**
 * App shell (spec B3): sunset header, phone tab bar, laptop sidebar; day/night follows the sun at
 * camp. Applicants get the slim applicant shell instead (spec applicants §1).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const registry = ensureRegistry();
  const rc = await getRequestContext();
  if (!rc) redirect("/login");
  const db = getDb();
  // Applicants see only the applicant screens (spec applicants §1): no member tabs or sidebar.
  if (rc.actor.isApplicant)
    return (
      <ApplicantShell name={rc.actor.displayName} demo={await isDemoOn(db)}>
        {children}
      </ApplicantShell>
    );
  const ctx = { db, actor: rc.actor, edition: rc.edition };
  const [demo, flags, unread, count, burn, notices, done] = await Promise.all([
    isDemoOn(db),
    getModuleFlags(db, registry),
    listUnread(ctx, 0),
    getCountdown(ctx),
    rc.actor.personId ? burnStateOf(db, rc.edition.id, rc.actor.personId) : null,
    rc.actor.personId ? activeNoticesFor(db, rc.actor.personId, getNow()) : [],
    countMyFinished(ctx),
  ]);
  const years = (await myFunYears(registry, { ...ctx, now: getNow() })).length;
  const modules = registry.modules
    .filter((m) => gateFromFlag(rc.actor, m, flags.get(m.id)).open)
    .map((m) => ({ href: m.route, label: m.name, icon: m.icon }));
  const camp = campSection(rc.actor);
  const admin = [
    ...camp.links.filter((l) => l.href !== "/me"),
    ...settingsLinks(rc.actor),
    ...campSettingsLinks(rc.actor),
  ];
  const lead = can(rc.actor, "readiness.view");
  const initial = rc.actor.displayName.trim().charAt(0).toUpperCase();

  return (
    <div className="flex min-h-full text-foreground" data-burn={burn?.onAt ? "on" : undefined}>
      {lead ? <Sidebar work={workLinks(rc.actor)} modules={modules} admin={admin} /> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        {demo ? (
          <p className="flex items-center justify-center gap-2 bg-banner px-3 py-1 text-center text-xs font-semibold text-banner-foreground">
            Demo: viewing as {rc.actor.displayName}
            <Link href="/login" className="underline">
              switch role
            </Link>
          </p>
        ) : null}
        <NoticeBanner
          notices={notices.map((n) => ({
            id: n.id,
            body: n.body,
            teamName: n.teamName,
            authorName: n.authorName,
            until: formatCampDay(n.endsAt, "EEE d MMM, HH:mm"),
          }))}
        />
        <TopBar>
          <LogoTaps>
            <Link href="/" className="lg:hidden" aria-label="Home">
              <Wordmark className="text-xl" />
            </Link>
          </LogoTaps>
          <p className="hidden min-w-0 truncate text-sm font-semibold lg:block">
            Welcome home, {rc.actor.displayName} — {camp.youAre.join(" · ")}
          </p>
          <div className="flex shrink-0 items-center gap-4">
            {count.build ? (
              <p className="hidden items-baseline gap-1 lg:flex">
                <b className="font-wordmark text-3xl">{count.build.days}</b>
                <span className="heading whitespace-nowrap text-[10px]">
                  days to build · {formatCampDay(count.build.at)}
                </span>
              </p>
            ) : null}
            {count.gates ? (
              <p className="hidden items-baseline gap-1 lg:flex">
                <b className="font-wordmark text-3xl">{count.gates.days}</b>
                <span className="heading whitespace-nowrap text-[10px]">
                  days to gates · {formatCampDay(count.gates.at)}
                </span>
              </p>
            ) : null}
            <Link
              href="/me"
              aria-label={`My profile (${rc.actor.displayName})`}
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <span className="grid size-10 place-items-center rounded-full border-2 border-white/80 bg-earth font-bold text-ochre">
                {initial}
              </span>
              <span className="hidden sm:inline">My profile</span>
            </Link>
            <SignOutButton />
          </div>
        </TopBar>
        <main
          className={`mx-auto w-full flex-1 p-4 pb-24 lg:px-8 lg:pt-8 ${lead ? "md:pb-6 lg:max-w-6xl" : "max-w-3xl"}`}
        >
          {burn?.onAt ? <BurnTag /> : null}
          {children}
        </main>
      </div>
      <DustGust />
      <FunExtras
        done={done}
        earned={earnedBadges({ done, shifts: 0, thanks: 0, years })}
        burnOn={Boolean(burn?.onAt)}
        demo={demo}
      />
      <TabBar unread={unread.count} everywhere={!lead} />
    </div>
  );
}
