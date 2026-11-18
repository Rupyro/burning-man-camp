// Kitchen and Food Gifting (stub): meal plan, diets, cook shifts and the health-permit check
// (gifting food to the public, or cooking for 125 or more). Screens come in a later phase.
import { definePack } from "../../src/lib/camp-packs";

export default definePack({
  key: "kitchen",
  label: "Kitchen and food gifting",
  roles: [{ key: "kitchen_lead", label: "Kitchen lead", kind: "officer" }],
});
