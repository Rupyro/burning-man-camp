import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ModuleContext } from "@/base/api";
import { EmblemBud } from "@/lib/emblem";
import {
  canWelcomeFamily,
  FAMILY_APPROVERS,
  familyYearsOffered,
  isFoundingFamily,
} from "../../rules/family";
import { familyByApplication, familyWaiting } from "../../server/family-queries";
import { myApplication } from "../../server/queries";
import { FamilyDecide } from "../components/family-decide";
import { FamilyJourney } from "../components/family-journey";

const canDecide = (ctx: ModuleContext) =>
  canWelcomeFamily(
    {
      isAdmin: ctx.actor.isAdmin,
      isLead: ctx.actor.hasRole("camp_lead") || ctx.actor.isAnyTeamLead,
    },
    FAMILY_APPROVERS,
  );

function Lanterns({ years }: { years: number[] }) {
  return (
    <p>
      {years.map((y) => (
        <span key={y} className="journey-pill">
          <EmblemBud /> {y}
        </span>
      ))}
    </p>
  );
}

/** Welcoming them home: returning family waiting for an admin. */
export async function FamilyQueuePage({ ctx }: { ctx: ModuleContext }) {
  const list = await familyWaiting(ctx.db, ctx.edition.id);
  return (
    <div className="journey">
      <div className="journey-hero">
        <p className="journey-kick">Welcoming them home</p>
        <h1 className="journey-h1">Waiting to be welcomed</h1>
        <p className="journey-sub">
          {list.length
            ? `${list.length} returning family ${list.length === 1 ? "member" : "members"}`
            : "No one waiting right now."}
        </p>
      </div>
      {list.map((f) => (
        <div key={f.applicationId} className="journey-card">
          <div className="flex items-center justify-between gap-2">
            <h3 className="journey-h3 m-0">{f.name}</h3>
            <span className="journey-small">
              <b>{f.years.length} years</b>
              {isFoundingFamily(f.years, ctx.now) ? " · Founding family" : ""}
            </span>
          </div>
          <Lanterns years={f.years} />
          <p className="journey-small">
            {f.memo?.teams.join(", ") || "No teams picked"}
            {f.memo?.ledWhat ? ` · ${f.memo.ledWhat}` : ""}
          </p>
          {f.suggestion ? (
            <div className="journey-sugg">
              <b>A thought:</b> {f.suggestion}
              <br />
              <span className="journey-small">Suggested from their answers. You decide.</span>
            </div>
          ) : null}
          {f.decision === "asked" ? (
            <p className="journey-small mt-2">You asked them a question.</p>
          ) : null}
          <Link href={`/apply/family/${f.applicationId}`} className="journey-btn">
            Welcome them in, or ask
          </Link>
        </div>
      ))}
    </div>
  );
}

/** Welcome them in: one returning member's years and memories. */
export async function FamilyDetailPage({ ctx, id }: { ctx: ModuleContext; id: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const f = await familyByApplication(ctx.db, id);
  if (!f) notFound();
  const m = f.memo;
  const row = (icon: string, k: string, v: string) => (
    <li>
      <span aria-hidden>{icon}</span> <b>{k}:</b> {v || "—"}
    </li>
  );
  return (
    <div className="journey">
      <Link href="/apply/family" className="text-sm underline">
        ← Waiting to be welcomed
      </Link>
      <div className="journey-hero">
        <p className="journey-kick">Welcome them in</p>
        <h1 className="journey-h1">{f.name}'s coming home</h1>
      </div>
      <div className="journey-card">
        <Lanterns years={f.years} />
        <p className="journey-small">
          {f.years.length} years{isFoundingFamily(f.years, ctx.now) ? " · Founding family" : ""}
        </p>
      </div>
      <div className="journey-card">
        <h3 className="journey-h3">Their memories</h3>
        <ul className="flex flex-col gap-1 text-sm">
          {row("🍲", "Stood beside", m?.teams.join(", ") ?? "")}
          {row("🔥", "Led", m?.led ? (m.ledWhat ?? "yes") : "not yet")}
          {row("🪵", "Built", m?.buildPieces.join(", ") ?? "")}
          {row("✨", "Good at", m?.goodAt.join(", ") ?? "")}
          {row("🌅", "This year", m?.loveTo.join(", ") ?? "")}
          {row("🪶", "Anything else", m?.anythingElse ?? "")}
        </ul>
      </div>
      {f.suggestion ? (
        <div className="journey-sugg">
          <b>A thought:</b> {f.suggestion}
          <br />
          <span className="journey-small">
            Suggested from their answers. A person always decides.
          </span>
        </div>
      ) : null}
      {f.status !== "applied" ? (
        <p className="journey-card text-sm" role="status">
          {f.status === "declined"
            ? "Declined kindly."
            : "Welcomed in. Their interview was skipped. 🔥"}
        </p>
      ) : canDecide(ctx) ? (
        <FamilyDecide id={f.applicationId} name={f.name} />
      ) : (
        <p className="journey-small">Only camp admins can welcome family in.</p>
      )}
    </div>
  );
}

/** The Oe-aa-sies Family path for an applicant who hasn't sent anything yet. */
export async function FamilyJourneyPage({ ctx }: { ctx: ModuleContext }) {
  const app = await myApplication(ctx.db, ctx.edition.id, ctx.actor.personId ?? "");
  if (app && app.status !== "draft" && app.status !== "applied") redirect("/apply");
  if (app && (await familyByApplication(ctx.db, app.id))) redirect("/apply");
  return (
    <FamilyJourney
      years={familyYearsOffered(ctx.now)}
      nowIso={ctx.now.toISOString()}
      editionYear={ctx.edition.year}
    />
  );
}
