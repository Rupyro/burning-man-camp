// Camp fees (applicants spec §6). Pure. The amount comes from camp.config.ts (money.campFeeCents).
import { campConfig } from "@/lib/camp";

/** PLACEHOLDER camp fee (R3,500) until leadership sets the 2027 amount. Integer cents. */
export const CAMP_FEE_PLACEHOLDER_CENTS = campConfig.money.campFeeCents;
