import { asc } from "drizzle-orm";
import { Settings } from "lucide-react";
import Link from "next/link";
import { getMyPreferences } from "@/base/engine/notify";
import { getNow } from "@/base/guard/request";
import { burnStateOf } from "@/base/people/burn-mode";
import { burnAskOn } from "@/base/people/burn-rules";
import { getPersonView } from "@/base/people/directory";
import { skills } from "@/base/schema";
import { formatCampDay } from "@/lib/dates";
import { paymentLine } from "@/lib/payment-line";
import { FamilyLantern } from "../../_components/family-lantern";
import { PlayaReveal } from "../../_components/fun-extras";
import { ensureRegistry } from "../../boot";
import { basePage } from "../_components/base-page";
import { BurnProfileSwitches } from "../_components/burn-switch";
import { myFunYears } from "../_components/fun-years";
import { AlertSettings } from "./alert-settings";
import { ProfileForm } from "./profile-form";

export default async function MePage() {
  const { view, catalogue, prefs, burn, years, now } = await basePage(async (ctx) => ({
    years: await myFunYears(ensureRegistry(), { ...ctx, now: ctx.now ?? getNow() }),
    now: ctx.now ?? getNow(),
    burn: ctx.actor.personId ? await burnStateOf(ctx.db, ctx.edition.id, ctx.actor.personId) : null,
    view: await getPersonView(ctx, ctx.actor.personId ?? ""),
    catalogue: await ctx.db
      .select({ key: skills.key, label: skills.label })
      .from(skills)
      .orderBy(asc(skills.label)),
    prefs: await getMyPreferences(ctx),
  }));
  const t = view.travel;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="heading text-lg">My profile</h1>
      {view.playaName ? <PlayaReveal name={view.playaName} /> : null}
      <p className="text-sm text-muted-foreground">
        Status: {view.status ?? "not on this year's list"}
        {paymentLine(view.payment) ? ` · ${paymentLine(view.payment)}` : ""}
      </p>
      <FamilyLantern years={years} now={now} />
      <Link
        href="/me/settings"
        className="flex min-h-11 items-center gap-3 rounded-2xl border bg-card px-4 py-2 text-sm"
      >
        <Settings aria-hidden className="size-4" />
        <span className="flex-1">
          <b>Settings</b>
          <span className="block text-xs text-muted-foreground">
            Day / night, dust gusts, fun extras
          </span>
        </span>
        <span aria-hidden>›</span>
      </Link>
      {burn ? (
        <section
          id="burn-mode"
          aria-labelledby="burn-mode-h"
          className="flex scroll-mt-4 flex-col gap-2 rounded-2xl border bg-card p-4"
        >
          <h2 id="burn-mode-h" className="heading text-sm">
            Burn Mode
          </h2>
          <p className="text-sm">
            For when you're at camp: home shows only your Burn pack and the app stays quiet.
          </p>
          <BurnProfileSwitches
            on={Boolean(burn.onAt)}
            ask={burnAskOn(burn)}
            arrival={burn.arrivalAt ? formatCampDay(burn.arrivalAt, "EEE d MMM") : null}
          />
          <p className="text-xs text-muted-foreground">
            Only you. Everyone switches on when they arrive. Shift changes still come through.
          </p>
        </section>
      ) : null}
      <ProfileForm
        catalogue={catalogue}
        initial={{
          displayName: view.displayName,
          playaName: view.playaName ?? "",
          pronouns: view.pronouns ?? "",
          bio: view.bio ?? "",
          phone: view.contact?.phone ?? "",
          countryCode: view.countryCode ?? "",
          emergencyContactName: view.contact?.emergencyContactName ?? "",
          emergencyContactPhone: view.contact?.emergencyContactPhone ?? "",
          directoryVisibility: view.directoryVisibility ?? "members",
          arrivalAt: t.arrivalAt?.toISOString().slice(0, 10) ?? "",
          departureAt: t.departureAt?.toISOString().slice(0, 10) ?? "",
          buildCommitment: t.buildCommitment,
          strikeCommitment: t.strikeCommitment,
          tentChoice: t.tentChoice,
          diet: view.dietary?.diet ?? "",
          allergies: view.dietary?.allergies ?? "",
          availabilityNote: t.availabilityNote ?? "",
        }}
        skills={view.skills}
      />
      <section
        id="alert-settings"
        aria-labelledby="alert-settings-h"
        className="flex scroll-mt-4 flex-col gap-2"
      >
        <h2 id="alert-settings-h" className="heading text-sm">
          Alert settings
        </h2>
        <p className="text-xs text-muted-foreground">
          How you hear about each kind of alert. Set it once; change it any time.
        </p>
        <AlertSettings prefs={prefs.map((p) => ({ type: p.type, channel: p.channel }))} />
      </section>
    </div>
  );
}
