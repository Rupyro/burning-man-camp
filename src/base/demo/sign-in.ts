import { getAuth } from "../auth/auth";
import { getDb } from "../db/client";
import { armCapture, takeCaptured } from "./capture";
import { requireDemo } from "./mode";
import { PERSONAS } from "./personas";

/**
 * Demo mode: get a normal magic link for a seeded fake persona (invite check, session hooks and
 * audit all run as usual), for the browser to follow. Refused unless demo mode is on.
 */
export async function demoLinkFor(personaKey: unknown, headers: Headers): Promise<string | null> {
  await requireDemo(getDb());
  const persona = PERSONAS.find((p) => p.key === personaKey);
  if (!persona) return null;
  armCapture(persona.email);
  try {
    await getAuth().api.signInMagicLink({
      body: { email: persona.email, callbackURL: "/" },
      headers,
    });
    return takeCaptured(persona.email);
  } finally {
    takeCaptured(persona.email); // never leave a capture armed
  }
}
