// Village or HUB (stub): partner camps sharing water, power, tools and transport, with one
// liaison per camp. Source: burningman.org/black-rock-city/camps/placement-process/hubs/.
import { definePack } from "../../src/lib/camp-packs";

export default definePack({
  key: "village",
  label: "Village or HUB",
  roles: [{ key: "village_liaison", label: "Village liaison", kind: "officer" }],
});
