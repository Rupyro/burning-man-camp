// Every event pack in the repo, by key. camp.config.ts picks one with event.pack.
import type { EventPack } from "../src/lib/event-packs";
import afrikaburn from "./afrikaburn/pack";
import burningMan from "./burning-man/pack";

export const EVENT_PACKS: Readonly<Record<EventPack["key"], EventPack>> = {
  "burning-man": burningMan,
  afrikaburn,
};
