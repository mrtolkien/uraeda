// The tokens of the MCP endpoint: one per agent process, the only sign-in `/mcp` takes.
import { hash, randomToken, sameHash } from "../sign-in/tokens.ts";

/**
 * The MCP endpoint's tokens: a random token per agent process, kept only as its hash, with the
 * session it was issued to. A session holds one token at a time, as it runs one process at a time:
 * issuing its next process's token revokes the one before.
 */
export class McpTokens {
  /** The hash of each session's token, by session. */
  #hashes = new Map<string, string>();

  /** A new token for `session`'s new process, its earlier process's token revoked. */
  issue(session: string): string {
    const token = randomToken(32);
    this.#hashes.set(session, hash(token));
    return token;
  }

  /** Revokes a token, as its process closes: a token no longer issued is left as is. */
  revoke(token: string): void {
    const revoked = hash(token);
    for (const [session, kept] of this.#hashes) {
      if (sameHash(kept, revoked)) {
        this.#hashes.delete(session);
      }
    }
  }

  /**
   * The session of an `Authorization: Bearer <token>` header, or undefined for no header, another
   * scheme, or a token not issued now. Every token is compared, each in constant time, so the
   * answer's timing tells nothing of which one was close.
   */
  sessionOf(header: string | undefined): string | undefined {
    const token = /^Bearer (.+)$/.exec(header ?? "")?.[1];
    if (token === undefined) {
      return undefined;
    }
    const given = hash(token);
    let found: string | undefined;
    for (const [session, kept] of this.#hashes) {
      if (sameHash(kept, given)) {
        found = session;
      }
    }
    return found;
  }
}
