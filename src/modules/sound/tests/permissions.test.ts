import { permissionMatrix } from "@/base/api/testing";
import { manifest } from "../manifest";

permissionMatrix(manifest, {
  "sound.view": {
    allow: ["member", "team_lead", "camp_lead", "admin"],
    deny: ["waitlisted", "prospect", "alumni"],
  },
  "sound.manage": {
    allow: ["camp_lead", "admin"],
    deny: ["member", "team_lead", "finance_approver", "waitlisted"],
  },
});
