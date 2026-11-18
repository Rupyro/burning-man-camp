// Sound camp: sound officer, sound and lighting gear and the AfrikaBurn sound plan. Pulls in power.
import { definePack } from "../../src/lib/camp-packs";

export default definePack({
  key: "sound",
  label: "Sound camp",
  includes: ["power"],
  roles: [{ key: "sound_officer", label: "Sound officer", kind: "officer" }],
  materialCategories: [{ key: "sound_lighting", label: "Sound and lighting" }],
  obligations: [{ key: "sound_plan", label: "Sound plan and Sound Officer" }],
});
