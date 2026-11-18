import { listAnchorDates } from "@/base/editions/settings";
import { getNow } from "@/base/guard/request";
import { basePage } from "../_components/base-page";
import { CountdownView } from "./countdown-view";

export default async function CountdownPage() {
  const { anchors, now } = await basePage(async (ctx) => ({
    anchors: await listAnchorDates(ctx.db, ctx.edition.id),
    now: ctx.now ?? getNow(),
  }));
  return <CountdownView anchors={anchors} now={now} />;
}
