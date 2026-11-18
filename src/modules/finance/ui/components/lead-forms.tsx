"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { isActionFailure } from "@/base/api/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CAMP_NAME } from "@/lib/camp";
import { exportSummaryCsv, setBudget } from "../../server/money";

/** Finance: set a team's budget. */
export function BudgetForm({ teams }: { teams: { id: string; name: string }[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          try {
            const r = await setBudget({
              teamId: String(f.get("team")),
              amount: String(f.get("amount")),
            });
            if (isActionFailure(r)) return setMsg(r.error);
            setMsg("Budget saved.");
            router.refresh();
          } catch {
            setMsg("That didn't work. Check the amount.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor="team">Team</Label>
        <select id="team" name="team" className="min-h-11 rounded-md border bg-card px-2">
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="amount">New budget (R)</Label>
        <Input
          id="amount"
          name="amount"
          inputMode="decimal"
          required
          className="min-h-11"
          placeholder="60,000"
        />
      </div>
      <Button type="submit" disabled={pending} className="min-h-11">
        {pending ? "Saving…" : "Set budget"}
      </Button>
      {msg ? (
        <p role="status" className="text-sm">
          {msg}
        </p>
      ) : null}
    </form>
  );
}

/** Finance: download the summary CSV (same sums as the screen). */
export function CsvButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      className="min-h-11"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const csv = await exportSummaryCsv({});
          if (isActionFailure(csv)) return;
          const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = `${CAMP_NAME.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-budget-summary.csv`;
          a.click();
          URL.revokeObjectURL(url);
        })
      }
    >
      Download CSV
    </Button>
  );
}
