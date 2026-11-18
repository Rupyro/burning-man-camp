// pnpm invite <email> "<Display name>" [--admin]
// Creates the person (confirmed for the current edition) and an invite, audited as a system action.
// Until B1's admin screens exist this is how an admin invites someone. The email goes to the console adapter.
import { eq } from "drizzle-orm";
import { createInvite } from "../src/base/auth/invites";
import { Actor } from "../src/base/authz/actor";
import { closeDb, getDb } from "../src/base/db/client";
import { getCurrentEdition } from "../src/base/editions/current";
import { roleAssignments, roles } from "../src/base/schema";
import { firstRow } from "../src/lib/rows";
import { loadEnv } from "./lib/load-env";

loadEnv();
const [email, name, ...flags] = process.argv.slice(2);
if (!email || !name) {
  console.error('Usage: pnpm invite <email> "<Display name>" [--admin]');
  process.exit(1);
}
const db = getDb();
const edition = await getCurrentEdition(db);
if (!edition) {
  console.error("No current edition. Run pnpm seed first.");
  process.exit(1);
}
const result = await createInvite(db, {
  email,
  displayName: name,
  editionId: edition.id,
  invitedBy: Actor.system(edition.id),
});
if (flags.includes("--admin")) {
  const admin = firstRow(
    await db.select({ id: roles.id }).from(roles).where(eq(roles.key, "admin")),
    "admin role",
  );
  await db
    .insert(roleAssignments)
    .values({ personId: result.personId, roleId: admin.id })
    .onConflictDoNothing();
}
console.log(`Invited ${email}: ${result.url}`);
await closeDb();
