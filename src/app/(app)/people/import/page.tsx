import { can } from "@/base/authz/permissions";
import { ForbiddenError } from "@/base/errors";
import { IMPORT_FIELDS } from "@/base/people/import/mapping";
import { basePage } from "../../_components/base-page";
import { ImportForm } from "./import-form";

export default async function ImportPage() {
  await basePage(async (ctx) => {
    if (!can(ctx.actor, "member.import")) throw new ForbiddenError();
  });
  const fields = Object.entries(IMPORT_FIELDS).map(([key, f]) => ({ key, label: f.label }));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="heading text-lg">Import members from a CSV</h1>
      <p className="text-sm text-muted-foreground">
        Export the sheet as CSV, check the column mapping, look at the dry run, then apply. Rows
        match people by email; possible duplicates wait for you to decide. Nobody gets an email.
      </p>
      <ImportForm fields={fields} />
    </div>
  );
}
