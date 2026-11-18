import { findInviteByToken } from "@/base/auth/invites";
import { getDb } from "@/base/db/client";
import { CAMP_NAME } from "@/lib/camp";
import { InviteButton } from "./invite-button";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findInviteByToken(getDb(), token);
  if (!found) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Invite not valid</h1>
        <p className="text-sm text-muted-foreground">
          This invite link is invalid or has expired. Ask a camp admin for a new one.
        </p>
      </div>
    );
  }
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {found.person.displayName}</h1>
        <p className="text-sm text-muted-foreground">
          You're invited to the {CAMP_NAME} camp app. We'll send a login link to{" "}
          {found.person.email}.
        </p>
      </div>
      <InviteButton token={token} />
    </>
  );
}
