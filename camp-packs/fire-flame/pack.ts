// Fire and Flame Effects (stub): burn barrels, fire-watch rota, flame-effect paperwork and the
// extinguisher and clear-zone check. Source: burningman.org/black-rock-city/bring-your-art/
// fire-art-guidelines/fire-in-theme-camps-2/. Screens come in a later phase; this is the flag.
import { definePack } from "../../src/lib/camp-packs";

export default definePack({
  key: "fire-flame",
  label: "Fire and flame effects",
  roles: [{ key: "fire_safety_lead", label: "Fire safety lead", kind: "officer" }],
});
