// The story warmer: fetches a story's page and its modules from its Storybook, as a browser would,
// so that Vite compiles them before the story's frame shows.

/** The story to compile: its id, and its file's path from the folder Storybook runs in. */
export type WarmedStory = { id: string; importPath: string };

/** How many requests the warmer sends at once. */
const AT_ONCE = 6;

/** The module scripts of a page: their `src`, and the inline ones' text. */
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

/**
 * A static import's specifier: `import … from "x"`, `import "x"`, or `export … from "x"`, at a
 * statement's start, or after a comment.
 */
const STATIC_IMPORT =
  /(?:^|[;\n}/])\s*(?:import\s*(?:[\w*$\s{},]+?\s*from\s*)?|export\s*[\w*$\s{},]*?\s*from\s*)["']([^"'\n]+)["']/g;

/**
 * Fetches the story's page from the Storybook on `port` of 127.0.0.1, the module scripts it holds,
 * and the story's file, then follows each JavaScript answer's static imports, never dynamic ones,
 * on the same server, each URL once, at most `AT_ONCE` at a time. A path under `base` is fetched
 * with `base` cut to `/`, as the proxy forwards it. Resolves once every fetch answered or failed,
 * or once `signal` aborts; never rejects.
 */
export async function warmStory(
  port: number,
  base: string,
  story: WarmedStory,
  signal: AbortSignal,
): Promise<void> {
  const origin = `http://127.0.0.1:${port}`;
  const queue = new Queue(origin, base, signal);
  queue.add(new URL(`/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`, origin));
  queue.add(new URL(`/${story.importPath.replace(/^\.\//, "")}`, origin));
  await queue.done();
}

/**
 * The specifiers a page loads: its module scripts' `src`, an address even without `./`, and its
 * inline modules' imports.
 */
function pageModules(html: string): Array<string> {
  const specifiers: Array<string> = [];
  for (const [, attributes = "", text = ""] of html.matchAll(SCRIPT)) {
    if (!/\btype\s*=\s*["']?module\b/i.test(attributes)) {
      continue;
    }
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1];
    const address = src !== undefined && !/^[./]|^https?:/.test(src) ? `./${src}` : src;
    specifiers.push(...(address === undefined ? staticImports(text) : [address]));
  }
  return specifiers;
}

/** The specifiers of a module's static imports and re-exports. */
function staticImports(code: string): Array<string> {
  return [...code.matchAll(STATIC_IMPORT)].map(([, specifier]) => specifier!);
}

/**
 * The URL `specifier` names from `from`: undefined for a bare package name, which only a bundler
 * resolves, and for an address that cannot be parsed.
 */
function resolved(specifier: string, from: URL): URL | undefined {
  if (!/^[./]/.test(specifier) && !/^https?:/.test(specifier)) {
    return undefined;
  }
  return URL.canParse(specifier, from) ? new URL(specifier, from) : undefined;
}

/** An answer's type and text, or undefined when it fails, is not a 200, or is neither. */
type Answer = { html: boolean; text: string };

/** `url`'s answer, when it is a 200 of JavaScript or HTML. */
async function fetchAnswer(url: URL, signal: AbortSignal): Promise<Answer | undefined> {
  try {
    const response = await fetch(url, { signal });
    if (response.status !== 200) {
      await response.body?.cancel();
      return undefined;
    }
    const type = response.headers.get("content-type") ?? "";
    if (!/javascript|html/.test(type)) {
      await response.body?.cancel();
      return undefined;
    }
    return { html: type.includes("html"), text: await response.text() };
  } catch {
    return undefined;
  }
}

/** The modules to fetch, each once, at most `AT_ONCE` at a time, each answer's imports followed. */
class Queue {
  readonly #origin: string;
  readonly #base: string;
  readonly #signal: AbortSignal;
  readonly #seen = new Set<string>();
  readonly #waiting: Array<URL> = [];
  #running = 0;
  /** Whether every first URL was added: until then, an empty queue is not finished. */
  #closed = false;
  #resolve = () => {};
  readonly #finished = new Promise<void>((resolve) => {
    this.#resolve = resolve;
  });
  /** Ends the queue as its signal aborts: removed once it ends, so a long-lived signal keeps none. */
  readonly #onAbort = () => this.#finish();

  constructor(origin: string, base: string, signal: AbortSignal) {
    this.#origin = origin;
    this.#base = base;
    this.#signal = signal;
    signal.addEventListener("abort", this.#onAbort, { once: true });
  }

  /** Queues `url` when it is on the Storybook's server and not yet queued, its base cut. */
  add(url: URL): void {
    if (url.origin !== this.#origin) {
      return;
    }
    const cut = new URL(url);
    if (this.#base !== "/" && cut.pathname.startsWith(this.#base)) {
      cut.pathname = `/${cut.pathname.slice(this.#base.length)}`;
    }
    cut.hash = "";
    if (this.#seen.has(cut.href)) {
      return;
    }
    this.#seen.add(cut.href);
    this.#waiting.push(cut);
    this.#next();
  }

  /** Resolves once every queued fetch ended, or the signal aborted. */
  done(): Promise<void> {
    this.#closed = true;
    this.#next();
    return this.#finished;
  }

  /** Starts the waiting fetches up to the limit, or finishes once nothing is left. */
  #next(): void {
    if (this.#signal.aborted) {
      this.#finish();
      return;
    }
    while (this.#running < AT_ONCE && this.#waiting.length > 0) {
      this.#running += 1;
      void this.#fetch(this.#waiting.shift()!);
    }
    if (this.#closed && this.#running === 0 && this.#waiting.length === 0) {
      this.#finish();
    }
  }

  /** Resolves `done`, and stops listening to the signal. */
  #finish(): void {
    this.#signal.removeEventListener("abort", this.#onAbort);
    this.#resolve();
  }

  /**
   * Fetches `url`, and queues the modules its answer loads: a page's module scripts, or a
   * module's static imports. Whatever happens, it frees its place in the queue.
   */
  async #fetch(url: URL): Promise<void> {
    try {
      const answer = await fetchAnswer(url, this.#signal);
      if (answer !== undefined) {
        const specifiers = answer.html ? pageModules(answer.text) : staticImports(answer.text);
        for (const specifier of specifiers) {
          const next = resolved(specifier, url);
          if (next !== undefined) {
            this.add(next);
          }
        }
      }
    } finally {
      this.#running -= 1;
      this.#next();
    }
  }
}
