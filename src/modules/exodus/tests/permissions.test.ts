import { permissionMatrix } from "@/base/api/testing";
import { manifest } from "../manifest";

permissionMatrix(manifest, {
  "exodus.view": {
    allow: ["member", "team_lead", "camp_lead", "admin"],
    deny: ["waitlisted", "prospect", "alumni"],
  },
  "exodus.manage": {
    allow: ["camp_lead", "admin"],
    deny: ["member", "team_lead", "finance_approver", "waitlisted"],
  },
});
