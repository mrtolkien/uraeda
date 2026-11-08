// What loaded extensions contributed: their records, actions, and routes, by extension, each
// called inside a guard, so a throw or a rejection is reported under the extension's name and
// reaches Uraeda's caller only as a record's error, a refusal, or a 500; and given 10 s, so one
// that never answers holds no request of Uraeda's: it is reported, and answers so, or a 504.
import type { Context as HonoContext } from "hono";
import type { ActionRunner, RecordReader, RouteEntry } from "./api.ts";
import { reportFor } from "./events.ts";

/** An extension's record, as fate sends it: its value as JSON, or why it could not be read. */
export type RecordValue = { error: string | null; id: string; value: string };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** How long a record, an action, or a route has to answer. */
const ANSWER_MS = 10_000;

/** The cause of the error of an extension's call that did not answer in time. */
const NO_ANSWER = Symbol("no answer");

const isNoAnswer = (error: unknown) => (error as Error | undefined)?.cause === NO_ANSWER;

/** Gives what `run` answers, or throws one caused by `NO_ANSWER` once `ANSWER_MS` pass first. */
async function inTime<T>(run: () => T | Promise<T>): Promise<Awaited<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`no answer in ${ANSWER_MS / 1000} s`, { cause: NO_ANSWER })),
      ANSWER_MS,
    );
  });
  try {
    return await Promise.race([Promise.resolve().then(run), late]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Whether `route` answers `path` with `method`: its own path, or under it for one ending `/*`, a
 * trailing slash ignored. A route without a method answers GET and POST; a GET one, HEAD too.
 */
function matches(route: RouteEntry, path: string, method: string): boolean {
  const asked = method === "HEAD" ? "GET" : method;
  if (route.method === undefined ? !["GET", "POST"].includes(asked) : route.method !== asked) {
    return false;
  }
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  if (route.path.endsWith("/*")) {
    const prefix = route.path.slice(0, -2);
    return path === prefix || path.startsWith(`${prefix}/`);
  }
  return path === route.path;
}

/** The records, actions, and routes of the loaded extensions. */
export class Contributions {
  readonly #records = new Map<string, RecordReader>();
  readonly #actions = new Map<string, ActionRunner>();
  readonly #routes = new Map<string, Set<RouteEntry>>();

  /** Adds `value` under `key` in `map`, refusing a key taken: gives its removal. */
  #add<T>(map: Map<string, T>, key: string, value: T, what: string): () => void {
    if (map.has(key)) {
      throw new Error(`${key.replace("/", `: the ${what} `)} is registered already`);
    }
    map.set(key, value);
    return () => {
      if (map.get(key) === value) {
        map.delete(key);
      }
    };
  }

  addRecord(extension: string, name: string, read: RecordReader): () => void {
    return this.#add(this.#records, `${extension}/${name}`, read, "record");
  }

  addAction(extension: string, name: string, run: ActionRunner): () => void {
    return this.#add(this.#actions, `${extension}/${name}`, run, "action");
  }

  addRoute(extension: string, route: RouteEntry): () => void {
    const routes = this.#routes.get(extension) ?? new Set();
    this.#routes.set(extension, routes);
    routes.add(route);
    return () => routes.delete(route);
  }

  /** The names of the extension's records. */
  records(extension: string): Array<string> {
    return [...this.#records.keys()]
      .filter((id) => id.startsWith(`${extension}/`))
      .map((id) => id.slice(extension.length + 1));
  }

  /** Reads the record `<extension>/<name>` of `id` for the repository, its failure as its error. */
  async read(id: string, repository: string): Promise<RecordValue> {
    const extension = id.split("/")[0];
    const read = this.#records.get(id);
    if (!read) {
      return {
        error: `${extension} has no record ${id.slice(extension.length + 1)}`,
        id,
        value: "null",
      };
    }
    try {
      const value = await inTime(() => read(repository));
      return { error: null, id, value: JSON.stringify(value ?? null) };
    } catch (error) {
      reportFor(extension, error);
      const message = messageOf(error);
      return {
        error: isNoAnswer(error) ? `${extension}: ${message}` : message,
        id,
        value: "null",
      };
    }
  }

  /** Runs the action with the input as JSON, giving its output as JSON: refused on a failure. */
  async act(
    extension: string,
    name: string,
    inputJson: string,
    repository: string,
  ): Promise<string> {
    const run = this.#actions.get(`${extension}/${name}`);
    if (!run) {
      throw new Error(`refused: ${extension} has no action ${name}`);
    }
    let input: unknown;
    try {
      input = JSON.parse(inputJson);
    } catch {
      throw new Error(`refused: ${extension}: the input of ${name} is not JSON`);
    }
    try {
      return JSON.stringify((await inTime(() => run(input, repository))) ?? null);
    } catch (error) {
      reportFor(extension, error);
      throw new Error(`refused: ${extension}: ${messageOf(error)}`, { cause: error });
    }
  }

  /**
   * Answers a request to an extension's route, `path` its path after any repository's prefix:
   * undefined when no route answers it, a 500 when the handler fails, a 504 when it does not
   * answer in time.
   */
  async answer(
    c: HonoContext,
    extension: string,
    path: string,
    repository: string | null,
  ): Promise<Response | undefined> {
    const route = [...(this.#routes.get(extension) ?? [])].find((one) =>
      matches(one, path, c.req.method),
    );
    if (!route) {
      return undefined;
    }
    try {
      return await inTime(() => route.handler(c, repository));
    } catch (error) {
      reportFor(extension, error);
      return c.text(`${extension}: ${messageOf(error)}`, isNoAnswer(error) ? 504 : 500);
    }
  }
}
