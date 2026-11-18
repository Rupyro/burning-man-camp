// Every pack in the repo, by key. camp.config.ts picks from these.
import type { CampPack } from "../src/lib/camp-packs";
import art from "./art/pack";
import core from "./core/pack";
import fireFlame from "./fire-flame/pack";
import kitchen from "./kitchen/pack";
import mutantVehicle from "./mutant-vehicle/pack";
import power from "./power/pack";
import sound from "./sound/pack";
import village from "./village/pack";
import workshops from "./workshops/pack";

export const CAMP_PACKS: Readonly<Record<string, CampPack>> = {
  core,
  power,
  sound,
  "mutant-vehicle": mutantVehicle,
  "fire-flame": fireFlame,
  kitchen,
  art,
  village,
  workshops,
};
