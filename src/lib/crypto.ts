import { createHash, randomBytes } from "node:crypto";

/** Random URL-safe token (raw value only ever goes into an email link). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Deterministic UUID-shaped id from a name (for audit rows about non-uuid things, e.g. a module id). */
export function stableUuid(name: string): string {
  const h = sha256(name);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
