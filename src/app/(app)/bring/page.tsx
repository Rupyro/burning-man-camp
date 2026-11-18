import { myPackingTicks } from "@/base/people/packing";
import { basePage } from "../_components/base-page";
import { PackingView } from "./packing-view";

export default async function BringPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const ticked = await basePage((ctx) => myPackingTicks(ctx));
  return <PackingView ticked={ticked} tab={q.tab === "provided" ? "provided" : "bring"} />;
}
