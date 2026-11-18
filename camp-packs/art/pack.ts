// Art Project (stub): art registration, build crew, grant notes and a burn plan (raised off the
// playa or on a public burn platform). Source: burningman.org/black-rock-city/bring-your-art/.
import { definePack } from "../../src/lib/camp-packs";

export default definePack({
  key: "art",
  label: "Art project",
  roles: [{ key: "art_lead", label: "Art lead", kind: "officer" }],
});
