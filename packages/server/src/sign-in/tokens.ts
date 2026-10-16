// The random tokens and hashes of sign-in: the access key, sessions, and secrets.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** A token of `bytes` random bytes, in base64url. */
export function randomToken(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

/** The SHA-256 hash of a text, in base64url: the only form a key or a secret is stored in. */
export function hash(text: string): string {
  return createHash("sha256").update(text).digest("base64url");
}

/**
 * Whether two hashes are the same, compared in constant time, so the answer's timing tells nothing
 * of how much of a guess was right. Hashes of unequal lengths are never the same.
 */
export function sameHash(a: string, b: string): boolean {
  const [left, right] = [Buffer.from(a), Buffer.from(b)];
  return left.length === right.length && timingSafeEqual(left, right);
}
