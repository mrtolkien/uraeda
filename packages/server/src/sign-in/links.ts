// One-time links: the host's browser signs in by opening one, as the server starts.
import { randomToken } from "./tokens.ts";

/** How long a one-time link may be used after it is made. */
const LINK_MS = 5 * 60 * 1000;

/**
 * The one-time links made and not used yet, in memory only: a link is a 32-byte token and the path
 * it leads to, used once, within 5 minutes.
 */
export class OneTimeLinks {
  private readonly links = new Map<string, { expires: number; to: string }>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  /** A new link to `to`, its path on the server: `/session/<token>?to=<to>`. */
  make(to: string): string {
    const now = this.now();
    for (const [token, link] of this.links) {
      if (link.expires < now) {
        this.links.delete(token);
      }
    }
    const token = randomToken(32);
    this.links.set(token, { expires: now + LINK_MS, to });
    return `/session/${token}?to=${encodeURIComponent(to).replaceAll("%2F", "/")}`;
  }

  /** The path a link leads to, the first time it is used within 5 minutes; undefined after. */
  use(token: string): string | undefined {
    const link = this.links.get(token);
    this.links.delete(token);
    return link !== undefined && link.expires >= this.now() ? link.to : undefined;
  }
}
