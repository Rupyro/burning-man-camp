// Workshops and Offerings (stub): event schedule, hosts, supplies and an export for the
// official event guide (WhatWhereWhen). Screens come in a later phase.
import { definePack } from "../../src/lib/camp-packs";

export default definePack({
  key: "workshops",
  label: "Workshops and offerings",
  roles: [{ key: "schedule_lead", label: "Schedule lead", kind: "officer" }],
});
