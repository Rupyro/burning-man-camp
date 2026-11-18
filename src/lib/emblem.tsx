// The camp's emblem (plan PR 5): the growing flower on Family cards, badges and the joining path.
// camp.config.ts picks it with look.emblem; Oe-aa-sies uses the protea. Another camp adds its own
// drawing here with the same props (stage 1-4, head, className, label) and a small bud.
import type { ComponentType } from "react";
import { campConfig } from "./camp";
import { Protea, ProteaBud } from "./protea";

export type EmblemProps = { stage: number; head?: boolean; className?: string; label?: string };

type EmblemPair = { Bloom: ComponentType<EmblemProps>; Bud: ComponentType<{ className?: string }> };
const PROTEA: EmblemPair = { Bloom: Protea, Bud: ProteaBud };

export const EMBLEMS: Record<string, EmblemPair> = {
  protea: PROTEA,
};

const chosen = EMBLEMS[campConfig.look.emblem] ?? PROTEA;
/** The camp's emblem, opening a little more each year (stage 1-4). */
export const Emblem = chosen.Bloom;
/** A small closed bud of the camp's emblem, for year chips. */
export const EmblemBud = chosen.Bud;
