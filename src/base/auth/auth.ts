import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { and, eq, isNull } from "drizzle-orm";
import { CAMP_NAME } from "@/lib/camp";
import { stableUuid } from "@/lib/crypto";
import { getEnv } from "@/lib/env";
import { globalSingleton } from "@/lib/global-singleton";
import { recordAudit } from "../audit/audit";
import { getDb } from "../db/client";
import { captureLink } from "../demo/capture";
import { getEmailAdapter } from "../email/adapter";
import { account, invites, people, session, user, verification } from "../schema";
import {
  canEmailSignIn,
  findLiveInviteForPerson,
  findPersonByEmail,
  normaliseEmail,
} from "./eligibility";

function createAuth() {
  const env = getEnv();
  const db = getDb();
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: { enabled: false },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    databaseHooks: {
      user: {
        create: {
          // Invite-only: a login can only be created for an invited person.
          before: async (data) => {
            const email = normaliseEmail(data.email);
            const person = await findPersonByEmail(db, email);
            const invite = person ? await findLiveInviteForPerson(db, person.id) : null;
            if (!person || !invite) {
              throw new APIError("FORBIDDEN", {
                message: "This email hasn't been invited",
                code: "NOT_INVITED",
              });
            }
            return { data: { ...data, email, name: data.name || person.displayName } };
          },
          after: async (created) => {
            const person = await findPersonByEmail(db, created.email);
            if (!person) return;
            await db.transaction(async (tx) => {
              await tx
                .update(people)
                .set({ userId: created.id, updatedAt: new Date() })
                .where(eq(people.id, person.id));
              const invite = await findLiveInviteForPerson(tx, person.id);
              if (invite && !invite.acceptedAt) {
                await tx
                  .update(invites)
                  .set({ acceptedAt: new Date(), updatedAt: new Date() })
                  .where(and(eq(invites.id, invite.id), isNull(invites.acceptedAt)));
                await recordAudit(
                  tx,
                  {
                    actor: null,
                    actorKind: "person",
                    actorPersonId: person.id,
                    editionId: invite.editionId,
                  },
                  {
                    action: "invite.accepted",
                    entity: { type: "base.invite", id: invite.id },
                    changes: { acceptedAt: [null, new Date().toISOString()] },
                    significance: "security",
                  },
                );
              }
            });
          },
        },
      },
      session: {
        create: {
          after: async (created) => {
            const [person] = await db
              .select({ id: people.id })
              .from(people)
              .where(eq(people.userId, created.userId));
            await recordAudit(
              db,
              { actor: null, actorKind: "person", actorPersonId: person?.id ?? null },
              {
                action: "auth.login",
                entity: {
                  type: "base.person",
                  id: person?.id ?? stableUuid(`user:${created.userId}`),
                },
                changes: { method: ["", "magic_link"] },
                significance: "security",
              },
            );
          },
        },
      },
    },
    plugins: [
      magicLink({
        expiresIn: 60 * 15,
        storeToken: "hashed",
        sendMagicLink: async ({ email, url }) => {
          const allowed = await canEmailSignIn(db, email);
          if (!allowed) {
            // No email, no hint to the requester. Logged for admins (email stored only as a hash).
            await recordAudit(
              db,
              { actor: null, actorKind: "system" },
              {
                action: "auth.login_refused",
                entity: {
                  type: "base.login_attempt",
                  id: stableUuid(`email:${normaliseEmail(email)}`),
                },
                changes: { reason: ["", "not_invited"] },
                significance: "security",
              },
            );
            return;
          }
          // Demo mode persona picker (spec b3-demo-mode): same link, handed back, not emailed.
          if (captureLink(normaliseEmail(email), url)) return;
          await getEmailAdapter().send({
            to: normaliseEmail(email),
            subject: `Your ${CAMP_NAME} login link`,
            text: `Tap to log in (valid for 15 minutes):\n${url}\n\nIf you didn't ask for this, ignore this email.`,
            tag: "auth.magic_link",
            link: url,
          });
        },
      }),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
type Holder = { auth?: Auth };
const holder: Holder = globalSingleton<Holder>("__campAuth", () => ({}));

/** Lazily created so builds and unit tests don't need env or a database. */
export function getAuth(): Auth {
  holder.auth ??= createAuth();
  return holder.auth;
}

/** Tests only. */
export function resetAuthForTests() {
  holder.auth = undefined;
}
