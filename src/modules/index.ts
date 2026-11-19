// Composition root: the ONLY file that imports every module manifest.
// Remove a module = delete its folder + route folder and its line here.
import { manifest as applicants } from "./applicants/manifest";
import { manifest as exodus } from "./exodus/manifest";
import { manifest as finance } from "./finance/manifest";
import { manifest as logistics } from "./logistics/manifest";
import { manifest as mv } from "./mv/manifest";
import { manifest as obligations } from "./obligations/manifest";
import { manifest as procurement } from "./procurement/manifest";
import { manifest as registers } from "./registers/manifest";
import { manifest as schedule } from "./schedule/manifest";
import { manifest as shifts } from "./shifts/manifest";
import { manifest as sound } from "./sound/manifest";
import { manifest as tickets } from "./tickets/manifest";
import { manifest as village } from "./village/manifest";

export const modules = [
  obligations,
  finance,
  procurement,
  logistics,
  applicants,
  shifts,
  exodus,
  mv,
  registers,
  schedule,
  sound,
  tickets,
  village,
] as const;
