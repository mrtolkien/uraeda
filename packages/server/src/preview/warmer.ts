// The story warmer: fetches a story's page and its modules from its Storybook, as a browser would,
// so that Vite compiles them before the story's frame shows.

/** The story to compile: its id, and its file's path from the folder Storybook runs in. */
export type WarmedStory = { id: string; importPath: string };

/** How many requests the warmer sends at once. */
const AT_ONCE = 6;

/** The module scripts of a page: their `src`, and the inline ones' text. */
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

/** A static import's specifier: `import … from "x"`, `import "x"`, or `export … from "x"`. */
const STATIC_IMPORT =
  /(?:^|[;\n}])\s*(?:import\s*(?:[\w*$\s{},]+?\s*from\s*)?|export\s*[\w*$\s{},]*?\s*from\s*)["']([^"'\n]+)["']/g;

/**
 * Fetches the story's page from the Storybook on `port` of 127.0.0.1, the module scripts it holds,
 * and the story's file, then follows each JavaScript answer's static imports, never dynamic ones,
 * on the same server, each URL once. A path under `base` is fetched with `base` cut to `/`, as the
 * proxy forwards it. Resolves once every fetch answered or failed, or once `signal` aborts; never
 * rejects.
 */
export async function warmStory(
  port: number,
  base: string,
  story: WarmedStory,
  signal: AbortSignal,
): Promise<void> {
  const origin = `http://127.0.0.1:${port}`;
  const page = new URL(`/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`, origin);
  const queue = new Queue(origin, base, signal);
  queue.add(new URL(`/${story.importPath.replace(/^\.\//, "")}`, origin));
  const html = await fetchText(page, signal);
  if (html !== undefined) {
    for (const url of pageModules(html, page)) {
      queue.add(url);
    }
  }
  await queue.done();
}

/** The module URLs a page holds: its module scripts' `src`, and its inline modules' imports. */
function pageModules(html: string, page: URL): Array<URL> {
  const urls: Array<URL> = [];
  for (const [, attributes = "", text = ""] of html.matchAll(SCRIPT)) {
    if (!/\btype\s*=\s*["']?module\b/i.test(attributes)) {
      continue;
    }
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1];
    for (const specifier of src === undefined ? staticImports(text) : [src]) {
      urls.push(new URL(specifier, page));
    }
  }
  return urls;
}

/** The specifiers of a module's static imports and re-exports. */
function staticImports(code: string): Array<string> {
  return [...code.matchAll(STATIC_IMPORT)].map(([, specifier]) => specifier!);
}

/** The text of `url`'s answer, or undefined when it fails or is not a 200. */
async function fetchText(url: URL, signal: AbortSignal): Promise<string | undefined> {
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
    return await response.text();
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
  #finish = () => {};
  readonly #finished = new Promise<void>((resolve) => {
    this.#finish = resolve;
  });

  constructor(origin: string, base: string, signal: AbortSignal) {
    this.#origin = origin;
    this.#base = base;
    this.#signal = signal;
    signal.addEventListener("abort", () => this.#finish(), { once: true });
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

  /** Fetches `url`, and queues the static imports of its JavaScript answer. */
  async #fetch(url: URL): Promise<void> {
    const code = await fetchText(url, this.#signal);
    if (code !== undefined) {
      for (const specifier of staticImports(code)) {
        if (/^[./]/.test(specifier) || /^https?:/.test(specifier)) {
          this.add(new URL(specifier, url));
        }
      }
    }
    this.#running -= 1;
    this.#next();
  }
}
