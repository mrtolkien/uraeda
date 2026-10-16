// The frame secret: the only place that knows the secret preview and mockup paths carry, since
// sandboxed frames get no cookie. One for the whole server, in memory, made at each start and
// replaced whenever a session ends.
import { MOCKUP_PATH, PREVIEW_PATH } from "../guard.ts";
import { hash, randomToken, sameHash } from "./tokens.ts";

/** The secret's random bytes. */
const SECRET_BYTES = 32;

/**
 * The secret of preview paths, `/r/<repository>/preview/<secret>/<folder>/`, and mockup paths,
 * `/r/<repository>/mockups/<secret>/<path>`. `replace` makes a new one at once, so the old one is
 * refused from then on; its listeners, which restart the Storybooks under their new base, are told
 * once for every replacement made in the same turn of the event loop, as `endAll` ends every
 * session in one call.
 */
export class FrameSecret {
  #current: string;
  readonly #make: () => string;
  readonly #listeners: Array<() => void> = [];
  #told = true;

  /** `make` makes a secret: 32 random bytes in base64url by default. */
  constructor(make: () => string = () => randomToken(SECRET_BYTES)) {
    this.#make = make;
    this.#current = make();
  }

  /** The current secret, which only a signed-in page receives, through fate. */
  current(): string {
    return this.#current;
  }

  /** Whether `text` is the current secret, compared in constant time. */
  check(text: string): boolean {
    return sameHash(hash(text), hash(this.#current));
  }

  /** Replaces the secret, and tells the listeners once the current turn of the event loop ends. */
  replace(): void {
    this.#current = this.#make();
    if (this.#told) {
      this.#told = false;
      queueMicrotask(() => {
        this.#told = true;
        this.#listeners.forEach((listener) => listener());
      });
    }
  }

  /** Calls `listener` after the secret is replaced: once for replacements made together. */
  onReplace(listener: () => void): void {
    this.#listeners.push(listener);
  }

  /** Whether `path` is a preview's or a mockup's path whose secret is the current one. */
  allows(path: string): boolean {
    const secret = PREVIEW_PATH.exec(path)?.[2] ?? MOCKUP_PATH.exec(path)?.[1];
    return secret !== undefined && this.check(secret);
  }
}
