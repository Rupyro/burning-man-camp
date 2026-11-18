// Mutant vehicle: DMV contact, MV registration and flame licensing, art-car shifts. Pulls in power.
import { definePack } from "../../src/lib/camp-packs";

export default definePack({
  key: "mutant-vehicle",
  label: "Mutant vehicle",
  includes: ["power"],
  roles: [{ key: "mv_dmv_contact", label: "Mutant vehicle / DMV contact", kind: "officer" }],
  obligations: [
    { key: "mv_registration", label: "Mutant vehicle registration" },
    { key: "dmv_flame_licensing", label: "DMV licensing and flame-effect plan" },
  ],
  shiftTemplates: [
    { key: "art_car_crew", label: "Art car crew" },
    { key: "art_car_driver", label: "Art car driver" },
    { key: "art_car_sound", label: "Art car sound and tech" },
  ],
});
