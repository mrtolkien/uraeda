// An EventSource over a test's `fetch`: happy-dom has none, and a test that checks what a live
// update does to the page reads the server's own stream through it.

type Listener = (event: { data?: string; lastEventId?: string; type: string }) => void;

/**
 * An `EventSource` class whose connections read the stream `fetch` answers, as a browser's would:
 * each event goes to the listeners of its name, `message` without one. It opens once the stream's
 * answer comes, and never reconnects: a test's stream ends with the test. `arrived` waits until an
 * event that holds a text was sent to the page: what an optimistic result hides, the test still
 * knows came in.
 */
export function liveSource(fetch: typeof globalThis.fetch) {
  const sent: Array<string> = [];
  const waiting = new Set<() => void>();
  const arrived = (text: string) =>
    new Promise<void>((resolve) => {
      const wake = () => {
        if (sent.some((data) => data.includes(text))) {
          waiting.delete(wake);
          resolve();
        }
      };
      waiting.add(wake);
      wake();
    });
  const EventSource = class LiveSource {
    readyState = 0;
    url: string;
    readonly #listeners = new Map<string, Set<Listener>>();
    readonly #stop = new AbortController();

    constructor(url: string) {
      this.url = url;
      void this.#read();
    }

    addEventListener(type: string, listener: Listener) {
      const listeners = this.#listeners.get(type) ?? new Set();
      listeners.add(listener);
      this.#listeners.set(type, listeners);
    }

    removeEventListener(type: string, listener: Listener) {
      this.#listeners.get(type)?.delete(listener);
    }

    close() {
      this.readyState = 2;
      this.#stop.abort();
    }

    #emit(event: Parameters<Listener>[0]) {
      for (const listener of this.#listeners.get(event.type) ?? []) {
        listener(event);
      }
    }

    async #read() {
      const response = await fetch(this.url, { method: "GET" });
      const reader = response.body!.getReader();
      this.#stop.signal.addEventListener("abort", () => void reader.cancel().catch(() => {}));
      if (this.readyState === 2) {
        return;
      }
      this.readyState = 1;
      this.#emit({ type: "open" });
      const decoder = new TextDecoder();
      let received = "";
      for (;;) {
        const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
        if (done || this.readyState === 2) {
          return;
        }
        received += decoder.decode(value, { stream: true });
        const blocks = received.split("\n\n");
        received = blocks.pop() ?? "";
        for (const block of blocks) {
          this.#dispatch(block);
        }
      }
    }

    /** Sends one event of the stream, its `event:`, `id:`, and `data:` lines, to its listeners. */
    #dispatch(block: string) {
      let type = "message";
      let lastEventId = "";
      const data: Array<string> = [];
      for (const line of block.split("\n")) {
        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
        if (field === "event") {
          type = value;
        } else if (field === "id") {
          lastEventId = value;
        } else if (field === "data") {
          data.push(value);
        }
      }
      if (data.length > 0) {
        this.#emit({ data: data.join("\n"), lastEventId, type });
        sent.push(data.join("\n"));
        for (const wake of waiting) {
          wake();
        }
      }
    }
  };
  return { arrived, EventSource };
}
