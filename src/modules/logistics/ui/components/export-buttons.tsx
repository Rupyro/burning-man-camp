"use client";
import { isActionFailure } from "@/base/api/action-result";
import { Button } from "@/components/ui/button";
import { exportCsv } from "../../server/exports";
import { Status, useAction } from "./forms";

function download(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButtons() {
  const { msg, pending, run } = useAction();
  const go = (kind: "wap" | "arrivals") =>
    run(
      async () => {
        const r = await exportCsv({ kind });
        if (isActionFailure(r)) return r;
        download(r.filename, r.csv);
        return r;
      },
      "Downloaded.",
      () => undefined,
    );
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={pending}
          onClick={() => go("wap")}
        >
          Builders' WAP list (CSV)
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={pending}
          onClick={() => go("arrivals")}
        >
          Arrivals by day (CSV)
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        WAP list: confirmed builders, name and email only. Downloads are logged.
      </p>
      <Status msg={msg} />
    </div>
  );
}
