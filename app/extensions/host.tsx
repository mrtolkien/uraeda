// The app's side of an extension page's channel: what the app answers for a page, and the words of
// a page's problem. A page asks through its host, `uraeda.extension`, which hands each `record`,
// `call`, and `navigate` of the page to `ExtensionPlace`, which answers it here.
//
// The channel, page to app (each a `host.post` or a `host.call` of the page):
// - `start`, `loaded`, `alive`: the page runs, its code ran, it answers a ping. The view keeps them.
// - `ready`, with its `Declarations` (`page.tsx`): the part it was asked for is drawn.
// - `problem`, `{ message }`: it threw, as it loaded, drew, or listened.
// - `record`, `{ id, name }` or `{ id, settings: true }`, then `{ id, stop: true }`: a record of
//   its own extension in the repository, or its settings there, from now on. The app answers with
//   `record` events. A page names a record, never an extension: it reads only its own.
// - `call`, `{ name, input }`, a call: an action of its own extension, answered with its output.
// - `navigate`, `{ to }`: an address of the app.
//
// App to page (events): `show` (draw your part), `ping` (answer `alive`), `theme`, a `ShownTheme`
// as the app's changes, `props`, what the part reads with `useProps`, `record`,
// `{ id, value, error }`, and `key`, `{ keys }`, a key the page declared, pressed.
import { navigate } from "../store/history";
import type { Actions, Records } from "../store/protocol";
import { parseRoute } from "../store/routes";

/** A record read: its value once it came, or why there is none. */
export type Reading<V> = { value: V | undefined; error: string | undefined };

/**
 * What the app gives an extension's pages, which the client store provides (task 23): where the
 * server is, a record read as it changes, and an action called.
 */
export interface ExtensionHost {
  /** The server the app is signed in to, and the device's token, which a page never sees. */
  server(): { address: string; token: string | undefined };
  /** Reads a record from now on: `seen` gets its value, then each change, or why there is none. */
  read<N extends keyof Records>(
    name: N,
    args: Records[N]["args"],
    seen: (reading: Reading<Records[N]["value"]>) => void,
  ): () => void;
  /** Runs an action: its output, or a rejection with why it was refused. */
  call<N extends keyof Actions>(name: N, input: Actions[N]["input"]): Promise<Actions[N]["output"]>;
}

/** A message of a page for the app, as `uraeda.extension` emits it: `id` when it waits. */
export type PageMessage = { id: number | null; name: string; data: unknown };

/** What the view tells the app when it answers the page, and sends it events. */
export type PageLine = {
  send(name: string, data: unknown): void;
  reply(id: number, answer: { value: unknown } | { error: string }): void;
};

/** Which page: its extension's name, and the repository its part is drawn for. */
export type PageOf = { extension: string; repo: string };

type RecordAsked = { id: number; name?: string; settings?: true; stop?: true };

/** The app's answers to one page: `heard` takes each message, `close` stops what it reads. */
export function pageChannel(host: ExtensionHost, page: PageOf, line: PageLine) {
  const reads = new Map<number, () => void>();
  const record = (asked: RecordAsked) => {
    reads.get(asked.id)?.();
    reads.delete(asked.id);
    if (asked.stop) return;
    const send = (reading: Reading<unknown>) =>
      line.send("record", {
        id: asked.id,
        error: reading.error ?? null,
        value: reading.value ?? null,
      });
    const { extension, repo } = page;
    const stop = asked.settings
      ? host.read("Extensions", { repo }, ({ value, error }) => {
          const row = value?.extensions.find((shown) => shown.name === extension);
          send({ error, value: row?.valuesHere });
        })
      : host.read("ExtensionRecord", { extension, name: asked.name ?? "", repo }, (reading) =>
          send({
            error: reading.error ?? reading.value?.error ?? undefined,
            value: reading.value?.value,
          }),
        );
    reads.set(asked.id, stop);
  };
  const call = (id: number, asked: { name?: string; input?: unknown }) => {
    const input = { ...page, input: (asked.input ?? null) as never, name: asked.name ?? "" };
    host.call("extensions.act", input).then(
      (answer) => line.reply(id, { value: answer.output }),
      (error: unknown) =>
        line.reply(id, { error: error instanceof Error ? error.message : String(error) }),
    );
  };
  return {
    heard(message: PageMessage) {
      const data = (message.data ?? {}) as Record<string, unknown>;
      if (message.name === "record") record(data as RecordAsked);
      else if (message.name === "call" && message.id !== null) call(message.id, data);
      else if (message.name === "navigate" && typeof data.to === "string") {
        navigate(parseRoute(data.to));
      }
    },
    close() {
      for (const stop of reads.values()) stop();
      reads.clear();
    },
  };
}

/** What broke, as `uraeda.extension` tells it. */
export type ProblemKind = "unreachable" | "untrusted" | "load" | "threw" | "slow" | "stopped";

/** A page's problem, as `uraeda.extension` emits it. */
export type PageProblem = { kind: ProblemKind; message: string; version: number };

/** A problem in words: what happened, naming the extension; why, and what its owner can do. */
export type ProblemWords = {
  title: string;
  words: string;
  /** The page shows nothing more: its words stand in its place. */
  gone: boolean;
  /** The page's own doing, which the server keeps with the extension's problems. */
  reported: boolean;
};

const FIX = "Fix it in the extension's folder: the page loads again as you save.";

/** The words of `problem`, of the extension titled `title`. */
export function problemWords(title: string, problem: PageProblem): ProblemWords {
  const said = problem.message.replace(/\.$/, "");
  switch (problem.kind) {
    case "unreachable":
      return {
        title: `The page of ${title} could not be fetched`,
        words: `${said}. It is fetched again as its version changes, or as you open it again.`,
        gone: true,
        reported: false,
      };
    case "untrusted":
      return {
        title: `The page of ${title} was refused`,
        words: `It is not signed by the server this app trusts, or is older than one shown already: ${said}. Saving the page builds and signs it again.`,
        gone: true,
        reported: false,
      };
    case "load":
      return {
        title: `The page of ${title} failed as it loaded`,
        words: `${said}. ${FIX}`,
        gone: true,
        reported: true,
      };
    case "threw":
      return {
        title: `The page of ${title} stopped drawing`,
        words: `${said}. ${FIX}`,
        gone: true,
        reported: true,
      };
    case "slow":
      return {
        title: `The page of ${title} held the app`,
        words: `${said}: a call of a page is cut off after 2 seconds, and the page goes on. Look for a loop that never ends. ${FIX}`,
        gone: false,
        reported: true,
      };
    case "stopped":
      return {
        title: `The page of ${title} stopped`,
        words: `${said}: it ran out of memory, or never started. ${FIX}`,
        gone: true,
        reported: true,
      };
  }
}
