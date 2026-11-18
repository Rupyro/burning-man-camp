// Every pack in the repo, by key. camp.config.ts picks from these.
import type { CampPack } from "../src/lib/camp-packs";
import core from "./core/pack";
import mutantVehicle from "./mutant-vehicle/pack";
import power from "./power/pack";
import sound from "./sound/pack";

export const CAMP_PACKS: Readonly<Record<string, CampPack>> = {
  core,
  power,
  sound,
  "mutant-vehicle": mutantVehicle,
};
