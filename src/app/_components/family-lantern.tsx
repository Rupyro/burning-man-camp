import { CAMP_NAME } from "@/lib/camp";
import { Emblem } from "@/lib/emblem";
import { familyLine, proteaStage } from "@/lib/family-years";

/** Oe-aa-sies Family protea card: the camp years an admin confirmed. Calm, no motion. */
export function FamilyLantern({ years, now }: { years: readonly number[]; now: Date }) {
  if (!years.length) return null;
  return (
    <section className="family-memento" aria-label={`${CAMP_NAME} Family`}>
      <span aria-hidden className="family-memento-lamp">
        <Emblem stage={proteaStage(years.length)} head />
      </span>
      <div>
        <p className="text-lg font-bold">{CAMP_NAME} Family</p>
        <p className="text-sm">{familyLine(years, now)}</p>
      </div>
    </section>
  );
}
