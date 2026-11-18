import { getTeamBoard } from "@/base/landing/home";
import { loadHome } from "../_components/home/load-home";
import { TeamBoard } from "../_components/home/team-board";
import { UpNext } from "../_components/home/up-next";

/** See all (spec B3.1 §3): the whole ranked queue; leads also get the My team board. */
export default async function UpNextPage() {
  const { ctx, now, queue, lead } = await loadHome();
  const board = lead ? await getTeamBoard(ctx) : null;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="heading text-lg">Everything that needs you</h1>
      <UpNext
        items={queue.all}
        total={queue.total}
        now={now}
        title={lead ? "My to-do · waiting on you" : "My to-do"}
        full
      />
      {board ? <TeamBoard board={board} now={now} /> : null}
    </div>
  );
}
