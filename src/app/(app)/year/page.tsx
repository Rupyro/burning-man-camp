import { getNow } from "@/base/guard/request";
import { activeEvent } from "@/lib/active-packs";
import { campConfig } from "@/lib/camp";
import type { CampConfig } from "@/lib/camp-config";
import { instantToCampInput } from "@/lib/dates";
import { byMonth, calendarForCamp, withStates } from "@/lib/year-calendar";
import { basePage } from "../_components/base-page";
import { YearView } from "./year-view";

export default async function YearPage() {
  const { now } = await basePage(async (ctx) => ({ now: ctx.now ?? getNow() }));
  const type = (campConfig as CampConfig).camp.type;
  const today = instantToCampInput(now).date;
  const months = byMonth(withStates(calendarForCamp(activeEvent, type), today));
  return <YearView eventName={activeEvent.words.name} year={activeEvent.year} months={months} />;
}
