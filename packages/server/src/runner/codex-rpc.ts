/**
 * The JSON-RPC channel of a `codex app-server` process, one JSON message per line both ways: the
 * requests the runtime writes and the answers it waits for, by their IDs, and the requests Codex
 * writes to the client, each refused at once (R6).
 */
import type { CodexNotification } from "./codex-events.ts";

type Json = Record<string, unknown>;
const isJson = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** JSON-RPC's code for a method the receiver does not have. */
const METHOD_NOT_FOUND = -32_601;

/** The answer to one of the runtime's requests: its result, or Codex's error. */
type Answer = { error?: string; result?: unknown };

/** The message of a JSON-RPC error object. */
function errorText(error: unknown): string {
  if (isJson(error) && typeof error.message === "string" && error.message !== "") {
    return error.message;
  }
  return "Codex refused the request";
}

/** A process's requests and the answers they wait for, by their IDs. */
export class CodexRpc {
  #next = 0;
  #waiting = new Map<number, (answer: Answer) => void>();
  #ended: string | undefined;
  #write: (value: unknown) => void;

  constructor(write: (value: unknown) => void) {
    this.#write = write;
  }

  /** Writes a request, and gives its result: rejected on Codex's error, or the channel's end. */
  request(method: string, params: unknown): Promise<unknown> {
    if (this.#ended !== undefined) {
      return Promise.reject(new Error(this.#ended));
    }
    const id = ++this.#next;
    const answer = new Promise<unknown>((resolve, reject) => {
      this.#waiting.set(id, ({ error, result }) =>
        error === undefined ? resolve(result) : reject(new Error(error)),
      );
    });
    this.#write({ id, method, params });
    return answer;
  }

  /** Writes a notification, which Codex does not answer. */
  notify(method: string, params?: unknown) {
    this.#write(params === undefined ? { method } : { method, params });
  }

  /**
   * Reads one line of Codex's: an answer goes to its request, and a request of Codex's gets an
   * error at once, so a turn never waits on a client that does not answer. Gives the line's
   * notification, or undefined for any other line.
   */
  read(line: string): CodexNotification | undefined {
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      return undefined;
    }
    if (!isJson(message)) {
      return undefined;
    }
    const { id, method } = message;
    const hasId = typeof id === "number" || typeof id === "string";
    if (typeof method === "string") {
      if (!hasId) {
        return { method, params: message.params };
      }
      this.#write({
        error: { code: METHOD_NOT_FOUND, message: `Uraeda does not answer ${method}` },
        id,
      });
      return undefined;
    }
    if (typeof id === "number") {
      const settle = this.#waiting.get(id);
      this.#waiting.delete(id);
      settle?.(
        "error" in message ? { error: errorText(message.error) } : { result: message.result },
      );
    }
    return undefined;
  }

  /** Rejects the requests waiting, and those written from now on, with `why`. */
  end(why: string) {
    this.#ended ??= why;
    for (const settle of this.#waiting.values()) {
      settle({ error: why });
    }
    this.#waiting.clear();
  }
}
