import { permissionMatrix } from "@/base/api/testing";
import { manifest } from "../manifest";

permissionMatrix(manifest, {
  "registers.view": {
    allow: ["member", "team_lead", "camp_lead", "admin"],
    deny: ["waitlisted", "prospect", "alumni"],
  },
  "registers.manage": {
    allow: ["team_lead", "camp_lead", "admin"],
    deny: ["member", "finance_approver", "waitlisted"],
  },
});
